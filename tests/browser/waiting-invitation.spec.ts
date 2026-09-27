import { test, expect } from '@playwright/test';

const HANDLES = [
  '0x_iroh',
  '0x_Takezo',
  'david_grii',
  'PandaCoderexe',
  'tldde',
];

// Software WebGL draws a few frames a second; reduced motion turns the
// sheet in one frame instead of an eased swing.
test.use({ reducedMotion: 'reduce' });

// ?waiting= only matters on the compare branch; elsewhere it is ignored.
test('invitation lists the signers and turns over to the team and back', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?waiting=invitation');
  const signers = page.getByRole('complementary', { name: 'The team on X' });
  for (const handle of HANDLES)
    await expect(
      signers.getByRole('link', { name: new RegExp(`^@${handle} `) }),
    ).toHaveAttribute('href', `https://x.com/${handle}`);

  // The side changes in the render loop.
  const slow = { timeout: 30_000 };
  await page.getByRole('button', { name: 'Turn it over' }).click();
  const back = page.getByRole('button', { name: 'Back to the charter' });
  await expect(back).toHaveAttribute('aria-pressed', 'true', slow);
  await expect(page.getByRole('heading', { name: 'The team' })).toBeAttached();

  await back.click();
  await expect(
    page.getByRole('button', { name: 'Turn it over' }),
  ).toHaveAttribute('aria-pressed', 'false', slow);
  await expect(
    page.getByRole('heading', { name: 'Tea After Pour', level: 1 }),
  ).toBeAttached();
});
