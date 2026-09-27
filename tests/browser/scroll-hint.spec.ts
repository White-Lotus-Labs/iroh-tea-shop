import { test, expect } from '@playwright/test';
import { beginVisit } from './room-helpers';

test('the open hint keeps its name, describes the teaser, and gets focus back after the roll-up', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await beginVisit(page);
  const hint = page.getByRole('button', { name: 'Open Counter', exact: true });
  await expect(hint).toBeVisible({ timeout: 45000 });
  await expect(hint).toHaveAccessibleDescription(
    'Draw a thesis. Smart money signals are inside.',
  );
  await hint.click();
  await expect(page.getByRole('heading', { name: 'Thesis Desk' })).toBeVisible();
  await page.getByRole('button', { name: 'Close Counter menu' }).click();
  await expect(page.locator('.reading-panel')).toHaveClass(/is-rolling-up/);
  await expect(hint).toBeFocused({ timeout: 5000 });
  await expect(page.locator('.reading-panel')).toHaveCount(0);
});
