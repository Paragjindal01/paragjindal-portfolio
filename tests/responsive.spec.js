import { test, expect } from '@playwright/test';

// Portfolio layout and contact checks stay local. Live Spline tests load the
// existing external scene and can run separately from the main CI suite.

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

const SECTIONS = ['#home', '#lab', '#story', '#work', '#about', '#services', '#projects', '#software', '#experience', '#stack', '#github', '#contact'];
const ready = (page) => expect(page.getByRole('heading', { level: 1, name: 'Parag Jindal', exact: true })).toBeVisible();

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
      await page.setViewportSize({ width: w, height: h });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto('/');
      await ready(page);
      // Top of page
      await assertNoHorizontalOverflow(page);
      await assertElementsInsideViewport(page);
      // Exercise the layout throughout the page as lazy content loads.
      for (const anchor of SECTIONS.slice(1)) {
        await page.evaluate((a) => {
          document.querySelector(a)?.scrollIntoView({ behavior: 'instant' });
        }, anchor);
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
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('requestfailed', (req) => {
      failures.push(`${req.url()} — ${req.failure()?.errorText}`);
    });
    page.on('response', (res) => {
      if (res.status() >= 400) {
        failures.push(`${res.url()} — HTTP ${res.status()}`);
      }
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await ready(page);
    for (const screenshot of await page.locator('.higgsfield-home img[loading="lazy"]:visible').all()) {
      await screenshot.scrollIntoViewIfNeeded();
      await expect.poll(() => screenshot.evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
    }
    await page.waitForLoadState('networkidle');
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
    const menuLink = page.getByRole('navigation', { name: 'Portfolio' }).getByRole('link', { name: 'Expertise' });
    await expect(menuLink).toBeVisible();
    await menuLink.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
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
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await ready(page);
    const lab = page.locator('.scroll-scrub').getByRole('link', { name: 'Walk the lab', exact: true });
    await expect(lab).toHaveAttribute('href', '#lab');
    await expect(page.getByRole('link', { name: 'Open 3D greeting' })).toHaveAttribute('href', '/greeting');
    await expect.poll(() => page.locator('.scroll-scrub__poster').first().evaluate((image) => image.naturalWidth)).toBeGreaterThan(0);
    await lab.click();
    const openLab = page.getByRole('link', { name: 'Enter the full lab' });
    await expect(openLab).toHaveAttribute('href', '/lab');
    await openLab.click();
    await expect(page.getByRole('heading', { name: 'Engineering Lab', exact: true })).toBeVisible();
  });

  test('anchor navigation reaches every section', async ({ page }) => {
    await page.goto('/');
    await ready(page);
    for (const anchor of SECTIONS) {
      expect(await page.locator(anchor).count(), `Expected one target for ${anchor}`).toBe(1);
    }
  });

  test('phone starts buffering the second scene after the first swipe', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const clips = [];
    await page.route('**/assets/world/*.mp4', (route) => {
      clips.push(new URL(route.request().url()).pathname.split('/').at(-1));
      return route.abort();
    });

    await page.goto('/');
    await ready(page);
    const storyboard = page.locator('.scroll-scrub');
    await expect(storyboard).toHaveAttribute('data-active-section', '0');
    await expect.poll(() => clips).toEqual(['hall-01-mobile.mp4']);

    const secondScene = storyboard.locator('[data-scroll-scrub-band]').nth(1);
    await secondScene.evaluate((band) => {
      window.scrollTo({ top: band.getBoundingClientRect().top + window.scrollY - 0.8 * window.innerHeight, behavior: 'instant' });
    });
    await expect.poll(() => clips).toEqual(['hall-01-mobile.mp4', 'hall-02-mobile.mp4']);
    await expect(storyboard).toHaveAttribute('data-active-section', '0');
  });
});

test.describe('Live Spline greeting controls', () => {
  // The robot depends on an external Spline CDN fetch — allow extra headroom.
  test.slow();

  test('invite → play → pause → resume → mute → close → reopen', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    await page.getByRole('link', { name: 'Open 3D greeting' }).click();
    await expect(page.getByRole('heading', { name: 'Interactive 3D greeting' })).toBeVisible();
    // The invitation appears after the scene loads.
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
    await page.goto('/greeting');
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

test('contact form validates and sends the expected Web3Forms payload', async ({ page }) => {
  const messages = [];
  await page.route('https://api.web3forms.com/submit', async route => {
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type, accept',
      'access-control-allow-methods': 'POST, OPTIONS',
    };
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }
    messages.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, headers, json: { success: true } });
  });

  await page.goto('/#contact');
  const submit = page.getByRole('button', { name: /Send Message/ });
  await submit.click();
  await expect(page.getByRole('alert').filter({ hasText: 'Please enter your email address.' })).toBeVisible();
  expect(messages).toHaveLength(0);

  await page.locator('#contact-name').fill('Sample Visitor');
  await page.locator('#contact-email').fill('visitor@example.test');
  await page.locator('#contact-service').selectOption('AI or Automation');
  await page.locator('#contact-location').fill('Ottawa');
  await page.locator('#contact-message').fill('A synthetic portfolio test submission.');
  await submit.click();
  await expect(page.getByRole('status').filter({ hasText: /sent/i })).toBeVisible();
  await expect(page.locator('#contact-name')).toHaveValue('');
  expect(messages).toHaveLength(1);
  expect(messages[0]).toMatchObject({
    name: 'Sample Visitor',
    email: 'visitor@example.test',
    service: 'AI or Automation',
    location: 'Ottawa',
    preferred_contact: 'Email',
    message: 'A synthetic portfolio test submission.',
  });
});
