import { cpSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
execFileSync('npm', ['--prefix', 'relayops-ai', 'run', 'build'], {
  cwd: root,
  env: { ...process.env, VITE_RELAYOPS_API: '0' },
  stdio: 'inherit',
});
mkdirSync(new URL('../dist/relayops', import.meta.url), { recursive: true });
cpSync(new URL('../relayops-ai/dist/', import.meta.url), new URL('../dist/relayops/', import.meta.url), { recursive: true });
