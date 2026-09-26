import { test, expect } from '@playwright/test';
import { registerBrowserAccount } from './auth-helper';
test.beforeEach(async ({ page }) => {
  await registerBrowserAccount(page);
  await page.route('**/api/smart-wallet-leaderboard', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Nansen API is not configured.' }),
    }),
  );
});
const stations = ['Waiting room', 'Counter', 'Tea table', 'Host', 'Shelf'];
test('all directed station transitions and rapid interruptions preserve navigation', async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.locator('canvas').waitFor();
  const nav = page.getByRole('navigation', { name: 'Tea room stations' });
  for (const from of stations)
    for (const to of stations) {
      if (from === to) continue;
      await nav.getByRole('button', { name: new RegExp(from) }).click();
      await page.waitForTimeout(150);
      await nav.getByRole('button', { name: new RegExp(to) }).click();
      await page.waitForTimeout(150);
      await expect(
        nav.getByRole('button', { name: new RegExp(to) }),
      ).toHaveAttribute('aria-current', 'step');
    }
  for (const station of [
    'Shelf',
    'Counter',
    'Host',
    'Waiting room',
    'Tea table',
    'Shelf',
    'Counter',
  ]) {
    await nav.getByRole('button', { name: new RegExp(station) }).click();
    await page.waitForTimeout(70);
  }
  await expect(page.getByLabel('Your finished thesis')).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(1);
  expect(errors).toEqual([]);
});
test('motion override stops HTML animation and pours remain interruptible', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.clock.install();
  await page.goto('/');
  await page.locator('canvas').waitFor();
  await page
    .getByRole('combobox', { name: 'Motion preference' })
    .selectOption('reduce');
  await expect(page.locator('main')).toHaveAttribute('data-motion', 'reduce');
  for (let round = 0; round < 2; round++) {
    await page
      .getByRole('button', { name: 'Load sample', exact: true })
      .click();
    if (round === 0) {
      const now = await page.evaluate(() => Date.now());
      await page.clock.pauseAt(now + 10_000);
    }
    await page.getByRole('button', { name: 'Pour', exact: true }).click();
    if (round === 0) {
      await page.getByRole('button', { name: 'Cancel review' }).click();
      await page.clock.resume();
      await page
        .getByRole('navigation')
        .getByRole('button', { name: /Host/ })
        .click();
      await page
        .getByRole('navigation')
        .getByRole('button', { name: /Counter/ })
        .click();
    } else {
      await page
        .getByRole('navigation')
        .getByRole('button', { name: /Host/ })
        .click();
      await page
        .getByRole('navigation')
        .getByRole('button', { name: /Tea table/ })
        .click();
      await expect(
        page.getByRole('heading', { name: 'A little clarity, with your tea.' }),
      ).toBeVisible();
    }
  }
  expect(
    await page
      .locator('.result-reading')
      .evaluate((el) => el.getAnimations({ subtree: true }).length),
  ).toBe(0);
  await page
    .getByRole('button', { name: 'Inspect evidence · DEMO-E-01' })
    .click();
  expect(
    await page
      .getByRole('dialog')
      .evaluate((el) => el.getAnimations({ subtree: true }).length),
  ).toBe(0);
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: 'Inspect evidence · DEMO-E-01' }),
  ).toBeFocused();
  await page
    .getByRole('combobox', { name: 'Motion preference' })
    .selectOption('full');
  await expect(page.locator('main')).toHaveAttribute('data-motion', 'full');
});
test('explicit Full motion can override an OS reduced-motion preference', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByLabel('Your finished thesis')).toBeVisible();
  await expect(page.locator('main')).toHaveAttribute('data-motion', 'reduce');
  await page
    .getByRole('combobox', { name: 'Motion preference' })
    .selectOption('full');
  await page
    .getByRole('navigation')
    .getByRole('button', { name: /Host/ })
    .click();
  expect(
    await page
      .locator('.reading-panel')
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe('paper-arrive');
  await page
    .getByRole('combobox', { name: 'Motion preference' })
    .selectOption('reduce');
  expect(
    await page
      .locator('.reading-panel')
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe('none');
});
