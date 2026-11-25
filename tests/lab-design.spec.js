import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('RackOps links room, rack, rear PDU and filtered equipment selection', async ({ page }) => {
  await page.goto('/lab/rackops');
  await page.getByLabel('Scenario').selectOption('critical');
  await page.getByRole('button', { name: /^Rack 2/ }).click();
  await expect(page.getByText(/Ambient temperature recorded/)).toBeVisible();
  await page.getByRole('button', { name: 'Rear', exact: true }).click();
  await page.getByRole('button', { name: /Select Metered PDU 2/ }).click();
  await expect(page.getByRole('heading', { name: 'Metered PDU 2' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Phase' })).toBeVisible();
  await page.getByLabel('Equipment type').selectOption('switch');
  await page.getByRole('button', { name: 'Top-of-rack switch 4', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Rack 4 rack model' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Top-of-rack switch 4' })).toBeVisible();
});

test('FabricLab edits ports, checks VLAN conflicts and round-trips JSON', async ({ page }) => {
  await page.goto('/lab/fabriclab');
  await expect(page.getByText('6 cables · 300 Gbps installed link capacity')).toBeVisible();
  await page.getByRole('button', { name: 'Add server' }).click();
  const added = page.getByRole('button', { name: /Server 6, Server/ });
  await added.focus();
  const before = await added.getAttribute('style');
  await added.press('ArrowRight');
  await expect(added).not.toHaveAttribute('style', before);
  await page.getByRole('button', { name: 'Edit cable-2', exact: true }).click();
  await page.getByLabel('From port').fill('1');
  await page.getByLabel('VLAN IDs').fill('999');
  await page.getByRole('button', { name: 'Save cable' }).click();
  await expect(page.getByText(/port 1 is assigned/)).toBeVisible();
  await expect(page.getByText(/undefined VLAN 999/)).toBeVisible();
  await page.getByRole('button', { name: 'Remove cable-5', exact: true }).click();
  await expect(page.getByText(/Single points of failure are cable-2, cable-6/)).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export topology JSON' }).click();
  const topology = await readFile(await (await downloadPromise).path());
  await page.getByRole('button', { name: 'Load InfiniBand example' }).click();
  await expect(page.getByText('4 cables · 800 Gbps installed link capacity')).toBeVisible();
  await page.getByLabel('Import topology JSON').setInputFiles({ name: 'topology.json', mimeType: 'application/json', buffer: topology });
  await expect(page.getByText('5 cables · 200 Gbps installed link capacity')).toBeVisible();
  await expect(page.getByText(/undefined VLAN 999/)).toBeVisible();
});

test('StorageCalc recalculates placement and exports the selected plan', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/lab/storagecalc');
  await page.getByLabel('Storage nodes').fill('6');
  await page.getByLabel('Failed nodes').fill('2');
  const failedLayout = page.getByRole('row').filter({ hasText: 'Erasure coding 4+2' }).filter({ hasText: 'After failure' });
  await expect(failedLayout).toContainText('Insufficient domains');
  await expect(failedLayout).toContainText('Unavailable');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export calculation report' }).click();
  const report = JSON.parse(await readFile(await (await downloadPromise).path(), 'utf8'));
  expect(report.plan.nodes).toBe(6);
  expect(report.results[1].failed.theoreticalTB).toBe(576);
  expect(report.results[1].failed.planningTB).toBeNull();
  await page.getByLabel('Failed nodes').fill('7');
  await expect(page.getByRole('alert')).toContainText('Failed nodes cannot exceed installed nodes');
  await expect(page.getByRole('button', { name: 'Export calculation report' })).toBeDisabled();
});
