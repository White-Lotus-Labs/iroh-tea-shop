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

test('sketchbook turns by button, key, drag and index, and links the team', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
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
    .getByRole('button', { name: 'tldde · The team' })
    .click();
  await expect(book).toHaveAttribute(
    'aria-label',
    'tldde · The team, spread 5 of 5',
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
  await page.goto('/');
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
    book.getByRole('heading', { name: "Iroh's Tea Shop" }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Previous page' }).click();
  await expect(book).toHaveAttribute(
    'aria-label',
    'The tea shop, page 1 of 10',
  );
});

test('the sketchbook starts open, riffles forward once, and lands on the first spread', async ({
  browser,
}) => {
  test.setTimeout(60_000);
  const context = await browser.newContext({
    reducedMotion: 'no-preference',
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  await page.goto('/');
  const book = page.locator('.sb');
  await book.waitFor();
  await expect(book).toHaveAttribute('data-open', 'open');
  await expect(page.locator('.sb-book')).toHaveAttribute(
    'aria-label',
    'The tea shop, spread 1 of 5',
  );
  await expect(page.locator('.sb-lid')).toHaveCount(0);
  await page.evaluate(() => {
    const el = document.querySelector('.sb-book')!;
    const seen: number[] = [];
    (window as unknown as { __spreads: number[] }).__spreads = seen;
    new MutationObserver(() => {
      const n = Number(
        el.getAttribute('aria-label')?.match(/spread (\d)/)?.[1],
      );
      if (n && seen[seen.length - 1] !== n) seen.push(n);
    }).observe(el, { attributes: true, attributeFilter: ['aria-label'] });
  });
  await expect(book).toHaveAttribute('data-riffle', /on|fast/, {
    timeout: 10_000,
  });
  await expect(book).not.toHaveAttribute('data-riffle', /.+/, {
    timeout: 10_000,
  });
  const spreads = await page.evaluate(
    () => (window as unknown as { __spreads: number[] }).__spreads,
  );
  expect(spreads).toEqual([2, 3, 4, 5, 1]);
  await context.close();
});

test('a light machine riffles snapshot strips and skips the page blur', async ({
  browser,
}) => {
  test.setTimeout(60_000);
  const context = await browser.newContext({
    reducedMotion: 'no-preference',
    viewport: { width: 1440, height: 900 },
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      configurable: true,
      get: () => 2,
    });
  });
  const page = await context.newPage();
  await page.goto('/');
  const book = page.locator('.sb');
  await book.waitFor();
  await page.evaluate(() => {
    const el = document.querySelector('.sb-book')!;
    const seen: number[] = [];
    (window as unknown as { __spreads: number[] }).__spreads = seen;
    new MutationObserver(() => {
      const n = Number(
        el.getAttribute('aria-label')?.match(/spread (\d)/)?.[1],
      );
      if (n && seen[seen.length - 1] !== n) seen.push(n);
    }).observe(el, { attributes: true, attributeFilter: ['aria-label'] });
  });
  await expect(book).toHaveAttribute('data-budget', 'light');
  await expect(book).toHaveAttribute('data-riffle', /on|fast/, {
    timeout: 10_000,
  });
  await expect(page.locator('.curl[data-shot="on"]').first()).toBeAttached();
  await expect(page.locator('.curl .is-plain')).toHaveCount(0);
  const curl = await page.evaluate(() => {
    const strips = document.querySelectorAll('.curl .strip').length;
    const faces = [
      ...document.querySelectorAll('.curl .face-page.is-shot'),
    ].map((el) => {
      const style = getComputedStyle(el);
      return {
        position: style.backgroundPosition,
        shot: style.backgroundImage.startsWith('url("blob:'),
      };
    });
    return { strips, faces };
  });
  expect(curl.strips).toBe(16);
  expect(curl.faces.length).toBeGreaterThanOrEqual(16);
  expect(curl.faces.every((face) => face.shot)).toBe(true);
  expect(
    curl.faces.every((face) => /^0(px|%) 0(px|%)$/.test(face.position)),
  ).toBe(true);
  const filter = await page
    .locator('.sb-half .sb-page-inner')
    .first()
    .evaluate((el) => getComputedStyle(el).filter);
  expect(filter).toBe('none');
  await expect(book).not.toHaveAttribute('data-riffle', /.+/, {
    timeout: 10_000,
  });
  const spreads = await page.evaluate(
    () => (window as unknown as { __spreads: number[] }).__spreads,
  );
  expect(spreads).toEqual([2, 3, 4, 5, 1]);
  await context.close();
});

test('on a phone held sideways one page keeps a size its text fits', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('/');
  const book = page.locator('.sb-book');
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(book).toHaveAttribute(
    'aria-label',
    'The tea shop, page 2 of 10',
  );
  // The title page is the fullest; its last line must stay on the paper.
  const inner = await book.locator('.sb-half .sb-title').boundingBox();
  const last = await book.locator('.sb-half .sb-sign').boundingBox();
  expect(last!.y + last!.height).toBeLessThanOrEqual(inner!.y + inner!.height);
});
