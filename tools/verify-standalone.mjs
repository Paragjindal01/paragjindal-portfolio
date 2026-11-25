import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';
import { preview } from 'vite';
import { DEFAULT_OUTPUT, exportLab } from './export-lab.mjs';

const output = resolve(process.argv[2] ?? DEFAULT_OUTPUT);
if (process.argv.length > 3) throw new Error('Usage: node tools/verify-standalone.mjs [output-directory]');
const manifest = exportLab(output);
const temporary = mkdtempSync(join(tmpdir(), 'parag-verify-standalone-'));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function digest(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function unpack(artifact, directory) {
  const archive = join(output, artifact.archive);
  assert.equal(digest(archive), artifact.sha256);
  mkdirSync(directory);
  execFileSync('tar', ['-xzf', archive, '--strip-components=1', '-C', directory], { stdio: 'inherit' });
}

function runNpm(directory, args) {
  execFileSync(npm, args, { cwd: directory, stdio: 'inherit' });
}

const smoke = {
  async rackops(page) {
    await page.getByRole('button', { name: /^Rack 2/ }).click();
    await page.getByRole('button', { name: 'Rear', exact: true }).click();
    await page.getByRole('button', { name: /Select Metered PDU 2/ }).click();
    await expect(page.getByRole('heading', { name: 'Metered PDU 2' })).toBeVisible();
  },
  async gpuwatch(page) {
    await page.getByLabel('Chart metric').selectOption('vram');
    await expect(page.getByRole('img', { name: /VRAM utilization/ })).toBeVisible();
  },
  async powerops(page) {
    await page.getByRole('button', { name: 'Simulate phase balancing' }).click();
    await expect(page.getByRole('button', { name: 'Hide proposed balance' })).toBeVisible();
  },
  async 'infrapilot-ai'(page) {
    await page.getByRole('button', { name: 'Start incident recording' }).click();
    await expect(page.getByRole('button', { name: 'Stop recording' })).toBeVisible();
    await page.getByLabel('Ask about the laboratory').fill('Recommend actions to resolve the simulated incident.');
    await page.getByRole('button', { name: 'Run infrastructure query' }).click();
    await expect(page.getByRole('button', { name: /Analysis and recommendations/ }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Prepare handoff' }).click();
    await page.getByRole('combobox', { name: 'Demo reviewer role' }).selectOption('operator');
    await page.getByRole('button', { name: 'Approve handoff' }).click();
    await page.getByRole('link', { name: 'Review selected outlet in PowerOps' }).click();
    await expect(page.getByText('Incident recording linked')).toBeVisible();
    await page.getByRole('link', { name: 'Return to incident replay' }).click();
    await expect(page.getByRole('region', { name: 'Incident replay' })).toBeVisible();
  },
  async fabriclab(page) {
    await page.getByRole('button', { name: 'Load InfiniBand example' }).click();
    await expect(page.getByText('4 cables · 800 Gbps installed link capacity')).toBeVisible();
  },
  async virtscan(page) {
    await page.getByRole('button', { name: 'Synchronize inventory' }).click();
    await expect(page.getByRole('heading', { name: 'Snapshot changes' })).toBeVisible();
  },
  async storagecalc(page) {
    await page.getByLabel('Storage nodes').fill('6');
    await page.getByLabel('Failed nodes').fill('7');
    await expect(page.getByRole('alert')).toContainText('Failed nodes cannot exceed installed nodes');
  },
  async localmind(page) {
    await page.getByRole('button', { name: 'Run sample evaluation' }).click();
    await expect(page.getByText('100.0%')).toBeVisible();
  },
};

async function verifyBrowser(browser, project, directory) {
  const server = await preview({
    root: directory,
    configFile: join(directory, 'vite.config.mjs'),
    preview: { host: '127.0.0.1', port: 0, strictPort: true },
    logLevel: 'warn',
  });
  try {
    const origin = 'http://127.0.0.1:' + server.httpServer.address().port;
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    try {
      page.setDefaultTimeout(8000);
      const errors = [];
      const external = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
      await page.route('**/*', (request) => {
        const url = request.request().url();
        if (new URL(url).origin === origin) return request.continue();
        external.push(url);
        return request.abort();
      });
      await page.goto(origin + '/');
      await expect(page.getByRole('heading', { level: 1, name: project.name, exact: true })).toBeVisible();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1),
        project.name + ' overflows a 390px viewport');
      if (project.simulation) {
        await page.getByRole('combobox', { name: 'Scenario', exact: true }).selectOption('critical');
        await page.getByRole('button', { name: 'Advance 15 min' }).click();
        await expect(page.getByText('Alder Research Facility · step 1')).toBeVisible();
      }
      await smoke[project.id](page);
      for (const route of project.routes) {
        await page.goto(origin + '/lab/' + route + '?scenario=warning');
        const entry = manifest.projects.find(({ id }) => id === route);
        await expect(page.getByRole('heading', { level: 1, name: entry.name, exact: true })).toBeVisible();
      }
      assert.deepEqual(errors, [], project.name + ' raised a browser error');
      assert.deepEqual(external, [], project.name + ' requested an external resource on its offline workflow');
    } finally {
      await page.close();
    }
  } finally {
    await server.close();
  }
}

try {
  const simulator = join(temporary, 'simulation');
  unpack(manifest.shared, simulator);
  runNpm(simulator, ['test']);
  const browser = await chromium.launch({ channel: process.env.STANDALONE_BROWSER_CHANNEL || undefined });
  try {
    const verified = [];
    for (const project of manifest.projects) {
      const directory = join(temporary, project.id);
      try {
        unpack(project, directory);
        assert.equal(digest(join(directory, 'vendor', manifest.shared.archive)), manifest.shared.sha256);
        runNpm(directory, ['ci', '--include=dev', '--ignore-scripts', '--prefer-offline', '--no-audit', '--no-fund']);
        runNpm(directory, ['test']);
        runNpm(directory, ['run', 'build']);
        await verifyBrowser(browser, project, directory);
        verified.push({ id: project.id, archive: project.archive, cleanInstall: true, unit: true, build: true, browserSmoke: true });
        console.log('Verified ' + project.archive);
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    }
    const revision = process.env.GITHUB_SHA ?? null;
    writeFileSync(join(output, 'verification.json'), JSON.stringify({
      schemaVersion: 1,
      tag: manifest.tag,
      sourceCommit: revision,
      node: process.version,
      browser: browser.version(),
      simulatorTests: true,
      projects: verified,
    }, null, 2) + '\n');
    writeFileSync(join(output, 'RELEASE-NOTES.md'), [
      '# Standalone Engineering Lab source exports',
      '',
      'Eight independently installable application archives and the versioned simulator package. The live demos remain part of the integrated Engineering Lab.',
      '',
      ...(revision ? ['Verified commit: ' + revision, ''] : []),
      'Each application archive was unpacked in an isolated directory, installed using its pinned dependency lock, tested, built for production, and exercised in Chromium. The shared library was tested directly from its published archive.',
      '',
      ...manifest.projects.map(({ name, archive, demo }) => '- **' + name + '** · ' + archive + ' · [Live demo](' + demo + ')'),
      '',
      'The simulator is included as the same verified dependency archive in all eight applications. SHA256SUMS and verification.json record artifact checksums and the verification result.',
      '',
    ].join('\n'));
  } finally {
    await browser.close();
  }
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
