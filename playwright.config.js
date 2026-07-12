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
  // Capped: tests that load the real Spline scene fetch a multi-MB asset
  // from an external CDN; too many parallel workers starve each other.
  workers: 4,
  // One retry: the robot tests depend on an external Spline CDN fetch that
  // can transiently exceed timeouts under parallel load. A genuine
  // regression still fails both attempts.
  retries: 1,
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
