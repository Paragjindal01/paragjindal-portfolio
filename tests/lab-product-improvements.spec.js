import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

async function readDownload(page, label) {
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: label, exact: true }).click();
  const download = await downloading;
  return JSON.parse(await readFile(await download.path(), 'utf8'));
}

test('InfraPilot reopens and exports the recorded scenario and thresholds after a scenario switch', async ({ page }) => {
  await page.goto('/lab/infrapilot-ai?scenario=critical&step=3');
  await page.getByRole('button', { name: 'Run infrastructure query' }).click();
  await page.getByRole('combobox', { name: 'Scenario', exact: true }).selectOption('recovery');
  await page.getByRole('button', { name: 'Run health report now' }).click();
  await page.getByLabel('Activity scenario').selectOption('critical');
  await page.getByLabel('Results only').check();
  await page.getByRole('button', { name: 'View result', exact: true }).click();
  const console = page.getByRole('region', { name: 'Infrastructure operations console' });
  await expect(console.getByText('critical · step 3')).toBeVisible();
  const result = await readDownload(page, 'Export results as JSON');
  expect(result.evidence).toMatchObject({ scenario: 'critical', step: 3, thresholds: { gpuC: 85, inletC: 30, outletPercent: 80 } });
  const activity = await readDownload(page, 'Export filtered activity');
  expect(activity.activities).toHaveLength(1);
  expect(activity.activities[0].context).toEqual(result.evidence);
});

test('FabricLab exports the simulated cable loss and retains the base design', async ({ page }) => {
  await page.goto('/lab/fabriclab');
  await page.getByRole('button', { name: 'Remove cable-5', exact: true }).click();
  await page.getByLabel('Simulated failed cable').selectOption('cable-2');
  await expect(page.getByText('Newly isolated: Compute 01')).toBeVisible();
  await expect(page.getByText('5 cables · 200 Gbps installed link capacity')).toBeVisible();
  const report = await readDownload(page, 'Export design report');
  expect(report.outage).toMatchObject({ cableId: 'cable-2', remainingBandwidthGbps: 175, lostReachability: [{ id: 'server-1', label: 'Compute 01' }] });
  expect(report.topology.links).toHaveLength(5);
});

test('StorageCalc sizes a post-loss target and includes it in the capacity export', async ({ page }) => {
  await page.goto('/lab/storagecalc');
  await page.getByLabel('Target planning capacity (TB)').fill('500');
  const sizing = page.getByRole('region', { name: 'Capacity target after node loss' });
  await expect(sizing.getByRole('row', { name: 'Erasure coding 4+2', exact: false })).toContainText('Meets target');
  const report = await readDownload(page, 'Export calculation report');
  expect(report.resilience).toMatchObject([
    { targetTB: 500, minimumInstalledNodes: 11, additionalNodes: 3 },
    { targetTB: 500, minimumInstalledNodes: 7, additionalNodes: 0 },
  ]);
});

test('LocalMind compares candidate chunk settings and keeps its active index', async ({ page }) => {
  await page.goto('/lab/localmind');
  await page.getByText('Compare chunk settings', { exact: true }).click();
  await page.getByLabel('Candidate words per chunk').fill('30');
  await page.getByRole('button', { name: 'Run index comparison' }).click();
  await expect(page.getByRole('cell', { name: 'improved', exact: true })).toHaveCount(1);
  await expect(page.getByText('Active settings: 70 words per chunk, 12 words of overlap.')).toBeVisible();
  const report = await readDownload(page, 'Export comparison');
  expect(report.baseline.settings).toEqual({ size: 70, overlap: 12 });
  expect(report.candidate.settings).toEqual({ size: 30, overlap: 20 });
  expect(report.cases).toHaveLength(4);
});
