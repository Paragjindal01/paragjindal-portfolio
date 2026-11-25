import { createHmac } from 'node:crypto';
import { expect, test } from '@playwright/test';

test('registers a saved webhook revision, displays its signing secret once, receives and revokes the workflow', async ({ page }) => {
  await page.goto('/relayops/');
  await expect(page.getByText('Local service', { exact: true })).toBeVisible();
  await page.getByLabel('Workflow template').selectOption('__new');
  await page.getByLabel('Workflow name').fill('Local webhook fixture');
  const operation = page.getByRole('combobox', { name: 'Operation', exact: true });
  await operation.selectOption('webhook');
  await page.getByRole('button', { name: 'Save version' }).click();
  await expect(page.getByRole('status')).toHaveText('Version 1 saved.');
  await operation.selectOption('manual');
  await page.getByRole('button', { name: 'Save version' }).click();
  await expect(page.getByRole('status')).toHaveText('Version 2 saved.');

  await page.getByRole('link', { name: 'Integrations' }).click();
  const webhooks = page.getByRole('region', { name: 'Signed webhooks' });
  await webhooks.getByLabel('Webhook workflow').selectOption({ label: 'Local webhook fixture' });
  const revisions = webhooks.getByLabel('Webhook version');
  await revisions.selectOption('1');
  await expect(revisions.locator('option')).toHaveCount(2);
  await webhooks.getByRole('button', { name: 'Register webhook' }).click();
  await expect(webhooks.getByRole('status')).toHaveText('Webhook registered.');
  const secretNode = webhooks.locator('.webhook-secret code');
  await expect(secretNode).toBeVisible();
  const key = (await secretNode.textContent()).trim();
  expect(/^[a-zA-Z0-9_-]{43}$/.test(key)).toBe(true);
  const stored = await page.evaluate((value) => [localStorage, sessionStorage].some((storage) => Object.values(storage).some((item) => String(item).includes(value))), key);
  expect(stored).toBe(false);
  const address = (await webhooks.locator('.webhook-list code').textContent()).trim();
  const id = new URL(address).pathname.split('/').at(-2);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const delivery = 'webhook-browser-test';
  const body = JSON.stringify({ source: 'synthetic' });
  const signature = createHmac('sha256', Buffer.from(key, 'base64url')).update(`relayops-webhook-v1\n${id}\n${timestamp}\n${delivery}\n`).update(body).digest('hex');
  const submit = () => page.request.post(address, { headers: { 'Content-Type': 'application/json', 'X-RelayOps-Timestamp': timestamp, 'X-RelayOps-Signature': `sha256=${signature}`, 'Idempotency-Key': delivery }, data: body });
  expect((await submit()).status()).toBe(202);

  await page.reload();
  await expect(webhooks.locator('.webhook-list code')).toBeVisible();
  await expect(secretNode).toHaveCount(0);
  await webhooks.getByRole('button', { name: 'Revoke webhook' }).click();
  await webhooks.getByRole('button', { name: 'Confirm revoke' }).click();
  await expect(webhooks.getByRole('status')).toHaveText('Webhook revoked.');
  await expect(webhooks.getByText('No endpoints are registered for this session.')).toBeVisible();
  expect((await submit()).status()).toBe(401);
});
