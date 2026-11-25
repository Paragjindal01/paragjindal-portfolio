import { defineConfig, devices } from '@playwright/test';

const port = 4628;
const localURL = 'http://127.0.0.1:' + port;
const publicURL = process.env.COMPUTEFLOW_TEST_URL;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  use: { baseURL: publicURL || localURL, trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: publicURL ? undefined : {
    command: 'npm run dev -- --host 127.0.0.1 --port ' + port + ' --strictPort',
    url: localURL,
    reuseExistingServer: !process.env.CI,
  },
});
