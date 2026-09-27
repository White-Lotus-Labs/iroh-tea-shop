import { test, expect } from '@playwright/test';

const HANDLES = [
  '0x_iroh',
  '0x_Takezo',
  'david_grii',
  'PandaCoderexe',
  'tldde',
];

// Software WebGL draws a few frames a second, so animated turns take far
// longer than the default timeouts. Reduced motion settles turns at once.
test.use({ reducedMotion: 'reduce' });

// ?waiting= only matters on the compare branch; elsewhere it is ignored.
test('sketchbook turns by button, key, drag and index, and links the team', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?waiting=sketchbook');
  const book = page.locator('.sb-book');
  const next = page.getByRole('button', { name: 'Next page' });
  await expect(book).toHaveAttribute(
    'aria-label',
    'The tea shop, spread 1 of 5',
  );
  await expect(
    page.getByRole('button', { name: 'Previous page' }),
  ).toBeDisabled();

  await next.click();
  await expect(book).toHaveAttribute('aria-label', 'The room, spread 2 of 5');

  await page.keyboard.press('ArrowRight');
  await expect(book).toHaveAttribute(
    'aria-label',
    '0x_iroh · 0x_Takezo, spread 3 of 5',
  );
  await expect(
    book.getByRole('link', { name: '@0x_iroh on X' }),
  ).toHaveAttribute('href', 'https://x.com/0x_iroh');

  const box = (await book.boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width * 0.93, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.35, y - 10, { steps: 12 });
  await page.mouse.up();
  await expect(book).toHaveAttribute(
    'aria-label',
    'david_grii · PandaCoderexe, spread 4 of 5',
  );

  await page
    .getByRole('navigation', { name: 'Sketchbook pages' })
    .getByRole('button', { name: 'tldde · Colophon' })
    .click();
  await expect(book).toHaveAttribute(
    'aria-label',
    'tldde · Colophon, spread 5 of 5',
  );
  await expect(next).toBeDisabled();
  for (const handle of HANDLES)
    await expect(
      book.getByRole('link', { name: `@${handle}`, exact: true }),
    ).toHaveAttribute('href', `https://x.com/${handle}`);

  await page.keyboard.press('ArrowLeft');
  await expect(book).toHaveAttribute(
    'aria-label',
    'david_grii · PandaCoderexe, spread 4 of 5',
  );
});

test('on a phone every page is one tap away, not only a swipe', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?waiting=sketchbook');
  const book = page.locator('.sb-book');
  await expect(book).toHaveAttribute(
    'aria-label',
    'The tea shop, page 1 of 10',
  );
  // The dots jump by spread and skip the title page.
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(book).toHaveAttribute(
    'aria-label',
    'The tea shop, page 2 of 10',
  );
  await expect(
    book.getByRole('heading', { name: 'Tea After Pour' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Previous page' }).click();
  await expect(book).toHaveAttribute(
    'aria-label',
    'The tea shop, page 1 of 10',
  );
});
