import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('..', import.meta.url));
const port = 4377;
export default defineConfig({
  testDir: './tests',
  timeout: 25_000,
  retries: 0,
  use: { baseURL: `http://127.0.0.1:${port}`, channel: process.env.RELAYOPS_BROWSER_CHANNEL },
  webServer: {
    command: `npm run build && npm run preview -- --host 127.0.0.1 --port ${port} --strictPort`,
    cwd: repo,
    url: `http://127.0.0.1:${port}/relayops/`,
    reuseExistingServer: false,
  },
});
