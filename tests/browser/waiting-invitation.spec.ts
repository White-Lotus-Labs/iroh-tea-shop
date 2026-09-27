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

test('on a phone held sideways the controls stand beside the sheet', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('/?waiting=invitation');
  const turn = await page
    .getByRole('button', { name: 'Turn it over' })
    .boundingBox();
  const chips = await page
    .getByRole('complementary', { name: 'The team on X' })
    .boundingBox();
  const dock = await page.locator('.waiting-entry').boundingBox();
  // Beside the sheet, not under it, and clear of the dock.
  expect(turn!.x).toBeGreaterThan(844 / 2);
  expect(chips!.y + chips!.height).toBeLessThanOrEqual(dock!.y);
});
