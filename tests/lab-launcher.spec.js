import { test, expect } from '@playwright/test';
import { LAB_PROJECTS } from '../src/lab/catalog.mjs';

test('launcher has eight direct routes with mobile layouts and no runtime errors', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/lab');
  const cards = page.locator('.lab-card-grid a');
  await expect(cards).toHaveCount(LAB_PROJECTS.length);
  for (const [index, { id }] of LAB_PROJECTS.entries()) {
    await expect(cards.nth(index)).toHaveAttribute('href', `/lab/${id}`);
  }
  for (const { id, name } of LAB_PROJECTS) {
    await page.goto(`/lab/${id}`);
    await expect(page.getByRole('heading', { name, exact: true, level: 1 })).toBeVisible();
    await expect(page.locator('.lab-main .lab-panel').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  }
  expect(errors).toEqual([]);
  await page.getByRole('link', { name: 'Lab overview', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Engineering Lab', exact: true })).toBeVisible();
});

test('scenario links preserve the scenario and advance the deterministic clock', async ({ page }) => {
  await page.goto('/lab/rackops');
  await page.getByRole('combobox', { name: 'Scenario', exact: true }).selectOption('critical');
  await expect(page).toHaveURL(/scenario=critical/);
  await page.getByRole('button', { name: 'Advance 15 min' }).click();
  await expect(page.getByText('Alder Research Facility · step 1')).toBeVisible();
  await page.getByRole('navigation', { name: 'Engineering applications' }).getByRole('link', { name: 'GPUWatch' }).click();
  await expect(page.getByRole('combobox', { name: 'Scenario', exact: true })).toHaveValue('critical');
});

test('local API returns synthetic JSON, validates scenarios and rejects writes', async ({ request }) => {
  const response = await request.get('/api/simulation?scenario=critical&step=3');
  expect(response.ok()).toBeTruthy();
  expect(response.headers()['content-type']).toContain('application/json');
  const { snapshot, health } = await response.json();
  expect(snapshot).toMatchObject({ schemaVersion: 2, mode: 'simulation', scenario: 'critical', step: 3 });
  expect(health.alerts).toEqual(snapshot.alerts);
  expect((await request.get('/api/simulation?scenario=live')).status()).toBe(400);
  expect((await request.post('/api/simulation')).status()).toBe(405);
});
