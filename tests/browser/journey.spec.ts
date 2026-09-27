import { test, expect } from '@playwright/test';
import { registerBrowserAccount } from './auth-helper';
test.beforeEach(async ({ page }) => {
  await registerBrowserAccount(page);
  await page.route('**/api/smart-wallet-leaderboard', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        entries: [],
        fetchedAt: '2026-09-25T12:00:00.000Z',
        expiresAt: '2099-09-25T12:30:00.000Z',
        source: 'nansen',
        stale: false,
      }),
    }),
  );
});
test('complete ritual twice, evidence, input preservation and Shelf navigation', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('main')).toHaveAttribute('data-station', 'Counter');
  await expect(
    page.getByRole('heading', { name: 'Pour what you have already written.' }),
  ).toBeVisible({ timeout: 15000 });
  for (let turn = 0; turn < 2; turn++) {
    await page
      .getByRole('button', { name: 'Load sample', exact: true })
      .click();
    const thesis = await page.getByLabel('Your finished thesis').inputValue();
    await page.getByRole('button', { name: 'Pour', exact: true }).click();
    await expect(page.locator('main')).toHaveAttribute(
      'data-station',
      'TeaTable',
    );
    await expect(
      page.getByRole('heading', { name: 'The tea is steeping.' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'A little clarity, with your tea.' }),
    ).toBeVisible({ timeout: 15_000 });
    await page
      .getByRole('button', { name: 'Inspect evidence · DEMO-E-01' })
      .click();
    await expect(page.getByRole('dialog')).toContainText('$1,200,000');
    await expect(page.getByRole('dialog')).toContainText('capped');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await page
      .getByRole('button', { name: 'Chat with Iroh', exact: true })
      .click();
    await expect(page.getByRole('heading', { name: 'Ask Iroh' })).toBeVisible();
    await page
      .getByRole('navigation', { name: 'Tea room stations' })
      .getByRole('button', { name: /Shelf/ })
      .click();
    await page.getByRole('button', { name: 'Approach the Shelf' }).click();
    await expect(
      page.getByRole('heading', {
        name: /Top 10 (?:Hyperliquid|HL) Leaderboard/,
      }),
    ).toBeVisible();
    await expect(page.getByTestId('leaderboard-parchment')).not.toContainText(
      thesis,
    );
    await page
      .getByRole('navigation', { name: 'Tea room stations' })
      .getByRole('button', { name: /Counter/ })
      .click();
    await expect(page.getByLabel('Your finished thesis')).toHaveValue(thesis);
  }
  expect(errors).toEqual([]);
});
test('keyboard forms, navigation, cancellation and reduced motion', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install();
  await page.goto('/');
  const thesis = page.getByLabel('Your finished thesis');
  await expect(thesis).toBeVisible();
  await thesis.fill('Short');
  await page.getByRole('button', { name: 'Pour', exact: true }).click();
  await expect(page.locator('#form-error')).toContainText('80');
  await expect(thesis).toHaveValue('Short');
  await page.getByRole('button', { name: 'Load sample', exact: true }).click();
  await thesis.focus();
  await page.keyboard.press('End');
  await page.keyboard.type(' wasd');
  await expect(
    page.getByRole('heading', { name: 'Pour what you have already written.' }),
  ).toBeVisible();
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 10_000);
  await page.getByRole('button', { name: 'Retry Pour', exact: true }).click();
  await expect(page.locator('main')).toHaveAttribute(
    'data-station',
    'TeaTable',
  );
  await page
    .getByRole('button', { name: 'Cancel review', exact: true })
    .click();
  await page.clock.resume();
  await page
    .getByRole('navigation', { name: 'Tea room stations' })
    .getByRole('button', { name: /Counter/ })
    .click();
  await expect(
    page.getByRole('button', { name: 'Pour', exact: true }),
  ).toBeEnabled();
  for (const name of [
    'Waiting room',
    'Tea table',
    'Host',
    'Shelf',
    'Counter',
  ]) {
    await page
      .getByRole('navigation', { name: 'Tea room stations' })
      .getByRole('button', { name: new RegExp(name) })
      .click();
    await expect(
      page
        .getByRole('navigation', { name: 'Tea room stations' })
        .getByRole('button', { name: new RegExp(name) }),
    ).toHaveAttribute('aria-current', 'step');
  }
  await expect(thesis).toHaveValue(/wasd$/);
});
test('manual navigation stays in the chosen room', async ({ page }) => {
  await page.goto('/');
  await page
    .getByRole('navigation', { name: 'Tea room stations' })
    .getByRole('button', { name: /Host/ })
    .click();
  await expect(page.getByRole('heading', { name: 'Ask Iroh' })).toBeVisible();
  await page.waitForTimeout(3500);
  await expect(page.getByRole('heading', { name: 'Ask Iroh' })).toBeVisible();
});
test('mobile layout remains readable and the WebGL fallback preserves the journey', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      id: string,
      ...args: unknown[]
    ) {
      if (id.startsWith('webgl')) return null;
      return getContext.apply(this, [id, ...args] as Parameters<
        typeof getContext
      >);
    } as typeof getContext;
  });
  await page.goto('/');
  await expect(page.getByText('The room is resting.')).toBeVisible();
  await page.getByRole('button', { name: 'Load sample', exact: true }).click();
  await page.getByRole('button', { name: 'Pour', exact: true }).click();
  await page
    .getByRole('button', { name: 'Visit the Shelf', exact: true })
    .click();
  await page.getByRole('button', { name: 'Approach the Shelf' }).click();
  await expect(
    page.getByRole('heading', {
      name: /Top 10 (?:Hyperliquid|HL) Leaderboard/,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
