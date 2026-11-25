import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const replay = (page) => page.getByRole('region', { name: 'Incident replay' });

test('records an incident, links a separate PowerOps confirmation, and replays an isolated export', async ({ page, browser }) => {
  await page.goto('/lab/infrapilot-ai');
  await replay(page).getByRole('button', { name: 'Start incident recording' }).click();
  await expect(replay(page).getByRole('button', { name: 'Stop recording' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Scenario', exact: true }).selectOption('warning');
  await page.getByRole('combobox', { name: 'Scenario', exact: true }).selectOption('critical');
  await page.getByRole('button', { name: 'Advance 15 min' }).click();
  await page.getByLabel('Ask about the laboratory').fill('Recommend actions to resolve the simulated incident.');
  await page.getByRole('button', { name: 'Run infrastructure query' }).click();
  await expect(replay(page).getByRole('button', { name: /Analysis and recommendations critical · step 1/ })).toBeVisible();
  await page.getByRole('button', { name: 'Prepare handoff' }).click();
  await page.getByRole('button', { name: 'Approve handoff' }).click();
  await expect(replay(page).getByRole('button', { name: /Handoff decision denied/ })).toBeVisible();
  await page.getByRole('combobox', { name: 'Demo reviewer role' }).selectOption('operator');
  await page.getByRole('button', { name: 'Approve handoff' }).click();
  const handoff = page.getByRole('link', { name: 'Review selected outlet in PowerOps' });
  await expect(handoff).toHaveAttribute('href', /scenario=critical&step=1&incident=.*&handoff=/);
  await handoff.click();
  await expect(page.getByText('Incident recording linked')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reboot', exact: true })).toBeDisabled();
  await page.getByRole('combobox', { name: 'Demo role' }).selectOption('operator');
  await page.getByRole('button', { name: 'Reboot', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm reboot' }).click();
  await expect(page.getByRole('button', { name: 'Reboot', exact: true })).toBeEnabled({ timeout: 7000 });
  await page.getByRole('link', { name: 'Return to incident replay' }).click();
  await expect(replay(page).getByRole('button', { name: /PowerOps simulated action confirmed/ })).toBeVisible();
  await expect(replay(page).getByRole('button', { name: /Outlet reboot completed/ })).toBeVisible();
  await page.getByRole('combobox', { name: 'Scenario', exact: true }).selectOption('recovery');
  await replay(page).getByRole('button', { name: 'Stop recording' }).click();
  await expect(replay(page).getByRole('button', { name: 'Start incident recording' })).toBeVisible();
  await page.reload();
  await expect(replay(page).getByRole('button', { name: /Recording stopped/ })).toBeVisible();
  const pending = page.waitForEvent('download');
  await replay(page).getByRole('button', { name: 'Export replay JSON' }).click();
  const json = await readFile(await (await pending).path(), 'utf8');
  const trace = JSON.parse(json);
  const transitions = trace.events.filter(({ type }) => type === 'scenario.changed');
  expect(transitions.map(({ payload }) => [payload.from, payload.to])).toEqual([['normal', 'warning'], ['warning', 'critical'], ['critical', 'recovery']]);
  const approval = trace.events.find(({ type }) => type === 'handoff.approved');
  const power = trace.events.find(({ type }) => type === 'power.confirmed');
  expect(power.payload.handoffId).toBe(approval.payload.request.id);
  expect(power.payload.before.state).toBe('on');
  expect(power.payload.after.state).toBe('rebooting');
  expect(trace.events.find(({ type }) => type === 'telemetry.captured').payload.pdus.length).toBe(4);

  const reviewer = await browser.newPage({ viewport: { width: 320, height: 760 }, baseURL: new URL(page.url()).origin });
  try {
    await reviewer.goto('/lab/infrapilot-ai#incident-replay');
    const file = replay(reviewer).getByLabel('Open replay file');
    await file.setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
    await expect(replay(reviewer).getByRole('status')).toContainText('Unsupported or incomplete');
    await file.setInputFiles({ name: 'incident.json', mimeType: 'application/json', buffer: Buffer.from(json) });
    await expect(replay(reviewer).getByRole('status')).toContainText('read-only');
    await replay(reviewer).getByRole('button', { name: /Analysis and recommendations/ }).click();
    await expect(replay(reviewer).getByRole('heading', { name: 'Latest recorded recommendations' })).toBeVisible();
    await expect(replay(reviewer).getByText('critical · 1', { exact: true })).toBeVisible();
    await replay(reviewer).getByRole('button', { name: 'Play replay' }).click();
    await expect(replay(reviewer).getByRole('button', { name: 'Pause replay' })).toBeVisible();
    await replay(reviewer).getByRole('button', { name: 'Pause replay' }).click();
    expect(await reviewer.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  } finally { await reviewer.close(); }
});
