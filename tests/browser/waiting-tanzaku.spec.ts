import { test, expect } from '@playwright/test';

// ?waiting= only matters on the compare branch; elsewhere it is ignored.
test('tanzaku opens a slip, walks to the next one and hangs it back', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?waiting=tanzaku');
  // The slips sway, so their hit buttons never hold still for a click check.
  const slip = page.getByRole('button', { name: /^@david_grii, / });
  await slip.focus();
  await page.keyboard.press('Enter');
  await expect(slip).toHaveAttribute('aria-expanded', 'true');

  const card = page.locator('#tz-card');
  await expect(
    card.getByRole('heading', { name: '@david_grii' }),
  ).toBeVisible();
  await expect(card).toBeFocused();
  await expect(card.getByRole('link', { name: 'Follow on X' })).toHaveAttribute(
    'href',
    'https://x.com/david_grii',
  );

  await card.getByRole('button', { name: 'Next slip: @PandaCoderexe' }).click();
  await expect(
    card.getByRole('heading', { name: '@PandaCoderexe' }),
  ).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(card).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: /^@PandaCoderexe, / }),
  ).toBeFocused();
});

test('on a phone the noren flaps work as tabs for the four stations', async ({
  page,
}) => {
  test.setTimeout(90_000);
  // Swaying flaps never hold still for the click check; still flaps do.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?waiting=tanzaku');
  const flaps = page.getByRole('list', { name: 'Four stations inside' });
  const host = flaps.getByRole('button', { name: /^Host/ });
  await host.click();
  await expect(host).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#tz-step')).toContainText('Talk to Iroh');
  await expect(flaps.getByRole('button', { name: /^Counter/ })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
});

test('on short phones the slips hang in view, sideways or upright', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const [width, height] of [
    [844, 390],
    [375, 667],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto('/?waiting=tanzaku');
    const dock = (await page.locator('.waiting-entry').boundingBox())!;
    const slips = page.locator('.tz-hit');
    // The hit buttons wait off-screen until the rig first draws; then every
    // slip hangs whole above the dock.
    await expect
      .poll(
        async () => {
          const boxes = await slips.evaluateAll((els) =>
            els.map((el) => el.getBoundingClientRect()),
          );
          return boxes.every((b) => b.height > 0)
            ? Math.max(...boxes.map((b) => b.bottom))
            : Infinity;
        },
        { timeout: 30_000 },
      )
      .toBeLessThan(dock.y);
  }
});
