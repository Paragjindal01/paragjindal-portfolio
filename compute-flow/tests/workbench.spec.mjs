import { expect, test } from '@playwright/test';
import { CLUSTER_PRESETS, generateWorkload, simulate } from '../src/core/simulator.mjs';

const workbench = process.env.COMPUTEFLOW_TEST_URL || '/';

test('runs an edited workload and compares four policies against the same inputs', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(workbench);
  await expect(page.getByRole('heading', { level: 1, name: 'GPU scheduling workbench' })).toBeVisible();
  await page.getByLabel('Cluster preset').selectOption('meridian');
  await page.getByLabel('Seed', { exact: true }).fill('165');
  await page.getByLabel('Jobs', { exact: true }).fill('18');
  await page.getByLabel('Placement').selectOption('first-fit');
  await page.getByRole('button', { name: 'Run simulation' }).click();
  await expect(page.getByText(/18 jobs · seed 165/)).toBeVisible();
  await expect(page.getByText('Meridian Training Cluster', { exact: true }).last()).toBeVisible();
  await page.getByRole('button', { name: 'Compare policies', exact: true }).click();
  const comparison = page.getByRole('region', { name: 'Policy comparison' });
  await expect(comparison.getByRole('table')).toBeVisible();
  for (const name of ['FIFO', 'Priority', 'Fair share', 'FIFO + backfill']) {
    await expect(comparison.getByRole('button', { name, exact: true })).toBeVisible();
  }
  await expect(comparison.getByRole('rowheader', { name: 'P95 wait' })).toBeVisible();
  await comparison.getByRole('button', { name: 'Fair share', exact: true }).click();
  await expect(page.getByLabel('Dispatch policy')).toHaveValue('fair-share');
  await comparison.getByLabel('Recommend a policy').check();
  await expect(comparison.getByText(/Scoring weights completions/)).toBeVisible();
  expect(errors).toEqual([]);
});

test('steps through a recorded GPU outage and changes the resource chart', async ({ page }) => {
  const cluster = CLUSTER_PRESETS[0];
  const expected = simulate({
    cluster,
    jobs: generateWorkload({ seed: 42, count: 32 }),
    failures: [{ gpuId: cluster.nodes[0].gpus[0].id, at: 18, duration: 12 }],
  });
  const outage = expected.series.findIndex(({ time }) => time === 18);
  expect(outage).toBeGreaterThan(0);
  await page.goto(workbench);
  const slider = page.getByRole('slider', { name: 'Simulation time' });
  await slider.focus();
  await slider.press('Home');
  for (let index = 0; index < outage; index += 1) await slider.press('ArrowRight');
  await expect(slider).toHaveValue(String(outage));
  const timeline = page.getByRole('region', { name: 'Workload timeline' });
  await expect(timeline.getByText(/GPU (failed|failure|offline)/i)).toBeVisible();
  await page.getByRole('button', { name: 'Next event' }).click();
  await expect(slider).toHaveValue(String(outage + 1));
  await slider.press('End');
  await expect(page.getByRole('region', { name: 'Queue at this time' })).toContainText('No jobs are waiting');
  const resources = page.getByRole('region', { name: 'Resource utilization' });
  await resources.getByRole('button', { name: 'Power' }).click();
  await expect(resources.getByRole('img', { name: /Power draw over/ })).toBeVisible();
});

test('shows invalid resource budgets and stays usable at 320 pixels', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await page.goto(workbench);
  await page.getByLabel('Cluster power cap').fill('1');
  await page.getByRole('button', { name: 'Run simulation' }).click();
  await expect(page.getByRole('alert')).toContainText('Cluster power cap');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByRole('button', { name: 'Compare policies', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Policy comparison' }).getByRole('table')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Workload timeline' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});
