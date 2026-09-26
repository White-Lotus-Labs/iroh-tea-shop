import { expect, test } from '@playwright/test';

test('a guest can open Host and chat with Iroh without signing in', async ({
  page,
  context,
}) => {
  await page.route('**/api/nansen-agent', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: 'data: {"type":"delta","text":"A guest answer"}\n\ndata: {"type":"finish","conversation_id":null}\n\ndata: [DONE]\n\n',
    });
  });
  await page.goto('/');
  await expect(page.getByTestId('account-entry')).toBeVisible();
  expect(
    (await context.cookies()).some((cookie) => cookie.name === 'tea_session'),
  ).toBe(false);
  await page
    .getByRole('navigation', { name: 'Tea room stations' })
    .getByRole('button', { name: /Host/ })
    .click();
  await page
    .getByRole('textbox', { name: 'Ask Iroh a research question' })
    .fill('What is ETH doing?');
  await page.getByRole('button', { name: 'Send question' }).click();
  await expect(page.getByText('A guest answer')).toBeVisible();
  await expect(page.getByTestId('account-entry')).toBeVisible();
});
