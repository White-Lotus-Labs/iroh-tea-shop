import { expect, test } from '@playwright/test';
import { beginVisit } from './room-helpers';

test('a guest can use the room and find optional account actions', async ({
  page,
  context,
}) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('main')).toHaveAttribute('data-station', 'Entrance');
  await expect(page.getByTestId('account-entry')).toBeVisible();
  await beginVisit(page);
  await page.getByRole('button', { name: 'Open Counter' }).click({
    timeout: 20000,
  });
  await expect(
    page.getByRole('heading', { name: 'Thesis Desk' }),
  ).toBeVisible();
  expect(
    (await context.cookies()).some((cookie) => cookie.name === 'tea_session'),
  ).toBe(false);
  expect((await page.request.get('/api/auth/me')).status()).toBe(401);
  await page.getByTestId('account-entry').click();
  await expect(
    page.getByRole('heading', { name: 'Welcome to the room.' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Continue without an account' }).click();
  await expect(page.locator('main')).toHaveAttribute('data-station', 'Entrance');
});

test('register, refresh, logout, and case-insensitive login keep one identity', async ({
  page,
  context,
}) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const nickname = `Mark_${crypto.randomUUID().slice(0, 8)}`;
  await page.goto('/');
  await beginVisit(page);
  await page.getByTestId('account-entry').click();
  await expect(
    page.getByRole('heading', { name: 'Welcome to the room.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByLabel('Nickname').fill(nickname);
  await page.getByLabel('Password').fill('correct horse');
  await page
    .getByRole('button', { name: 'Create account', exact: true })
    .last()
    .click();
  await expect(page.getByTestId('account-control')).toContainText(nickname);
  const me = await (await page.request.get('/api/auth/me')).json();
  expect(me.user).toEqual({ id: expect.any(String), nickname });
  expect(me.user).not.toHaveProperty('passwordHash');
  const cookie = (await context.cookies()).find(
    (item) => item.name === 'tea_session',
  );
  expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax' });
  await page.reload();
  await expect(page.getByTestId('account-control')).toContainText(nickname);
  await beginVisit(page);
  await page
    .getByRole('navigation', { name: 'Tea room stations' })
    .getByRole('button', { name: /Host/ })
    .click();
  await expect(page.locator('main')).toHaveAttribute(
    'data-station',
    'AvatarSeat',
  );
  await page.getByTestId('account-control').click();
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page.getByTestId('account-entry')).toBeVisible();
  await expect(page.locator('main')).toHaveAttribute('data-station', 'Entrance');
  await page.reload();
  expect((await page.request.get('/api/auth/me')).status()).toBe(401);
  await page.getByTestId('account-entry').click();
  await page.getByLabel('Nickname').fill(nickname.toLowerCase());
  await page.getByLabel('Password').fill('correct horse');
  await page
    .getByRole('button', { name: 'Log in', exact: true })
    .last()
    .click();
  await expect(page.getByTestId('account-control')).toContainText(nickname);
  expect((await (await page.request.get('/api/auth/me')).json()).user.id).toBe(
    me.user.id,
  );
});

test('duplicate nickname and short password show recoverable errors', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const nickname = `Alex_${crypto.randomUUID().slice(0, 8)}`;
  await page.goto('/');
  await beginVisit(page);
  await page.getByTestId('account-entry').click();
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByLabel('Nickname').fill(nickname);
  await page.getByLabel('Password').fill('short');
  await page
    .getByRole('button', { name: 'Create account', exact: true })
    .last()
    .click();
  await expect(page.locator('.auth-error')).toContainText('at least 8');
  await expect(page.getByLabel('Nickname')).toHaveValue(nickname);
  await page.getByLabel('Password').fill('long enough');
  await page
    .getByRole('button', { name: 'Create account', exact: true })
    .last()
    .click();
  await expect(page.getByTestId('account-control')).toContainText(nickname);
  await page.getByTestId('account-control').click();
  await page.getByRole('button', { name: 'Log out' }).click();
  await page.getByTestId('account-entry').click();
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByLabel('Nickname').fill(nickname.toLowerCase());
  await page.getByLabel('Password').fill('long enough');
  await page
    .getByRole('button', { name: 'Create account', exact: true })
    .last()
    .click();
  await expect(page.locator('.auth-error')).toContainText('already taken');
});
