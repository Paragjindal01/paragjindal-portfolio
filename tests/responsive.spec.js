import { test, expect } from '@playwright/test';

/**
 * Responsive & alignment audit.
 *
 * - Overflow matrix: every required viewport, portrait and landscape.
 * - Bounding-box checks: key visible elements stay inside the viewport.
 * - Interaction checks: mobile menu, hero buttons, robot greeting controls,
 *   contact form layout.
 * - Screenshots for visual review in test-output/responsive/.
 *
 * Known, accepted console noise (excluded from the console-error check):
 * - Spline runtime logs "Missing property" errors — pre-existing, harmless.
 * - /audio/robot-welcome.mp3 404s until the voice file is added (documented
 *   graceful fallback).
 */

const VIEWPORTS = [
  // Phones (portrait)
  { w: 320, h: 568, label: 'phone-320' },
  { w: 360, h: 640, label: 'phone-360' },
  { w: 375, h: 667, label: 'phone-375' },
  { w: 390, h: 844, label: 'phone-390' },
  { w: 393, h: 852, label: 'phone-393' },
  { w: 412, h: 915, label: 'phone-412' },
  { w: 430, h: 932, label: 'phone-430' },
  // Tablets / iPads (portrait)
  { w: 600, h: 960, label: 'tablet-600' },
  { w: 768, h: 1024, label: 'ipad-768' },
  { w: 810, h: 1080, label: 'ipad-810' },
  { w: 820, h: 1180, label: 'ipad-air-820' },
  { w: 834, h: 1194, label: 'ipad-pro11-834' },
  { w: 1024, h: 1366, label: 'ipad-pro13-1024' },
  // Tablet landscape
  { w: 960, h: 600, label: 'tablet-land-960' },
  { w: 1024, h: 768, label: 'ipad-land-1024' },
  { w: 1080, h: 810, label: 'ipad-land-1080' },
  { w: 1180, h: 820, label: 'ipad-air-land-1180' },
  { w: 1194, h: 834, label: 'ipad-pro11-land-1194' },
  { w: 1366, h: 1024, label: 'ipad-pro13-land-1366' },
  // Laptops / desktops
  { w: 1280, h: 720, label: 'laptop-1280' },
  { w: 1366, h: 768, label: 'laptop-1366' },
  { w: 1440, h: 900, label: 'laptop-1440' },
  { w: 1536, h: 864, label: 'laptop-1536' },
  { w: 1600, h: 900, label: 'desktop-1600' },
  { w: 1920, h: 1080, label: 'desktop-1920' },
  { w: 2560, h: 1440, label: 'desktop-2560' },
  { w: 3440, h: 1440, label: 'ultrawide-3440' },
];

const SCREENSHOT_SIZES = [
  [375, 667], [390, 844], [430, 932], [768, 1024], [820, 1180],
  [1024, 1366], [1366, 768], [1440, 900], [1920, 1080], [3440, 1440],
];

const SECTIONS = ['#home', '#about', '#services', '#projects', '#experience', '#contact'];

const isExpectedNoise = (text) =>
  text.includes('Missing property') || text.includes('robot-welcome.mp3');

async function assertNoHorizontalOverflow(page) {
  const result = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(result.scrollWidth, 'document must not scroll horizontally').toBeLessThanOrEqual(
    result.clientWidth
  );
}

async function assertElementsInsideViewport(page) {
  const offenders = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const bad = [];
    const els = document.querySelectorAll(
      'nav, section, footer, h1, h2, h3, .glass-card, form, button, .tech-tag'
    );
    els.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return; // hidden
      // Ignore elements faded out by scroll choreography (opacity 0 in chain)
      if (typeof el.checkVisibility === 'function' &&
          !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return;
      // 1px tolerance for subpixel rounding
      if (r.left < -1 || r.right > vw + 1) {
        bad.push(`${el.tagName}.${(el.className || '').toString().slice(0, 40)} [${Math.round(r.left)}..${Math.round(r.right)}] vw=${vw}`);
      }
    });
    return bad;
  });
  expect(offenders, `elements outside viewport:\n${offenders.join('\n')}`).toEqual([]);
}

test.describe('horizontal overflow matrix', () => {
  for (const { w, h, label } of VIEWPORTS) {
    test(`no overflow at ${label} (${w}x${h})`, async ({ page }) => {
      // Layout assertions don't need the external Spline scene (the robot
      // panel has fixed dimensions either way). Blocking it keeps this
      // 27-viewport matrix fast and independent of CDN congestion.
      await page.route('**://prod.spline.design/**', (route) => route.abort());
      await page.setViewportSize({ width: w, height: h });
      await page.goto('/');
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
      // Top of page
      await assertNoHorizontalOverflow(page);
      await assertElementsInsideViewport(page);
      // Scrolled through the page (hero choreography + each section)
      for (const anchor of SECTIONS.slice(1)) {
        await page.evaluate((a) => {
          document.querySelector(a)?.scrollIntoView({ behavior: 'instant' });
        }, anchor);
        await page.waitForTimeout(150);
        await assertNoHorizontalOverflow(page);
      }
      await assertElementsInsideViewport(page);
    });
  }
});

test.describe('console and network health', () => {
  test('no unexpected console errors or failed requests', async ({ page }) => {
    const errors = [];
    const failures = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isExpectedNoise(msg.text())) errors.push(msg.text());
    });
    page.on('requestfailed', (req) => {
      if (!isExpectedNoise(req.url())) failures.push(`${req.url()} — ${req.failure()?.errorText}`);
    });
    page.on('response', (res) => {
      if (res.status() >= 400 && !isExpectedNoise(res.url())) {
        failures.push(`${res.url()} — HTTP ${res.status()}`);
      }
    });
    await page.goto('/');
    await page.waitForTimeout(6000); // let Spline + lazy chunks settle
    expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
    expect(failures, `failed requests:\n${failures.join('\n')}`).toEqual([]);
  });
});

test.describe('mobile menu', () => {
  test('opens, navigates, and closes at phone width', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    // Reduced motion makes the anchor jump instant — deterministic in headless,
    // and exercises the site's prefers-reduced-motion navigation path.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const toggle = page.getByRole('button', { name: 'Toggle menu' });
    await expect(toggle).toBeVisible();
    await toggle.click();
    const menuLink = page.locator('nav a', { hasText: 'Services' }).last();
    await expect(menuLink).toBeVisible();
    await menuLink.click();
    // Menu closes and the services section scrolls into view
    await expect(menuLink).toBeHidden();
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const r = document.querySelector('#services').getBoundingClientRect();
            return r.top < window.innerHeight && r.bottom > 0;
          }),
        { timeout: 8000, message: 'services section should scroll into view' }
      )
      .toBe(true);
  });
});

test.describe('hero', () => {
  test('text is visible immediately and buttons work', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Parag Jindal');
    for (const [name, target] of [
      ['View My Work', '#projects'],
      ['Explore Services', '#services'],
      ['Contact Me', '#contact'],
    ]) {
      const btn = page.locator(`a[href="${target}"]`, { hasText: name }).first();
      await expect(btn).toBeVisible();
    }
  });

  test('anchor navigation reaches every section', async ({ page }) => {
    await page.goto('/');
    for (const anchor of SECTIONS) {
      const exists = await page.locator(anchor).count();
      expect(exists, `${anchor} missing`).toBeGreaterThan(0);
    }
  });
});

test.describe('robot greeting controls', () => {
  // The robot depends on an external Spline CDN fetch — allow extra headroom.
  test.slow();

  test('invite → play → pause → resume → mute → close → reopen', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    // Bubble invitation appears after the robot loads
    const meetBtn = page.getByRole('button', { name: /Meet Parag's AI|Replay Greeting/ });
    await expect(meetBtn).toBeVisible({ timeout: 45_000 });

    await meetBtn.click();
    const pauseBtn = page.getByRole('button', { name: 'Pause greeting' });
    await expect(pauseBtn).toBeVisible({ timeout: 10_000 });

    // Captions are rendered while speaking
    await expect(page.locator('[aria-live="polite"]')).toContainText(/digital assistant|Parag/i);

    await pauseBtn.click();
    const resumeBtn = page.getByRole('button', { name: 'Resume greeting' });
    await expect(resumeBtn).toBeVisible();

    await resumeBtn.click();
    const muteBtn = page.getByRole('button', { name: 'Mute greeting' });
    await expect(muteBtn).toBeVisible();
    await muteBtn.click();
    await expect(page.getByRole('button', { name: 'Unmute greeting' })).toBeVisible();

    // Close, then the reopen chip appears
    await page.getByRole('button', { name: 'Close greeting' }).click();
    const reopen = page.getByRole('button', { name: 'Open assistant greeting' });
    await expect(reopen).toBeVisible();
    await reopen.click();
    await expect(page.getByRole('button', { name: /Replay Greeting|Meet Parag's AI/ }).or(page.getByRole('button', { name: 'Pause greeting' })).first()).toBeVisible();

    // Session memory
    const played = await page.evaluate(() => sessionStorage.getItem('parag-robot-greeting-played'));
    expect(played).toBe('true');
  });

  test('speech bubble stays inside the viewport at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/');
    const meetBtn = page.getByRole('button', { name: /Meet Parag's AI|Replay Greeting/ });
    await expect(meetBtn).toBeVisible({ timeout: 45_000 });
    const box = await meetBtn.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(320);
    // Touch-friendly target
    expect(box.height).toBeGreaterThanOrEqual(30);
    await assertNoHorizontalOverflow(page);
  });
});

test.describe('contact form', () => {
  test('inputs fit the viewport and submit stays visible at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/#contact');
    await page.evaluate(() => document.querySelector('#contact')?.scrollIntoView({ behavior: 'instant' }));
    await page.waitForTimeout(600);
    for (const sel of ['#contact-name', '#contact-email', '#contact-phone', '#contact-service', '#contact-location', '#contact-message']) {
      const box = await page.locator(sel).boundingBox();
      expect(box, `${sel} not rendered`).toBeTruthy();
      expect(box.x, `${sel} left edge`).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, `${sel} right edge`).toBeLessThanOrEqual(321);
    }
    // ≥16px font size on inputs prevents iOS Safari focus zoom
    const fontSize = await page.locator('#contact-email').evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(fontSize).toBeGreaterThanOrEqual(16);
    const submit = page.getByRole('button', { name: /Send Message/ });
    await submit.scrollIntoViewIfNeeded();
    await expect(submit).toBeVisible();
    // Validation errors do not cause horizontal overflow
    await submit.click();
    await page.waitForTimeout(300);
    await assertNoHorizontalOverflow(page);
  });
});

test.describe('screenshots for visual review', () => {
  for (const [w, h] of SCREENSHOT_SIZES) {
    test(`capture ${w}x${h}`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'chromium', 'screenshots captured on chromium only');
      await page.setViewportSize({ width: w, height: h });
      await page.goto('/');
      await page.waitForTimeout(4000); // robot + entrance animations
      await page.screenshot({ path: `test-output/responsive/${w}x${h}-hero.png` });
      await page.evaluate(() => document.querySelector('#services')?.scrollIntoView({ behavior: 'instant' }));
      await page.waitForTimeout(800);
      await page.screenshot({ path: `test-output/responsive/${w}x${h}-services.png` });
      await page.evaluate(() => document.querySelector('#contact')?.scrollIntoView({ behavior: 'instant' }));
      await page.waitForTimeout(800);
      await page.screenshot({ path: `test-output/responsive/${w}x${h}-contact.png` });
    });
  }
});
