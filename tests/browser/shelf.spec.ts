import { expect, test, type Page } from '@playwright/test';
import { registerBrowserAccount } from './auth-helper';

test.beforeEach(async ({ page }) => registerBrowserAccount(page));

const address = (n: number) => `0x${n.toString(16).padStart(40, '0')}`;
const snapshot = {
  entries: Array.from({ length: 10 }, (_, i) => ({
    rank: i + 1,
    address: address(i + 1),
    displayName:
      i === 0 ? 'Alpha Trader' : i === 9 ? '0x0000...000a' : `Trader ${i + 1}`,
    pnl: i === 1 ? -482_000 : 1_820_000 - i * 10_000,
    roi: i === 1 ? -0.082 : 0.274,
    accountValue: i === 9 ? null : 4_600_000,
  })),
  fetchedAt: '2026-09-25T12:00:00.000Z',
  expiresAt: '2099-09-25T12:30:00.000Z',
  source: 'nansen',
  stale: false,
};

async function focusShelf(page: Page) {
  await page
    .getByRole('navigation', { name: 'Tea room stations' })
    .getByRole('button', { name: /Shelf/ })
    .click();
  await page.getByRole('button', { name: 'Approach the Shelf' }).click();
}

test('the Shelf stays in the room until approached, then opens ranked wallets after camera travel', async ({
  page,
}) => {
  test.setTimeout(45_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.route('**/api/smart-wallet-leaderboard', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(snapshot),
    }),
  );
  await page.goto('/');
  await expect(page.locator('.app-shell')).toHaveAttribute(
    'data-motion',
    'full',
  );
  await expect(page.getByTestId('leaderboard-parchment')).toHaveCount(0);
  await page
    .getByRole('navigation', { name: 'Tea room stations' })
    .getByRole('button', { name: /Shelf/ })
    .click();
  await expect(page.locator('.app-shell')).toHaveAttribute(
    'data-station',
    'Shelf',
  );
  await expect(page.locator('.app-shell')).toHaveAttribute(
    'data-shelf-view',
    'browse',
  );
  await expect(page.getByTestId('leaderboard-parchment')).toHaveCount(0);
  const approach = page.getByRole('button', { name: 'Approach the Shelf' });
  await expect(approach).toBeVisible();
  await page.evaluate(() => {
    const shell = document.querySelector('.app-shell')!;
    const transitions: { view: string | null; parchment: boolean }[] = [];
    (
      window as typeof window & { shelfTransitions: typeof transitions }
    ).shelfTransitions = transitions;
    new MutationObserver(() => {
      transitions.push({
        view: shell.getAttribute('data-shelf-view'),
        parchment: Boolean(
          document.querySelector('[data-testid="leaderboard-parchment"]'),
        ),
      });
    }).observe(shell, {
      attributes: true,
      attributeFilter: ['data-shelf-view'],
    });
  });
  await approach.click();
  await expect(page.locator('.app-shell')).toHaveAttribute(
    'data-shelf-view',
    'open',
  );
  const transitions = await page.evaluate(
    () =>
      (
        window as typeof window & {
          shelfTransitions: { view: string | null; parchment: boolean }[];
        }
      ).shelfTransitions,
  );
  expect(transitions).toContainEqual({ view: 'focusing', parchment: false });
  await expect(page.locator('.app-shell')).toHaveAttribute(
    'data-camera-at',
    'Shelf',
  );
  await expect(page.getByTestId('leaderboard-parchment')).toBeVisible();
  await expect(page.getByTestId('top-wallet')).toContainText('Alpha Trader');
  await expect(
    page.getByTestId('rank-grid').locator('[data-rank]'),
  ).toHaveCount(9);
});

test('clicking the Shelf in the room starts the focus journey', async ({
  page,
}) => {
  test.setTimeout(45_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await page
    .getByRole('navigation', { name: 'Tea room stations' })
    .getByRole('button', { name: /Shelf/ })
    .click();
  await expect(
    page.getByRole('button', { name: 'Approach the Shelf' }),
  ).toBeVisible();
  await page.mouse.click(1000, 450);
  await expect(page.locator('.app-shell')).toHaveAttribute(
    'data-shelf-view',
    'open',
  );
});

test('Shelf presents one leader above an exact 3 by 3 grid without clipping', async ({
  page,
}) => {
  test.setTimeout(45_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/api/smart-wallet-leaderboard', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(snapshot),
    }),
  );
  await page.goto('/');
  await focusShelf(page);
  await expect(
    page.getByRole('heading', { name: 'Top 10 Smart Wallets' }),
  ).toBeVisible();
  await expect(page.getByTestId('top-wallet')).toContainText('Alpha Trader', {
    timeout: 15_000,
  });
  await expect(page.getByTestId('top-wallet')).toContainText('+27.4%');
  await expect(
    page.getByTestId('rank-grid').locator('[data-rank]'),
  ).toHaveCount(9);
  expect(
    await page
      .getByTestId('rank-grid')
      .evaluate(
        (element) =>
          getComputedStyle(element).gridTemplateColumns.split(' ').length,
      ),
  ).toBe(3);
  await expect(page.locator('[data-rank="10"]')).toBeVisible();
  await expect(page.locator('[data-rank="10"]')).toContainText('—');
  const parchment = await page
    .getByTestId('leaderboard-parchment')
    .boundingBox();
  const last = await page.locator('[data-rank="10"]').boundingBox();
  expect(last!.y + last!.height).toBeLessThanOrEqual(
    parchment!.y + parchment!.height + 1,
  );
  expect(errors).toEqual([]);
});

test('Shelf keeps its parchment for a safe error and exposes a keyboard retry', async ({
  page,
}) => {
  await page.route('**/api/smart-wallet-leaderboard', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Nansen API is not configured.' }),
    }),
  );
  await page.goto('/');
  await focusShelf(page);
  await expect(page.getByTestId('leaderboard-parchment')).toContainText(
    'Nansen API is not configured.',
  );
  await expect(
    page.getByRole('button', { name: 'Retry leaderboard' }),
  ).toBeVisible();
});

test('an invalid server response shows a safe parchment error', async ({
  page,
}) => {
  await page.route('**/api/smart-wallet-leaderboard', (route) =>
    route.fulfill({
      status: 502,
      contentType: 'text/html',
      body: '<h1>internal details</h1>',
    }),
  );
  await page.goto('/');
  await focusShelf(page);
  await expect(page.getByTestId('leaderboard-parchment')).toContainText(
    'Smart Wallet leaderboard is temporarily unavailable.',
  );
  await expect(page.getByTestId('leaderboard-parchment')).not.toContainText(
    'internal details',
  );
});

test('rank ten remains visible at 1280 by 720', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/smart-wallet-leaderboard', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(snapshot),
    }),
  );
  await page.goto('/');
  await focusShelf(page);
  await expect(page.locator('[data-rank="10"]')).toBeVisible();
  const paper = await page.locator('.leaderboard-parchment').boundingBox();
  const rank = await page.locator('[data-rank="10"]').boundingBox();
  expect(rank!.y + rank!.height).toBeLessThanOrEqual(
    paper!.y + paper!.height - 15,
  );
});

test('a stale real snapshot is labelled and small screens keep values readable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/smart-wallet-leaderboard', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...snapshot,
        stale: true,
        refreshError: 'Provider unavailable.',
      }),
    }),
  );
  await page.goto('/');
  await focusShelf(page);
  await expect(
    page.getByText(/live refresh temporarily unavailable/),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Retry leaderboard' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator('[data-rank="10"]').scrollIntoViewIfNeeded();
  await expect(page.locator('[data-rank="10"]')).toContainText('—');
  const rank = await page.locator('[data-rank="10"]').boundingBox();
  const footer = await page.locator('.leaderboard-foot').boundingBox();
  expect(rank!.y + rank!.height).toBeLessThanOrEqual(footer!.y);
});
