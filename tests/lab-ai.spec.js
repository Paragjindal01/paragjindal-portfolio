import { Buffer } from 'node:buffer';
import { expect, test } from '@playwright/test';

test('InfraPilot runs a critical query, schedules a report, and requires operator review for the PowerOps handoff', async ({ page }) => {
  await page.goto('/lab/infrapilot-ai?scenario=critical');
  await expect(page.getByRole('heading', { name: 'Infrastructure operations console' })).toBeVisible();
  const query = page.getByLabel('Ask about the laboratory');
  await query.fill('Are any GPUs exceeding their configured temperature thresholds?');
  await page.getByRole('button', { name: 'Run infrastructure query' }).click();
  await expect(page.getByRole('heading', { name: 'GPU temperature thresholds' })).toBeVisible();
  await expect(page.getByText(/4 of 16 GPUs meet or exceed/)).toBeVisible();

  await query.fill('Reboot the outlet');
  await page.getByRole('button', { name: 'Run infrastructure query' }).click();
  await expect(page.getByRole('alert')).toContainText('read-only');

  await page.getByRole('button', { name: 'Run health report now' }).click();
  await expect(page.getByRole('heading', { name: 'Infrastructure health report' })).toBeVisible();
  await page.clock.install();
  await page.getByLabel('Run cadence').selectOption('15');
  await page.clock.fastForward(15_050);
  await expect(page.getByText('Scheduled report', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Prepare handoff' }).click();
  await page.getByRole('button', { name: 'Approve handoff' }).click();
  await expect(page.getByText('The simulated operator role is required to review a handoff.', { exact: true }).first()).toBeVisible();
  await page.getByLabel('Demo reviewer role').selectOption('operator');
  await page.getByRole('button', { name: 'Approve handoff' }).click();
  const handoff = page.getByRole('link', { name: 'Review selected outlet in PowerOps' });
  await expect(handoff).toHaveAttribute('href', /^\/lab\/powerops\?outlet=.+&scenario=critical$/);
  await handoff.click();
  await expect(page).toHaveURL(/\/lab\/powerops\?outlet=.+&scenario=critical$/);
});

test('LocalMind loads, cites, imports, and evaluates documents in a mobile layout', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/lab/localmind');
  await expect(page.getByRole('heading', { name: 'Query the knowledge base' })).toBeVisible();
  await expect(page.getByText('Offline · Extractive answer')).toBeVisible();
  await page.getByRole('link', { name: 'Open source 1' }).first().click();
  await expect(page.locator('#localmind-source-1 details')).toHaveAttribute('open', '');

  await page.getByRole('button', { name: 'Run sample evaluation' }).click();
  await expect(page.getByText('100.0%')).toBeVisible();
  await page.getByLabel('Extract text from a file').setInputFiles({
    name: 'Fictional receiver notes.html',
    mimeType: 'text/html',
    buffer: Buffer.from('<article><p>Zephyr canary markers identify the new fictional receiver.</p><script>malicious_script_content</script></article>'),
  });
  await expect(page.getByLabel('Document text')).toHaveValue('Zephyr canary markers identify the new fictional receiver.');
  await page.getByRole('button', { name: 'Index document' }).click();
  await page.getByLabel('Question or search phrase').fill('zephyr canary');
  await page.getByRole('button', { name: 'Ask LocalMind' }).click();
  await expect(page.getByText('Zephyr canary markers identify the new fictional receiver.', { exact: false }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Remove Fictional receiver notes' }).click();
  await expect(page.getByText('No grounded answer available.', { exact: false })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Retrieval evaluation' })).toBeVisible();
});
