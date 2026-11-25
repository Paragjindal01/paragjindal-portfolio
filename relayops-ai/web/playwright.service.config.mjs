import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const repository = fileURLToPath(new URL('..', import.meta.url));
const isolated = mkdtempSync(join(tmpdir(), 'relayops-browser-service-'));
const port = 4378;
process.once('exit', () => rmSync(isolated, { force: true, recursive: true }));

export default defineConfig({
  testDir: './service-tests',
  retries: 0,
  timeout: 25_000,
  use: { baseURL: `http://127.0.0.1:${port}`, channel: process.env.RELAYOPS_BROWSER_CHANNEL },
  webServer: {
    command: 'npm run build -- --outDir "$RELAYOPS_DIST" && npm start',
    cwd: repository,
    url: `http://127.0.0.1:${port}/relayops/`,
    reuseExistingServer: false,
    env: {
      VITE_RELAYOPS_API: '1', RELAYOPS_CONNECTED: '0', RELAYOPS_HOST: '127.0.0.1', RELAYOPS_PORT: String(port),
      RELAYOPS_DB: join(isolated, 'relayops.sqlite'), RELAYOPS_DIST: join(isolated, 'dist'),
    },
  },
});
