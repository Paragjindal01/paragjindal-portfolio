import { test, expect } from '@playwright/test';
import { ALL_PROJECTS } from '../src/data/projects.mjs';

test('shows both confirmed AltaAI roles and preserves structured professional metadata', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#experience');
  const experience = page.locator('#experience');
  const altaai = experience.getByRole('article').filter({ has: page.getByRole('heading', { name: 'AltaAI Inc.', exact: true }) });
  await expect(altaai).toHaveCount(1);
  await expect(altaai).toContainText('AI & Information Systems Specialist');
  await expect(altaai).toContainText('September 2026 – Present');
  await expect(altaai).toContainText('Permanent full-time · On-site · Ottawa, Ontario, Canada');
  await expect(altaai).toContainText('AI Product Engineer');
  await expect(altaai).toContainText('May 2026 – September 2026');
  await expect(altaai).toContainText('Permanent part-time · Remote');
  await expect(experience.getByRole('heading', { name: 'Field Service Agent' })).toBeVisible();
  await expect(experience.locator('#education')).toContainText('Software Development specialization');
  const ld = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
  const person = ld['@graph'].find((entry) => entry['@type'] === 'Person');
  expect(person.hasOccupation.map(({ name }) => name)).toEqual(['AI & Information Systems Specialist', 'AI Product Engineer']);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('each published case-study route loads its evidence and points to a working project route', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/case-studies');
  await expect(page.getByRole('heading', { name: 'Engineering case studies' })).toBeVisible();
  await expect(page.locator('.case-study-index a')).toHaveCount(ALL_PROJECTS.length);
  for (const project of ALL_PROJECTS) {
    expect((await page.goto(project.links.caseStudy)).ok()).toBeTruthy();
    await expect(page.getByRole('heading', { level: 1, name: project.name, exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Verified workflows' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open demo' })).toHaveAttribute('href', project.links.demo);
    await expect(page.getByRole('link', { name: 'Source', exact: true })).toHaveAttribute('href', project.standaloneRepositoryUrl);
    await expect(page.getByRole('link', { name: 'Repository documentation' })).toHaveAttribute('href', project.links.documentation);
    await expect.poll(() => page.getByRole('img', { name: project.screenshot.alt }).evaluate((image) => image.naturalWidth)).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  }
});
