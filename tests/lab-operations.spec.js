import { expect, test } from '@playwright/test';

test('GPUWatch filters a critical scenario, updates thresholds and exports telemetry', async ({ page }) => {
  await page.goto('/lab/gpuwatch');
  await expect(page.getByRole('heading', { name: 'GPUWatch' })).toBeVisible();
  await page.getByLabel('Scenario').selectOption('critical');
  await page.getByRole('combobox', { name: 'Server', exact: true }).selectOption('SIM-S05');
  await page.getByRole('combobox', { name: 'GPU', exact: true }).selectOption('SIM-S05-GPU2');
  const table = page.getByRole('region', { name: 'Equipment telemetry table' });
  await expect(table.getByRole('row')).toHaveCount(2);
  await expect(table.getByText(/GPU temperature/)).toBeVisible();
  await page.getByRole('button', { name: 'Warning thresholds' }).click();
  await page.getByLabel('GPU temperature (°C)').fill('120');
  await page.getByLabel('VRAM utilization (%)').fill('100');
  await page.getByLabel('CPU utilization (%)').fill('100');
  await page.getByRole('button', { name: 'Apply thresholds' }).click();
  await expect(table.getByText('Within thresholds')).toBeVisible();
  await page.getByLabel('Chart metric').selectOption('vram');
  await expect(page.getByRole('img', { name: /VRAM utilization/ })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export report CSV' }).click();
  expect((await download).suggestedFilename()).toBe('gpuwatch-critical.csv');
});

test('PowerOps blocks viewers and records confirmed simulated outlet commands', async ({ page }) => {
  await page.goto('/lab/powerops?scenario=critical&outlet=SIM-P2-O01');
  await expect(page.getByRole('heading', { name: 'PowerOps' })).toBeVisible();
  await expect(page.getByText('SIM-P2-O01', { exact: true })).toBeVisible();
  const turnOff = page.getByRole('button', { name: 'Turn off', exact: true });
  await expect(turnOff).toBeDisabled();
  await page.getByLabel('Demo role').selectOption('operator');
  await turnOff.click();
  const dialog = page.getByRole('dialog', { name: 'Confirm simulated action' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(turnOff).toBeEnabled();
  await turnOff.click();
  await dialog.getByRole('button', { name: 'Confirm off' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'recorded for SIM-P2-O01' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Audit history table' }).getByText('Turn off')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Turn on', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Simulate phase balancing' }).click();
  await expect(page.getByRole('button', { name: 'Hide proposed balance' })).toBeVisible();
});

test('VirtScan synchronizes the selected scenario, filters and exports inventory', async ({ page }) => {
  await page.goto('/lab/virtscan');
  await expect(page.getByRole('heading', { name: 'VirtScan' })).toBeVisible();
  await page.getByLabel('Scenario').selectOption('critical');
  await page.getByRole('button', { name: 'Synchronize inventory' }).click();
  await expect(page.getByRole('heading', { name: 'Snapshot changes' })).toBeVisible();
  await expect(page.getByText('online → offline', { exact: true })).toBeVisible();
  await page.getByLabel('Asset type').selectOption('vm');
  await page.getByLabel('Search assets').fill('lab-vm-8');
  const table = page.getByRole('region', { name: 'Asset inventory table' });
  await expect(table.getByRole('row')).toHaveCount(2);
  await expect(table.getByText('stopped')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Network interfaces' })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON' }).click();
  expect((await download).suggestedFilename()).toBe('virtscan-critical.json');
});

test('Operational applications scroll tables locally on mobile and have no page errors', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const routes = [
    ['gpuwatch', 'Equipment telemetry table'],
    ['powerops', 'PDU inventory table'],
    ['virtscan', 'Asset inventory table'],
  ];
  for (const [route, table] of routes) {
    await page.goto('/lab/' + route);
    const region = page.getByRole('region', { name: table });
    await expect(region).toBeVisible();
    expect(await region.evaluate((node) => node.scrollWidth > node.clientWidth)).toBeTruthy();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  }
  expect(errors).toEqual([]);
});
