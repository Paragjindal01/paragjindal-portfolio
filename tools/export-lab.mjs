import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { LAB_PROJECTS, LAB_RELEASE } from '../src/data/projects.mjs';

export const APP_VERSION = LAB_RELEASE.version;
export const RELEASE_TAG = 'standalone-lab-v' + APP_VERSION;
const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const DEFAULT_OUTPUT = join(ROOT, 'test-output/standalone/release');
const BUNDLE = join(ROOT, 'packages/standalone');
const SIMULATION = join(ROOT, 'packages/simulation');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const BASE_LOCK = readJson(join(BUNDLE, 'npm-lock.template.json'));
const sim = readJson(join(SIMULATION, 'package.json'));
const simAsset = 'infra-simulation-v' + sim.version + '.tgz';
const sharedOperations = 'src/lab/apps/operations.test.mjs';
const sharedAi = 'src/lab/apps/ai-apps.test.mjs';
const helperAi = ['tools/lab-ai.mjs', 'tools/lab-ai.test.mjs', 'tools/lab-ai.env.example'];
const replayFiles = ['src/lab/replay/incident.test.mjs', 'docs/projects/incident-replay.md'];
const extras = {
  rackops: ['src/lab/apps/rack.test.mjs'],
  gpuwatch: [sharedOperations, 'tools/gpuwatch-nvml.mjs'],
  powerops: [sharedOperations, sharedAi, ...helperAi, ...replayFiles],
  'infrapilot-ai': [sharedAi, sharedOperations, ...helperAi, ...replayFiles],
  fabriclab: ['src/lab/apps/fabric.test.mjs'],
  virtscan: [sharedOperations, 'tools/proxmox-inventory.mjs', 'tools/proxmox-inventory.env.example'],
  storagecalc: ['src/lab/apps/storage.test.mjs'],
  localmind: [sharedAi, ...helperAi],
};
const companions = { powerops: 'infrapilot-ai', 'infrapilot-ai': 'powerops' };

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function write(target, contents) {
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents);
}

function copy(from, to) {
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
}

function hash(path, algorithm, encoding) {
  return createHash(algorithm).update(readFileSync(path)).digest(encoding);
}

function pack(source, name, stage, output, requiredPaths) {
  const [result] = JSON.parse(execFileSync(npm, ['pack', '--ignore-scripts', '--json', '--cache', join(stage, 'npm-cache'), '--pack-destination', stage], {
    cwd: source,
    encoding: 'utf8',
  }));
  const files = new Set(result.files.map(({ path }) => path));
  for (const path of requiredPaths) {
    if (!files.has(path)) throw new Error(name + ' archive omitted ' + path);
  }
  copy(join(stage, result.filename), join(output, name));
}

function packageSourceImports(source) {
  const staticImports = source.matchAll(/^\s*(?:import|export)\s+(?:['"]([^'"]+)['"]|[\w$*,{}\s]+?\s+from\s*['"]([^'"]+)['"])/gm);
  const otherImports = source.matchAll(/(?:\bimport\(\s*|new\s+URL\(\s*|@import\s+|url\(\s*)['"](\.[^'"]+)['"]/g);
  return [
    ...Array.from(staticImports, (match) => match[1] ?? match[2]),
    ...Array.from(otherImports, (match) => match[1]),
  ].filter((item) => item.startsWith('.'));
}

function dependencyPath(file, specifier) {
  const path = resolve(ROOT, dirname(file), specifier);
  const extensions = ['.mjs', '.js', '.jsx', '.css', '.json'];
  const candidates = [path, ...extensions.map((ext) => path + ext), ...extensions.map((ext) => join(path, 'index' + ext))];
  const resolved = candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
  if (!resolved) throw new Error('Unable to export ' + specifier + ' from ' + file);
  return relative(ROOT, resolved).split(sep).join('/');
}

function copyDependencies(files, target) {
  const remaining = [...files];
  const seen = new Set();
  while (remaining.length) {
    const file = remaining.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    if (file === 'src/lab/simulator.mjs') {
      write(join(target, file), "export * from '" + sim.name + "';\n");
      continue;
    }
    if (!/^(?:src\/|tools\/|docs\/projects\/|public\/lab-screenshots\/)[\w./-]+$/.test(file) || file.split('/').includes('..')) {
      throw new Error('Unexpected standalone source path ' + file);
    }
    const from = join(ROOT, file);
    if (!realpathSync(from).startsWith(ROOT) || /(^|\/)\.(?:env(?:$|\.(?!example$))|npmrc$)/.test(file)) {
      throw new Error('Unsafe standalone source path ' + file);
    }
    copy(from, join(target, file));
    if (/\.(?:mjs|js|jsx|css)$/.test(file)) {
      const source = readFileSync(from, 'utf8');
      remaining.push(...packageSourceImports(source).map((specifier) => dependencyPath(file, specifier)));
    }
  }
}

function installFiles(project, target, simulatorArchive) {
  const vendorFile = 'vendor/' + simAsset;
  const packageName = '@paragjindal01/' + project.id;
  const root = BASE_LOCK.packages[''];
  const dependencies = { ...root.dependencies, [sim.name]: 'file:' + vendorFile };
  const metadata = {
    name: packageName, version: APP_VERSION, type: 'module', private: true,
    description: project.description, engines: root.engines,
    scripts: { dev: 'vite', preview: 'vite preview', build: 'vite build', test: 'node --test' },
    dependencies, devDependencies: root.devDependencies,
    files: ['src', 'tools', 'docs', 'public', 'vendor', '.github', '.gitignore', '.dockerignore', 'Dockerfile', 'nginx.conf', 'index.html', 'vite.config.mjs', 'CHANGELOG.md', 'npm-shrinkwrap.json'],
  };
  write(join(target, 'package.json'), JSON.stringify(metadata, null, 2) + '\n');
  const lock = structuredClone(BASE_LOCK);
  Object.assign(lock, { name: metadata.name, version: metadata.version });
  lock.packages[''] = {
    name: metadata.name, version: metadata.version, dependencies,
    devDependencies: metadata.devDependencies, engines: metadata.engines,
  };
  lock.packages['node_modules/' + sim.name] = {
    version: sim.version, resolved: 'file:' + vendorFile,
    integrity: 'sha512-' + hash(simulatorArchive, 'sha512', 'base64'),
    engines: sim.engines,
  };
  write(join(target, 'npm-shrinkwrap.json'), JSON.stringify(lock, null, 2) + '\n');
  copy(simulatorArchive, join(target, vendorFile));
}

function htmlText(value) {
  return value.replace(/[&<>]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[character]);
}

function browserFiles(project, routes, target) {
  const projectData = routes.map(({ id, name, area, description, simulation }) => ({ id, name, area, description, simulation }));
  const imports = routes.map(({ file }, index) => "import App" + index + " from './lab/apps/" + file + ".jsx';");
  const entries = projectData.map((entry, index) => '{ ...' + JSON.stringify(entry) + ', Application: App' + index + ' }');
  write(join(target, 'src/project.mjs'), imports.concat(
    'export const apps = [' + entries.join(', ') + '];',
    'export const primary = apps[0];', '',
  ).join('\n'));
  write(join(target, 'index.html'), [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    '  <title>' + htmlText(project.name) + '</title>',
    '</head>',
    '<body>',
    '  <div id="root"></div>',
    '  <script type="module" src="/src/main.jsx"></script>',
    '</body>',
    '</html>',
    '',
  ].join('\n'));
  copy(join(BUNDLE, 'files/main.jsx'), join(target, 'src/main.jsx'));
  copy(join(BUNDLE, 'files/standalone.css'), join(target, 'src/standalone.css'));
  copy(join(ROOT, 'src/engineering.css'), join(target, 'src/engineering.css'));
}

function projectDocs(project, routes, target, cover) {
  const localRoute = 'http://localhost:5173';
  const remoteRoute = 'https://paragjindal.com/lab/' + project.id;
  const other = routes[1];
  const doc = [
    '# ' + project.name,
    '',
    project.description,
    '',
    '[Live demo](' + remoteRoute + ') · [Technical case study](docs/projects/' + project.id + '.md)',
    '',
    ...(cover ? ['![' + project.name + ' concept artwork](docs/artwork.webp)', '*Concept artwork*', ''] : []),
    '![' + project.name + ' running in the integrated engineering lab](public/lab-screenshots/' + project.id + '.webp)',
    '',
    '## Run independently',
    '',
    'Use Node.js 24 or later from the extracted package. npm installs React and Vite from their pinned registry dependencies and the simulator from its included archive.',
    '',
    '\u0060\u0060\u0060sh',
    'npm ci',
    'npm run dev',
    '\u0060\u0060\u0060',
    '',
    'Open [' + localRoute + '](' + localRoute + '). Run \u0060npm test\u0060 for the package regression suite and \u0060npm run build\u0060 for a static production bundle.',
    '',
    'To use Docker, build with \u0060docker build -t ' + project.id + ' .\u0060 and run with \u0060docker run --rm -p 127.0.0.1:4173:80 ' + project.id + '\u0060. The static browser application is served on port 4173.',
    '',
    ...(other ? ['The ' + other.name + ' workflow companion is available at \u0060/lab/' + other.id + '\u0060 on the same origin. It preserves the simulated incident handoff and browser replay storage.', '', '[Incident replay data and storage](docs/projects/incident-replay.md)', ''] : []),
    '## Architecture',
    '',
    '\u0060\u0060\u0060mermaid',
    'flowchart LR',
    '  U[Browser controls] --> A[React project]',
    '  A --> D[Project-specific logic]',
    project.simulation ? '  S[Versioned simulation package] --> A' : '  V[Standalone shell] --> A',
    '  D --> O[Views and local exports]',
    '\u0060\u0060\u0060',
    '',
    'The browser uses synthetic demonstration data. Optional local adapters are documented in the case study. The archive retains its source, tests, installation lock, and GitHub Actions configuration. This source export can be kept in its own repository. A dedicated remote and a redistribution license have not been declared.',
    '',
  ].join('\n');
  write(join(target, 'README.md'), doc);
  write(join(target, 'CHANGELOG.md'), '# Changelog\n\n## ' + APP_VERSION + '\n\n- First standalone source export from the Engineering Lab.\n- Include independently installable source, documentation, regression tests, and the pinned simulator.\n');
}

export function exportLab(output = DEFAULT_OUTPUT) {
  if (LAB_RELEASE.tag !== RELEASE_TAG || LAB_RELEASE.simulator !== sim.version) {
    throw new Error('The catalog release and simulator package versions disagree.');
  }
  const ids = new Set(LAB_PROJECTS.map(({ id }) => id));
  if (ids.size !== LAB_PROJECTS.length || LAB_PROJECTS.length !== Object.keys(extras).length || Object.keys(extras).some((id) => !ids.has(id))) {
    throw new Error('The standalone export must include each of the eight lab applications exactly once.');
  }
  const destination = resolve(output);
  const stage = mkdtempSync(join(tmpdir(), 'parag-standalone-'));
  mkdirSync(destination, { recursive: true });
  try {
    const simulatorArchive = join(destination, simAsset);
    pack(SIMULATION, simAsset, stage, destination, ['src/index.mjs', 'test/simulator.test.mjs', 'README.md']);
    const projects = [];
    for (const project of LAB_PROJECTS) {
      const companion = LAB_PROJECTS.find(({ id }) => id === companions[project.id]);
      const routes = companion ? [project, companion] : [project];
      const target = join(stage, project.id);
      mkdirSync(target);
      const projectFiles = routes.flatMap(({ id, file }) => [
        'src/lab/apps/' + file + '.jsx',
        'docs/projects/' + id + '.md',
        'public/lab-screenshots/' + id + '.webp',
        ...(extras[id] ?? []),
      ]);
      copyDependencies(['src/lab/simulator.mjs', ...projectFiles], target);
      for (const file of ['vite.config.mjs', 'Dockerfile', 'nginx.conf', '.github/workflows/verify.yml']) {
        copy(join(BUNDLE, 'files', file), join(target, file));
      }
      copy(join(BUNDLE, 'files/dockerignore'), join(target, '.dockerignore'));
      copy(join(BUNDLE, 'files/gitignore'), join(target, '.gitignore'));
      installFiles(project, target, simulatorArchive);
      browserFiles(project, routes, target);
      const artwork = join(ROOT, 'docs/artwork', project.id + '.webp');
      const cover = existsSync(artwork) && realpathSync(artwork).startsWith(ROOT);
      if (cover) copy(artwork, join(target, 'docs/artwork.webp'));
      projectDocs(project, routes, target, cover);
      const archive = project.id + '-v' + APP_VERSION + '.tgz';
      pack(target, archive, stage, destination, [
        'npm-shrinkwrap.json', 'vendor/' + simAsset, 'src/main.jsx', 'README.md',
        '.github/workflows/verify.yml', '.gitignore', 'public/lab-screenshots/' + project.id + '.webp',
        ...(cover ? ['docs/artwork.webp'] : []),
      ]);
      projects.push({
        id: project.id, name: project.name, version: APP_VERSION,
        archive, sha256: hash(join(destination, archive), 'sha256', 'hex'),
        demo: 'https://paragjindal.com/lab/' + project.id,
        routes: routes.map(({ id }) => id),
        simulation: project.simulation,
      });
      console.log('Exported ' + archive);
    }
    const shared = { name: sim.name, version: sim.version, archive: simAsset, sha256: hash(simulatorArchive, 'sha256', 'hex') };
    const manifest = { schemaVersion: 1, tag: RELEASE_TAG, shared, projects };
    write(join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    write(join(destination, 'SHA256SUMS'), [shared, ...projects].map(({ sha256, archive }) => sha256 + '  ' + archive).concat('').join('\n'));
    return manifest;
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.length > 3) throw new Error('Usage: node tools/export-lab.mjs [output-directory]');
  exportLab(process.argv[2]);
}
