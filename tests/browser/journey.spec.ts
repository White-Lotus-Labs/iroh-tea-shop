import { test, expect } from '@playwright/test';
import { registerBrowserAccount } from './auth-helper';
import { beginVisit, openStationPanel } from './room-helpers';

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

test('Entrance to Counter shows the thesis desk placeholder', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('main')).toHaveAttribute('data-station', 'Entrance');
  await beginVisit(page);
  await expect(page.locator('main')).toHaveAttribute('data-station', 'Counter');
  await page.getByRole('button', { name: 'Open Counter' }).click({
    timeout: 20000,
  });
  await expect(
    page.getByRole('heading', { name: 'Thesis Desk' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Robinhood Chain tokenization' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Discuss your own thesis with Uncle' })
    .click();
  await expect(page.locator('main')).toHaveAttribute(
    'data-station',
    'AvatarSeat',
  );
  await expect(page.getByRole('heading', { name: 'Ask Iroh' })).toBeVisible();
  await expect(
    page.getByRole('textbox', { name: 'Ask Iroh a research question' }),
  ).toHaveValue(/Here is my own thesis/);
  expect(errors).toEqual([]);
});

test('dock navigation keeps panels closed until Open is used', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await beginVisit(page);
  const nav = page.getByRole('navigation', { name: 'Tea room stations' });
  for (const name of ['Observatorium', 'Host', 'Shelf', 'Counter']) {
    await nav.getByRole('button', { name: new RegExp(name) }).click();
    await expect(
      nav.getByRole('button', { name: new RegExp(name) }),
    ).toHaveAttribute('aria-current', 'step');
  }
  await expect(page.getByRole('heading', { name: 'Thesis Desk' })).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: 'Open Counter' }).click({
    timeout: 20000,
  });
  await expect(
    page.getByRole('heading', { name: 'Thesis Desk' }),
  ).toBeVisible();
});

test('Host panel stays open after an explicit open', async ({ page }) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await openStationPanel(page, 'Host');
  await expect(page.getByRole('heading', { name: 'Ask Iroh' })).toBeVisible();
  await page.waitForTimeout(1500);
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
  await beginVisit(page);
  await page
    .getByRole('navigation', { name: 'Tea room stations' })
    .getByRole('button', { name: /Shelf/ })
    .click();
  await page.getByRole('button', { name: 'Approach the Shelf' }).click();
  await expect(
    page.getByRole('heading', { name: 'Top 10 Smart Wallets' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
