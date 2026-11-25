import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const launch = async (page) => {
  await page.getByRole('button', { name: 'Run workflow', exact: true }).click();
  await page.getByRole('button', { name: 'Start execution' }).click();
  await expect(page.getByRole('heading', { name: 'Executions', exact: true })).toBeVisible();
};

const detail = (page) => page.getByRole('region', { name: 'Selected execution' });

test('runs and replays a critical incident with a durable approval trail', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/relayops/');
  await expect(page.getByText('Offline demonstration')).toBeVisible();
  await launch(page);
  await expect(detail(page).getByRole('button', { name: 'Approve simulation' })).toBeVisible();
  await page.reload();
  await expect(detail(page).getByRole('button', { name: 'Approve simulation' })).toBeVisible();
  await detail(page).getByLabel('Reviewer note').fill('Confirmed in fixture');
  await detail(page).getByRole('button', { name: 'Approve simulation' }).click();
  await expect(detail(page).getByRole('button', { name: 'Replay run' })).toBeVisible();
  await expect(detail(page).locator('.execution-header .status-chip')).toHaveText('Completed');
  await detail(page).getByText('Event log').click();
  await expect(detail(page).getByText(/Confirmed in fixture/)).toBeVisible();
  const trace = page.waitForEvent('download');
  await detail(page).getByRole('button', { name: 'Export trace' }).click();
  const recorded = JSON.parse(await readFile(await (await trace).path(), 'utf8'));
  expect(recorded.events.some((item) => item.type === 'approval.approved')).toBe(true);
  await detail(page).getByRole('button', { name: 'Replay run' }).click();
  await expect(detail(page).getByText('Replay of')).toBeVisible();
  await detail(page).getByRole('button', { name: 'Cancel run' }).click();
  await expect(detail(page).locator('.execution-header .status-chip')).toHaveText('Cancelled');
  expect(errors).toEqual([]);
});

test('edits and versions a graph, then imports a validated definition', async ({ page }) => {
  await page.goto('/relayops/');
  const node = page.getByRole('button', { name: 'Select Normalize telemetry node' });
  const original = await node.getAttribute('style');
  const rectangle = await node.boundingBox();
  await page.mouse.move(rectangle.x + 15, rectangle.y + 20);
  await page.mouse.down();
  await page.mouse.move(rectangle.x + 37, rectangle.y + 33, { steps: 4 });
  await page.mouse.up();
  await expect(node).not.toHaveAttribute('style', original);
  const moved = await node.getAttribute('style');
  await node.press('ArrowRight');
  await expect(node).not.toHaveAttribute('style', moved);
  await expect(node).not.toHaveAttribute('style', original);
  await node.click();
  await page.getByLabel('Node label').fill('Normalize input fixtures');
  await page.getByRole('button', { name: 'Save version' }).click();
  await expect(page.getByRole('status')).toHaveText('Version 1 saved.');
  await page.getByRole('button', { name: 'Add node', exact: true }).click();
  await page.getByRole('button', { name: 'Document', exact: true }).click();
  await page.getByRole('button', { name: 'Save version' }).click();
  await expect(page.getByRole('alert')).toContainText('cannot be reached');
  await page.getByRole('button', { name: 'Remove node' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const file = await (await download).path();
  await page.getByLabel('Workflow template').selectOption('data-analyst');
  await page.getByLabel('Import JSON').setInputFiles({ name: 'snapshot.json', mimeType: 'application/json', buffer: await readFile(file) });
  await expect(page.getByRole('status')).toContainText('Loaded snapshot.json.');
  await expect(page.getByRole('button', { name: 'Select Normalize input fixtures node' })).toBeVisible();
});

test('runs an analysis, renders source-data charts, and evaluates recorded output at mobile width', async ({ page }) => {
  await page.setViewportSize({ width: 350, height: 850 });
  await page.goto('/relayops/');
  await page.getByLabel('Workflow template').selectOption('data-analyst');
  await launch(page);
  await expect(detail(page).locator('.execution-header .status-chip')).toHaveText('Completed');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(350);
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('link', { name: 'Reports', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Execution charts' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download', exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('link', { name: 'Evaluation Lab' }).click();
  await page.getByRole('button', { name: 'Evaluate runs' }).click();
  await expect(page.getByRole('heading', { name: /checks passed/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(350);
});


test('creates and reopens a versioned custom workflow after reload', async ({ page }) => {
  await page.goto('/relayops/');
  await page.getByLabel('Workflow template').selectOption('__new');
  await page.getByLabel('Workflow name').fill('Custom review');
  await page.getByRole('button', { name: 'Save version' }).click();
  await expect(page.getByRole('status')).toHaveText('Version 1 saved.');
  await page.reload();
  await page.locator('.studio-details summary').filter({ hasText: /Versions/ }).click();
  await page.getByLabel('Load saved workflow').selectOption({ label: 'Custom review · version 1' });
  await expect(page.getByLabel('Workflow name')).toHaveValue('Custom review');
  await expect(page.getByRole('button', { name: 'Load version 1' })).toBeVisible();
});


test('runs both research and GitHub review templates with labeled sample evidence', async ({ page }) => {
  await page.goto('/relayops/');
  await page.getByLabel('Workflow template').selectOption('research-pipeline');
  await launch(page);
  await expect(detail(page).locator('.execution-header .status-chip')).toHaveText('Completed');
  await expect(detail(page).getByRole('heading', { name: 'Execution artifacts' })).toBeVisible();
  await page.getByRole('button', { name: 'Open Workflow Studio' }).click();
  await page.getByLabel('Workflow template').selectOption('github-review');
  await launch(page);
  await expect(detail(page).locator('.execution-header .status-chip')).toHaveText('Completed');
  await expect(detail(page).getByRole('heading', { name: 'Execution artifacts' })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Execution history' }).getByRole('button')).toHaveCount(2);
});
