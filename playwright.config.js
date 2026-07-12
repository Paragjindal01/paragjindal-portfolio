import { defineConfig, devices } from '@playwright/test';

/**
 * Responsive audit test setup.
 * Runs against the production build via `vite preview` so results match
 * what visitors actually get. Run `npm run build` first (the webServer
 * command below does it automatically).
 */
export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4317',
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4317 --strictPort',
    port: 4317,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
