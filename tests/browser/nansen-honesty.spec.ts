import { expect, test, type Page } from '@playwright/test';

async function openStation(page: Page, label: 'Host' | 'Counter' | 'Shelf') {
  const begin = page.getByRole('button', { name: 'Begin' });
  if (await begin.count()) await begin.click();
  await page
    .locator('.station-nav')
    .locator('.station-item', { hasText: label })
    .click();
}

test('unconfigured Nansen stays honest on status, Host, and Shelf', async ({
  page,
}) => {
  test.setTimeout(45_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/nansen-status', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ nansen: 'unavailable' }),
    }),
  );
  await page.route('**/api/smart-wallet-leaderboard', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Nansen API is not configured.' }),
    }),
  );

  await page.goto('/');
  await expect(page.locator('.scene-loader')).toHaveCount(0);
  await expect(page.locator('.app-shell')).toHaveAttribute(
    'data-nansen',
    'unavailable',
  );

  const status = page.getByRole('button', { name: 'Data source status' });
  await status.hover();
  const popup = page.locator('.status-popup');
  await expect(popup).toBeVisible();
  await expect(popup).toContainText('Demo data');
  await expect(popup).toContainText('Not configured');
  await expect(popup).not.toContainText('Live');
  await expect(popup).not.toContainText('Nansen Research');

  await openStation(page, 'Host');
  const chat = page.locator('.iroh-chat');
  await expect(chat).toContainText('Nansen Research Agent is not configured');
  await expect(chat).toContainText('there is no live answer to bring here');
  await expect(chat).not.toContainText('Powered by Nansen');
  await expect(chat).not.toContainText('Fast mode');
  await expect(chat).not.toContainText('consult Nansen');
  await expect(chat).not.toContainText('I’ll consult');

  await openStation(page, 'Counter');
  await expect(
    page.getByText('A rehearsal, with honest limits.'),
  ).toBeVisible();

  await openStation(page, 'Shelf');
  await page.getByRole('button', { name: 'Approach the Shelf' }).click();
  const parchment = page.getByTestId('leaderboard-parchment');
  await expect(parchment).toContainText('Nansen API is not configured.');
  await expect(parchment).toContainText('Not configured');
  await expect(parchment).toContainText('Not a live refresh');
  await expect(parchment).not.toContainText('Top 10 Smart Wallets');
  await expect(parchment).not.toContainText('Illustrated ranks');
  await expect(parchment).not.toContainText('refreshes every 30 min');
  await expect(parchment).not.toContainText('Reading the Nansen');
});

test('a configured Nansen status keeps the live Host, status, and Shelf framing', async ({
  page,
}) => {
  test.setTimeout(45_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/nansen-status', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ nansen: 'configured' }),
    }),
  );
  await page.route('**/api/smart-wallet-leaderboard', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        entries: [
          {
            rank: 1,
            address: `0x${'a'.repeat(40)}`,
            displayName: 'Observed Trader',
            pnl: 1_820_000,
            roi: 0.274,
            accountValue: 4_600_000,
          },
        ],
        fetchedAt: '2026-09-25T12:00:00.000Z',
        expiresAt: '2099-09-25T12:30:00.000Z',
        source: 'nansen',
        stale: false,
      }),
    }),
  );

  await page.goto('/');
  await expect(page.locator('.scene-loader')).toHaveCount(0);
  await expect(page.locator('.app-shell')).toHaveAttribute(
    'data-nansen',
    'configured',
  );
  await page.getByRole('button', { name: 'Data source status' }).hover();
  const popup = page.locator('.status-popup');
  await expect(popup).toContainText('Demo data');
  await expect(popup).toContainText('Live · Nansen Research');
  await expect(popup).not.toContainText('Not configured');

  await openStation(page, 'Host');
  const chat = page.locator('.iroh-chat');
  await expect(chat).toContainText(
    'Powered by Nansen Research Agent · Fast mode',
  );
  await expect(chat).toContainText('I’ll consult Nansen Research Agent');

  await openStation(page, 'Counter');
  await expect(
    page.getByText('A rehearsal, with honest limits.'),
  ).toBeVisible();

  await openStation(page, 'Shelf');
  await page.getByRole('button', { name: 'Approach the Shelf' }).click();
  const parchment = page.getByTestId('leaderboard-parchment');
  await expect(
    page.getByRole('heading', { name: 'Top 10 Smart Wallets' }),
  ).toBeVisible();
  await expect(parchment).toContainText(
    'Illustrated ranks · server snapshot refreshes every 30 min',
  );
  await expect(parchment).not.toContainText('Not a live refresh');
});
