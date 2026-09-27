import { expect, type Page } from '@playwright/test';

/** Wait until the full-screen scene loader no longer blocks clicks. */
export async function waitForRoomReady(page: Page) {
  await expect(page.locator('.scene-loader')).toHaveCount(0, {
    timeout: 60000,
  });
}

/** Wait for the dock unroll animation so rollers stop intercepting clicks. */
export async function waitForDockReady(page: Page) {
  const nav = page.getByRole('navigation', { name: 'Tea room stations' });
  await expect(nav).toBeVisible();
  await expect
    .poll(
      () =>
        nav.evaluate(
          (el) =>
            el
              .getAnimations({ subtree: true })
              .filter(
                (a) =>
                  a.playState === 'running' &&
                  a.effect?.getTiming().iterations !== Infinity,
              ).length,
        ),
      { timeout: 30000 },
    )
    .toBe(0);
}

/** Leave the entrance hero and show the station dock. */
export async function beginVisit(page: Page) {
  await waitForRoomReady(page);
  const begin = page.getByRole('button', { name: 'Begin' });
  if (await begin.count()) {
    await begin.click();
    await waitForDockReady(page);
  }
}

/** Dock to a panel station, wait for arrival, then open the panel. */
export async function openStationPanel(
  page: Page,
  station: 'Counter' | 'Host',
) {
  await beginVisit(page);
  const label = station === 'Host' ? /Host/ : /Counter/;
  const nav = page.getByRole('navigation', { name: 'Tea room stations' });
  await nav.getByRole('button', { name: label }).click();
  const open = page.getByRole('button', { name: `Open ${station}` });
  await expect(open).toBeVisible({ timeout: 45000 });
  await open.click();
}
