import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test('RackOps traces rack space, accelerator alerts and a PDU dependency into PowerOps', async ({ page }) => {
  await page.goto('/lab/rackops?scenario=critical&step=3');
  await page.getByRole('button', { name: /^Rack 2/ }).click();
  await page.getByText('Rack space assessment', { exact: true }).click();
  await expect(page.getByText(/12U free · 5U largest contiguous space/)).toBeVisible();
  await expect(page.getByText(/SIM-S05-GPU2 · GPU temperature recorded/)).toBeVisible();
  await page.getByRole('button', { name: 'Rear', exact: true }).click();
  await page.getByRole('button', { name: /Select Metered PDU 2/ }).click();
  await page.getByText('Power dependencies', { exact: true }).click();
  await expect(page.getByText(/Guests: lab-vm-5/)).toBeVisible();
  await page.getByRole('link', { name: 'Open outlet 1 in PowerOps', exact: true }).click();
  await expect(page).toHaveURL(/scenario=critical&step=3&outlet=SIM-P2-O01/);
  await expect(page.getByRole('heading', { name: 'PowerOps', exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Demo role', exact: true })).toHaveValue('viewer');
});

test('GPUWatch recalculates per-GPU exposure after a threshold change', async ({ page }) => {
  await page.goto('/lab/gpuwatch?scenario=critical');
  await page.getByRole('combobox', { name: 'Server', exact: true }).selectOption('SIM-S05');
  await page.getByRole('combobox', { name: 'GPU', exact: true }).selectOption('SIM-S05-GPU2');
  await page.getByText('View per-GPU warning history', { exact: true }).click();
  const table = page.getByRole('region', { name: 'GPU warning exposure table' });
  await expect(table.getByRole('row')).toHaveCount(2);
  await expect(table.getByRole('cell', { name: '24 / 24', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Warning thresholds' }).click();
  await page.getByLabel('GPU temperature (°C)').fill('120');
  await page.getByLabel('VRAM utilization (%)').fill('100');
  await page.getByLabel('CPU utilization (%)').fill('100');
  await page.getByRole('button', { name: 'Apply thresholds' }).click();
  await expect(table.getByRole('cell', { name: '0 / 24', exact: true })).toBeVisible();
});

test('PowerOps exports only confirmed actions with before and after state', async ({ page }) => {
  await page.goto('/lab/powerops?scenario=critical&step=12&outlet=SIM-P2-O01');
  await expect(page.getByRole('button', { name: 'Export session audit CSV' })).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Demo role', exact: true }).selectOption('operator');
  await page.getByRole('button', { name: 'Turn off', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm off', exact: true }).click();
  const table = page.getByRole('region', { name: 'Audit history table' });
  await expect(table.getByRole('cell', { name: 'on → off', exact: true })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export session audit CSV' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('powerops-session-audit.csv');
  const csv = await readFile(await file.path(), 'utf-8');
  expect(csv).toContain('"critical","12","SIM-P2","SIM-P2-O01","Turn off","operator","on","off"');
});

test('VirtScan restores a pinned baseline across reload and exports the drift report', async ({ page }) => {
  await page.goto('/lab/virtscan');
  const region = page.getByRole('region', { name: 'Inventory baseline' });
  await region.getByRole('button', { name: 'Pin current inventory' }).click();
  await page.getByRole('combobox', { name: 'Scenario', exact: true }).selectOption('critical');
  await page.getByRole('button', { name: 'Synchronize inventory' }).click();
  await page.reload();
  await expect(region.getByText(/Baseline normal · step 0 → synchronized critical · step 0/)).toBeVisible();
  await expect(region.getByRole('region', { name: 'Baseline difference table' }).getByText('online → offline', { exact: true })).toBeVisible();
  const download = page.waitForEvent('download');
  await region.getByRole('button', { name: 'Export baseline diff CSV' }).click();
  const csv = await readFile(await (await download).path(), 'utf-8');
  expect(csv).toContain('"normal","0","critical","0","SIM-S08"');
  await region.getByRole('button', { name: 'Clear baseline' }).click();
  await page.reload();
  await expect(region.getByRole('button', { name: 'Pin current inventory' })).toBeVisible();
});
