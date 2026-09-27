const PAPER = '#efe7d5';
const cache = new Map<string, string>();

export function pageShotKey(index: number, width: number): string {
  return `${index}:${Math.round(width)}`;
}

export function getPageShot(index: number, width: number): string | undefined {
  return cache.get(pageShotKey(index, width));
}

export function pageShotCount(): number {
  return cache.size;
}

export function rememberPageShot(
  index: number,
  width: number,
  url: string,
): void {
  cache.set(pageShotKey(index, width), url);
}

/** Canvas rejects an empty `font` shorthand. Build one from the longhands. */
export function canvasFont(style: {
  font: string;
  fontStyle: string;
  fontWeight: string;
  fontSize: string;
  fontFamily: string;
}): string {
  const font = style.font.trim();
  if (font && /\d/.test(font)) return font;
  return `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
}

type SvgPictures = Map<SVGSVGElement, CanvasImageSource>;

/** Paint a live page onto a JPEG. Cheap copies of this go on every curl strip. */
export function snapshotElement(
  el: HTMLElement,
  pictures?: SvgPictures,
): string | null {
  const origin = el.getBoundingClientRect();
  if (origin.width < 8 || origin.height < 8) return null;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(origin.width * dpr));
  canvas.height = Math.max(1, Math.round(origin.height * dpr));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.scale(dpr, dpr);
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, origin.width, origin.height);
  paintNode(ctx, el, origin, pictures, true);
  try {
    return canvas.toDataURL('image/jpeg', 0.88);
  } catch {
    return null;
  }
}

export function snapshotAndStore(
  el: HTMLElement,
  index: number,
  width: number,
): string | null {
  const url = snapshotElement(el);
  if (url) rememberPageShot(index, width, url);
  return url;
}

export async function bakePageShot(
  el: HTMLElement,
  index: number,
  width: number,
): Promise<string | null> {
  const pictures = await decodePageSvgs(el);
  const url = snapshotElement(el, pictures);
  if (url) rememberPageShot(index, width, url);
  return url;
}

async function decodePageSvgs(root: HTMLElement): Promise<SvgPictures> {
  const pictures: SvgPictures = new Map();
  const nodes = root.querySelectorAll('svg');
  await Promise.all(
    [...nodes].map(async (svg) => {
      const img = await decodeSvg(svg);
      if (img) pictures.set(svg, img);
    }),
  );
  return pictures;
}

async function decodeSvg(svg: SVGSVGElement): Promise<HTMLImageElement | null> {
  const box = svg.getBoundingClientRect();
  if (box.width < 1 || box.height < 1) return null;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(box.width));
  clone.setAttribute('height', String(box.height));
  if (!clone.getAttribute('viewBox') && svg.viewBox.baseVal) {
    const v = svg.viewBox.baseVal;
    clone.setAttribute('viewBox', `${v.x} ${v.y} ${v.width} ${v.height}`);
  }
  const xml = new XMLSerializer().serializeToString(clone);
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
  try {
    await img.decode();
    return img;
  } catch {
    return null;
  }
}

function paintNode(
  ctx: CanvasRenderingContext2D,
  el: Element,
  origin: DOMRect,
  pictures: SvgPictures | undefined,
  root: boolean,
): void {
  const style = getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return;
  if (el instanceof HTMLImageElement) {
    paintImage(ctx, el, origin, style);
    return;
  }
  if (el instanceof SVGSVGElement) {
    const picture = pictures?.get(el);
    if (picture) paintPicture(ctx, picture, el.getBoundingClientRect(), origin);
    return;
  }
  if (!root) paintBox(ctx, el, origin, style);
  for (const child of el.childNodes) {
    if (child.nodeType === Node.TEXT_NODE)
      paintText(ctx, child as Text, origin, style);
    else if (child.nodeType === Node.ELEMENT_NODE)
      paintNode(ctx, child as Element, origin, pictures, false);
  }
}

function paintImage(
  ctx: CanvasRenderingContext2D,
  el: HTMLImageElement,
  origin: DOMRect,
  style: CSSStyleDeclaration,
): void {
  if (el.naturalWidth <= 0 || el.naturalHeight <= 0) return;
  ctx.save();
  if (style.mixBlendMode === 'multiply')
    ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = Number(style.opacity) || 1;
  try {
    const box = el.getBoundingClientRect();
    ctx.drawImage(
      el,
      box.left - origin.left,
      box.top - origin.top,
      box.width,
      box.height,
    );
  } catch {
    /* tainted image */
  }
  ctx.restore();
}

function paintPicture(
  ctx: CanvasRenderingContext2D,
  picture: CanvasImageSource,
  box: DOMRect,
  origin: DOMRect,
): void {
  ctx.drawImage(
    picture,
    box.left - origin.left,
    box.top - origin.top,
    box.width,
    box.height,
  );
}

function paintBox(
  ctx: CanvasRenderingContext2D,
  el: Element,
  origin: DOMRect,
  style: CSSStyleDeclaration,
): void {
  const box = el.getBoundingClientRect();
  if (box.width < 0.5 || box.height < 0.5) return;
  const bg = style.backgroundColor;
  const hasBg = Boolean(bg && bg !== 'transparent' && !bg.endsWith(', 0)'));
  const width = parseFloat(style.borderTopWidth);
  const hasBorder = width > 0 && style.borderTopStyle !== 'none';
  if (!hasBg && !hasBorder) return;
  ctx.save();
  ctx.globalAlpha = Number(style.opacity) || 1;
  if (hasBg) {
    ctx.fillStyle = bg;
    ctx.fillRect(
      box.left - origin.left,
      box.top - origin.top,
      box.width,
      box.height,
    );
  }
  if (hasBorder) {
    ctx.strokeStyle = style.borderTopColor;
    ctx.lineWidth = width;
    ctx.strokeRect(
      box.left - origin.left + width / 2,
      box.top - origin.top + width / 2,
      box.width - width,
      box.height - width,
    );
  }
  ctx.restore();
}

function paintText(
  ctx: CanvasRenderingContext2D,
  node: Text,
  origin: DOMRect,
  style: CSSStyleDeclaration,
): void {
  const raw = node.textContent ?? '';
  if (!raw.trim()) return;
  ctx.save();
  ctx.fillStyle = style.color;
  ctx.font = canvasFont(style);
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.globalAlpha = Number(style.opacity) || 1;
  if ('letterSpacing' in ctx)
    (
      ctx as CanvasRenderingContext2D & { letterSpacing: string }
    ).letterSpacing = style.letterSpacing;
  const range = document.createRange();
  let start = 0;
  const len = raw.length;
  while (start < len) {
    range.setStart(node, start);
    range.setEnd(node, start + 1);
    const first = range.getBoundingClientRect();
    let end = start + 1;
    while (end < len) {
      range.setEnd(node, end + 1);
      const next = range.getBoundingClientRect();
      if (Math.abs(next.top - first.top) > Math.max(4, first.height * 0.45))
        break;
      end += 1;
    }
    range.setStart(node, start);
    range.setEnd(node, end);
    const box = range.getBoundingClientRect();
    ctx.fillText(
      raw.slice(start, end),
      box.left - origin.left,
      box.top - origin.top,
    );
    start = end;
  }
  ctx.restore();
}
