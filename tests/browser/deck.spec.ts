import { test, expect, type Page } from '@playwright/test';
import { DECK_FIXTURE, TICKER_DETAIL_FIXTURE } from '../../src/thesis/fixtures';
import { registerBrowserAccount } from './auth-helper';
import { beginVisit } from './room-helpers';

// Begin lands on the Counter; re-clicking its dock button would reset the
// camera and hide the Open Counter hint, so open the panel directly.
async function openCounter(page: Page) {
  await page.goto('/');
  await beginVisit(page);
  await page.getByRole('button', { name: 'Open Counter' }).click({
    timeout: 30000,
  });
}

async function mockNansen(page: Page, deckStatus = 200) {
  await page.route('**/api/nansen-status', (route) =>
    route.fulfill({ json: { nansen: 'configured' } }),
  );
  await page.route('**/api/theses', (route) =>
    deckStatus === 200
      ? route.fulfill({ json: DECK_FIXTURE })
      : route.fulfill({
          status: deckStatus,
          json: { error: 'Nansen is not configured.' },
        }),
  );
  await page.route('**/api/theses/*/*', (route) =>
    route.fulfill({ json: TICKER_DETAIL_FIXTURE }),
  );
}

test.beforeEach(async ({ page }) => {
  await registerBrowserAccount(page);
});

test('Counter deck opens a thesis scroll, expands a leaf, and hands off to Uncle', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockNansen(page);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await openCounter(page);

  const books = page.locator('.deck-book');
  await expect(books).toHaveCount(3);
  await expect(
    page.getByRole('button', {
      name: /Open Crypto Bullrun.*Conviction Strong, 4 of 4 accumulating/,
    }),
  ).toBeVisible();
  await expect(page.locator('.deck-status')).toContainText('Live · Nansen');

  const aiBook = page.getByRole('button', {
    name: /Open AI taking over the world/,
  });
  await aiBook.click();
  const scroll = page.getByRole('dialog', { name: 'AI taking over the world' });
  await expect(scroll).toBeVisible();
  await expect(scroll).toContainText(
    'Nansen smart money is accumulating 1 of 4 leaves this week (3 with data).',
  );

  const nvda = scroll.getByRole('button', { name: /NVDA/ });
  await expect(nvda).toHaveAttribute('aria-expanded', 'false');
  await nvda.click();
  await expect(nvda).toHaveAttribute('aria-expanded', 'true');
  await expect(scroll.getByText('Smart money moves')).toBeVisible();
  await expect(scroll.getByText('4,812')).toBeVisible();
  await expect(scroll.getByText('Perps positioning')).toHaveCount(0);

  await page.keyboard.press('Escape');
  await expect(scroll).toHaveCount(0);
  await expect(aiBook).toBeFocused();
  await expect(
    page.getByRole('heading', { name: 'Thesis Desk' }),
  ).toBeVisible();

  await aiBook.click();
  await page
    .getByRole('dialog', { name: 'AI taking over the world' })
    .getByRole('button', { name: 'Talk to Uncle' })
    .click();
  await expect(page.locator('main')).toHaveAttribute(
    'data-station',
    'AvatarSeat',
  );
  const composer = page.getByRole('textbox', {
    name: 'Ask Uncle a research question',
  });
  await expect(composer).toHaveValue(/Thesis: AI taking over the world/);
  await expect(composer).toHaveValue(/Weakest signal: NVDA/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('deck shows an honest offline state when Nansen answers 503', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockNansen(page, 503);
  await openCounter(page);
  await expect(page.locator('.deck-status')).toContainText(
    'Offline · Nansen is not configured.',
  );
  await expect(
    page.locator('.plaque-level', { hasText: 'Offline' }),
  ).toHaveCount(3);
  await page.getByRole('button', { name: /Open Crypto Bullrun/ }).click();
  await expect(
    page.getByRole('dialog', { name: 'Crypto Bullrun' }),
  ).toContainText('Conviction offline');
});

test('full motion scroll closes with its button and returns focus to the book', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await mockNansen(page);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await openCounter(page);
  const book = page.getByRole('button', { name: /Open Robinhood Chain/ });
  await book.click();
  const scroll = page.getByRole('dialog', {
    name: 'Robinhood Chain tokenization',
  });
  await expect(scroll).toBeVisible();
  await expect(
    scroll.getByRole('button', { name: 'Close scroll' }),
  ).toBeFocused();
  await scroll.getByRole('button', { name: 'Follow the thesis' }).click();
  await expect(
    scroll.getByRole('button', { name: 'Following the thesis' }),
  ).toHaveAttribute('aria-pressed', 'true');
  // The close runs inside a view transition, which waits for a rendered
  // frame; software WebGL under a full suite can take seconds per frame.
  await scroll.getByRole('button', { name: 'Close scroll' }).click();
  await expect(scroll).toHaveCount(0, { timeout: 20_000 });
  await expect(book).toBeFocused();
  await expect(book).toHaveAccessibleName(/Following\./);
  expect(errors).toEqual([]);
});
