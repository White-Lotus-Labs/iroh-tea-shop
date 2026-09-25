import { expect, test } from '@playwright/test';

test('Host opens live Iroh chat, keeps history across stations, and resets conversation', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const bodies: Record<string, unknown>[] = [];
  await page.route('**/api/nansen-agent', async (route) => {
    const body = route.request().postDataJSON();
    bodies.push(body);
    const id = bodies.length === 1 ? 'conv_1' : 'conv_2';
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: `data: {"type":"tool_call","name":"holdings"}\n\ndata: {"type":"delta","text":"Nansen answer ${bodies.length}"}\n\ndata: {"type":"finish","conversation_id":"${id}"}\n\ndata: [DONE]\n\n`,
    });
  });
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Tea room stations' });
  await nav.getByRole('button', { name: /Host/ }).click();
  await page.getByRole('button', { name: 'Ask Iroh' }).click();
  await expect(page.getByRole('heading', { name: 'Ask Iroh' })).toBeVisible();
  await expect(page.locator('main')).toHaveAttribute(
    'data-camera-at',
    'AvatarSeat',
    { timeout: 7000 },
  );
  const panel = await page.locator('.reading-panel').boundingBox();
  expect(panel!.width).toBeLessThan((page.viewportSize()?.width ?? 1280) / 2);
  expect(panel!.x).toBeGreaterThan((page.viewportSize()?.width ?? 1280) / 2);
  const input = page.getByRole('textbox', {
    name: 'Ask Iroh a research question',
  });
  await input.fill('What is ETH doing?');
  await input.press('Shift+Enter');
  await input.type('And why?');
  await expect(input).toHaveValue('What is ETH doing?\nAnd why?');
  await input.press('Enter');
  await expect(page.getByText('Nansen answer 1')).toBeVisible();
  await nav.getByRole('button', { name: /Shelf/ }).click();
  await nav.getByRole('button', { name: /Host/ }).click();
  await page.getByRole('button', { name: 'Ask Iroh' }).click();
  await expect(page.getByText('Nansen answer 1')).toBeVisible();
  await input.fill('What about HYPE?');
  await page.getByRole('button', { name: 'Send question' }).click();
  await expect(page.getByText('Nansen answer 2')).toBeVisible();
  expect(bodies[0]).toEqual({ text: 'What is ETH doing?\nAnd why?' });
  expect(bodies[1]).toEqual({
    text: 'What about HYPE?',
    conversation_id: 'conv_1',
  });
  await page.getByRole('button', { name: 'New conversation' }).click();
  await expect(page.getByText('Nansen answer 1')).not.toBeVisible();
  await input.fill('Fresh question');
  await page.getByRole('button', { name: 'Send question' }).click();
  expect(bodies[2]).toEqual({ text: 'Fresh question' });
  await page.getByRole('button', { name: 'Close Iroh chat' }).click();
  await expect(page.getByRole('button', { name: 'Ask Iroh' })).toBeFocused();
  expect(errors).toEqual([]);
});

test('Iroh shows a live provider error and Stop ends a pending request', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/nansen-agent', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'Nansen Research Agent is not configured.',
      }),
    });
  });
  await page.goto('/');
  await page
    .getByRole('navigation', { name: 'Tea room stations' })
    .getByRole('button', { name: /Host/ })
    .click();
  await page.getByRole('button', { name: 'Ask Iroh' }).click();
  const input = page.getByRole('textbox', {
    name: 'Ask Iroh a research question',
  });
  await input.fill('Is anyone buying ETH?');
  await page.getByRole('button', { name: 'Send question' }).click();
  await expect(page.locator('.iroh-error')).toContainText('not configured');
  await expect(page.getByText(/Nansen answer/)).toHaveCount(0);

  let release!: () => void;
  await page.unroute('**/api/nansen-agent');
  await page.route('**/api/nansen-agent', async (route) => {
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    await route
      .fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: 'data: {"type":"finish","conversation_id":"late"}\n\ndata: [DONE]\n\n',
      })
      .catch(() => {});
  });
  await input.fill('A different question');
  await page.getByRole('button', { name: 'Send question' }).click();
  await expect(
    page.getByRole('button', { name: 'Stop generation' }),
  ).toBeVisible();
  await expect.poll(() => Boolean(release)).toBe(true);
  await page.getByRole('button', { name: 'Stop generation' }).click();
  release();
  await expect(page.getByText('Stopped · partial answer')).toBeVisible();
  await expect(input).toBeEnabled();
  await page.getByRole('button', { name: 'New conversation' }).click();
  await expect(page.getByText('Is anyone buying ETH?')).not.toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
