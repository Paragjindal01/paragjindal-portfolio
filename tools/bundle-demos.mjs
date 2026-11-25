import { cpSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const demos = [
  { packageDirectory: 'relayops-ai', route: 'relayops', args: [], env: { VITE_RELAYOPS_API: '0' } },
  { packageDirectory: 'compute-flow', route: 'compute-flow', args: ['--', '--base=/compute-flow/'] },
];

for (const { packageDirectory, route, args, env } of demos) {
  execFileSync('npm', ['--prefix', packageDirectory, 'run', 'build', ...args], {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: 'inherit',
  });
  const destination = new URL(`../dist/${route}/`, import.meta.url);
  mkdirSync(destination, { recursive: true });
  cpSync(new URL(`../${packageDirectory}/dist/`, import.meta.url), destination, { recursive: true });
}
