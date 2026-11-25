import { test, expect } from '@playwright/test';
import { LAB_PROJECTS } from '../src/lab/catalog.mjs';
import { LAB_TOOLS } from '../src/lab/lab-design.mjs';

test('launcher lists all ten real tools and preserves the eight direct lab routes', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/lab');
  const tools = page.locator('.index__row');
  await expect(tools).toHaveCount(10);
  for (const [index, tool] of LAB_TOOLS.entries()) {
    await expect(tools.nth(index)).toHaveAttribute('href', tool.links.demo);
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

test('final lab search filters categories and restores the complete index', async ({ page }) => {
  await page.goto('/lab');
  const tools = page.locator('.index__row');
  const search = page.getByRole('searchbox', { name: 'Search' });
  await search.fill('inference');
  await expect(tools).toContainText(['ComputeFlow']);
  await page.getByRole('group', { name: 'Filter by category' }).getByRole('button', { name: 'Power 1' }).click();
  await expect(page.getByText('No system matches “inference”.')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(tools).toHaveCount(10);
  await expect(page.getByRole('status')).toHaveText('10 of 10 systems');
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
