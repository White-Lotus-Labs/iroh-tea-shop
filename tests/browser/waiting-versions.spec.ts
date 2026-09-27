import { test, expect } from '@playwright/test';

test('compare switcher swaps waiting rooms and keeps the choice in the URL', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto('/');
  const versions = page.getByRole('navigation', {
    name: 'Waiting room versions',
  });
  const pick = (name: string) => versions.getByRole('button', { name });
  await expect(pick('A Sketchbook')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.sb')).toBeVisible();

  await pick('B Invitation').click();
  await expect(page.locator('.inv')).toBeVisible();
  await expect(page.locator('.sb')).toHaveCount(0);
  await expect(page).toHaveURL(/[?&]waiting=invitation/);

  await pick('C Tanzaku').click();
  await expect(page.locator('.tz')).toBeVisible();
  await expect(page).toHaveURL(/[?&]waiting=tanzaku/);

  await page.reload();
  await expect(pick('C Tanzaku')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.tz')).toBeVisible();
});
