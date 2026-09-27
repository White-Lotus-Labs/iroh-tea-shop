import { PROJECT, TEAM } from './content';

// Drawn like the ThreeUI 3D Paper certificate: author on a fixed grid,
// render the canvas larger for crisp type.
export const TW = 1200;
export const TH = 1600;
const SCALE = 1.25;
const SERIF =
  '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif';
const SANS = 'Arial, Helvetica, sans-serif';
const INK = '#3b2a17';
const EARTH = '#8a5a2e';
const SEAL = '#8e2b22';

type Ctx = CanvasRenderingContext2D;

const rng = (seed: number) => () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return (seed >>> 8) / 8388608;
};

function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function mid(ctx: Ctx, text: string, y: number, x = TW / 2) {
  ctx.fillText(text, x - ctx.measureText(text).width / 2, y);
}

function track(
  ctx: Ctx,
  text: string,
  x: number,
  y: number,
  sp: number,
  centre: boolean,
) {
  const chars = [...text];
  let total = -sp;
  for (const c of chars) total += ctx.measureText(c).width + sp;
  let cx = centre ? x - total / 2 : x;
  for (const c of chars) {
    ctx.fillText(c, cx, y);
    cx += ctx.measureText(c).width + sp;
  }
}

function lines(ctx: Ctx, text: string, maxW: number) {
  const out: string[] = [];
  let line = '';
  for (const w of text.split(' ')) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > maxW && line) {
      out.push(line);
      line = w;
    } else line = t;
  }
  if (line) out.push(line);
  return out;
}

/** Balanced wrap: the narrowest width that keeps the same line count. */
function wrap(
  ctx: Ctx,
  text: string,
  y: number,
  maxW: number,
  lh: number,
  x?: number,
) {
  const count = lines(ctx, text, maxW).length;
  let w = maxW;
  while (w > maxW * 0.6 && lines(ctx, text, w - 8).length === count) w -= 8;
  let yy = y;
  for (const line of lines(ctx, text, w)) {
    if (x === undefined) mid(ctx, line, yy);
    else ctx.fillText(line, x, yy);
    yy += lh;
  }
  return yy - lh;
}

function signature(ctx: Ctx, x: number, y: number, s: number, seed: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.strokeStyle = 'rgba(59,42,23,.82)';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const rnd = rng(seed * 7919 + 13);
  ctx.beginPath();
  ctx.moveTo(0, 15);
  ctx.bezierCurveTo(-3 + rnd() * 4, -7, 9, -20 - rnd() * 6, 15, -5);
  ctx.bezierCurveTo(18, 7, 7, 15, 9, 4);
  let px = 9;
  let py = 4;
  const n = 4 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const step = 9 + rnd() * 11;
    const nx = px + step;
    const ny = 4 - (i % 2 ? -1 : 1) * (4 + rnd() * 13);
    ctx.bezierCurveTo(
      px + step * 0.35,
      py - 9 - rnd() * 10,
      nx - step * 0.35,
      ny + 7 + rnd() * 8,
      nx,
      ny,
    );
    px = nx;
    py = ny;
  }
  ctx.bezierCurveTo(px + 9, py - 13, px + 21, py + 11, px + 29, py - 3);
  ctx.stroke();
  ctx.beginPath();
  ctx.lineWidth = 1.5;
  ctx.moveTo(-5, 19);
  ctx.quadraticCurveTo(px * 0.55, 24 + rnd() * 5, px + 25, 12 + rnd() * 4);
  ctx.stroke();
  ctx.restore();
}

function paper(ctx: Ctx, seed: number) {
  const rnd = rng(seed);
  ctx.fillStyle = '#efe4cb';
  ctx.fillRect(0, 0, TW, TH);
  for (let i = 0; i < 170; i++) {
    const x = rnd() * TW;
    const y = rnd() * TH;
    const r = 40 + rnd() * 190;
    const a = 0.012 + rnd() * 0.026;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(146,112,62,${a})`);
    g.addColorStop(1, 'rgba(146,112,62,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  ctx.lineWidth = 1;
  for (let i = 0; i < 2600; i++) {
    const x = rnd() * TW;
    const y = rnd() * TH;
    const a = rnd() * Math.PI;
    const l = 3 + rnd() * 11;
    ctx.strokeStyle =
      rnd() < 0.5 ? 'rgba(255,250,238,.22)' : 'rgba(120,96,58,.13)';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
  const vg = ctx.createRadialGradient(
    TW / 2,
    TH / 2,
    TH * 0.28,
    TW / 2,
    TH / 2,
    TH * 0.72,
  );
  vg.addColorStop(0, 'rgba(120,92,48,0)');
  vg.addColorStop(1, 'rgba(120,92,48,.2)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, TW, TH);

  ctx.strokeStyle = INK;
  ctx.lineWidth = 4.5;
  ctx.strokeRect(58, 58, TW - 116, TH - 116);
  ctx.lineWidth = 1.4;
  ctx.strokeRect(76, 76, TW - 152, TH - 152);
  ctx.fillStyle = INK;
  for (const [x, y] of [
    [76, 76],
    [TW - 76, 76],
    [TW - 76, TH - 76],
    [76, TH - 76],
  ]) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-7, -7, 14, 14);
    ctx.restore();
  }
}

function rule(ctx: Ctx, y: number, half: number) {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(TW / 2 - half, y);
  ctx.lineTo(TW / 2 - 16, y);
  ctx.moveTo(TW / 2 + 16, y);
  ctx.lineTo(TW / 2 + half, y);
  ctx.stroke();
  ctx.save();
  ctx.translate(TW / 2, y);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = INK;
  ctx.fillRect(-5, -5, 10, 10);
  ctx.restore();
}

/** The house emblem: a two-leaf tea sprout inside a ring. */
function sprout(ctx: Ctx, r: number, colour: string, width: number) {
  ctx.strokeStyle = colour;
  ctx.fillStyle = colour;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  const leaf = (dir: number) => {
    ctx.beginPath();
    ctx.moveTo(0, r * 0.48);
    ctx.bezierCurveTo(
      dir * r * 0.05,
      r * 0.1,
      dir * r * 0.15,
      -r * 0.28,
      dir * r * 0.04,
      -r * 0.58,
    );
    ctx.bezierCurveTo(
      dir * r * 0.58,
      -r * 0.4,
      dir * r * 0.66,
      r * 0.12,
      0,
      r * 0.48,
    );
    ctx.fill();
  };
  ctx.save();
  ctx.rotate(-0.36);
  leaf(-1);
  ctx.restore();
  ctx.save();
  ctx.rotate(0.3);
  leaf(1);
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(0, r * 0.48);
  ctx.lineTo(0, r * 0.7);
  ctx.stroke();
}

function waxSeal(ctx: Ctx, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);
  const g = ctx.createRadialGradient(-22, -26, 4, 0, 0, 92);
  g.addColorStop(0, '#b24236');
  g.addColorStop(1, '#7a2019');
  ctx.fillStyle = g;
  ctx.beginPath();
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const r = 80 + Math.sin(a * 9) * 4.5;
    if (i) ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    else ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,220,205,.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 61, 0, 7);
  ctx.stroke();
  sprout(ctx, 40, 'rgba(255,226,212,.9)', 4);
  ctx.restore();
}

/** Signature lines on the front, then roster rows on the back, in grid px. */
export const SIGN_SLOTS: [number, number][] = [
  [300, 1188],
  [600, 1188],
  [900, 1188],
  [300, 1370],
  [900, 1370],
];
export const ROSTER_ROW = (i: number): [number, number] => [
  470,
  430 + i * 214 + 80,
];

export function drawFront(ctx: Ctx) {
  paper(ctx, 4711);
  ctx.fillStyle = 'rgba(59,42,23,.78)';
  ctx.font = `700 22px ${SANS}`;
  track(
    ctx,
    `${PROJECT.studio.toUpperCase()} · A CHARTER`,
    TW / 2,
    196,
    9,
    true,
  );
  rule(ctx, 240, 215);

  ctx.fillStyle = INK;
  ctx.font = `400 148px ${SERIF}`;
  mid(ctx, PROJECT.name, 420);
  ctx.font = `italic 400 50px ${SERIF}`;
  mid(ctx, PROJECT.tagline, 500);
  rule(ctx, 562, 160);

  ctx.fillStyle = 'rgba(59,42,23,.72)';
  ctx.font = `700 20px ${SANS}`;
  track(ctx, 'OPEN TO EVERY GUEST WHO BRINGS', TW / 2, 636, 8, true);
  ctx.fillStyle = INK;
  ctx.font = `500 70px ${SERIF}`;
  mid(ctx, 'a thesis already written', 724);

  ctx.fillStyle = 'rgba(59,42,23,.84)';
  ctx.font = `italic 400 36px ${SERIF}`;
  wrap(
    ctx,
    'Pour it at the counter. Iroh answers with live Nansen research, the Shelf keeps the smart-money leaderboard, and the Observatorium shows what the evidence noticed and what it cut.',
    806,
    900,
    52,
  );

  ctx.fillStyle = 'rgba(59,42,23,.7)';
  ctx.font = `700 19px ${SANS}`;
  track(
    ctx,
    'GIVEN AT THE OPEN DOOR · SEPTEMBER MMXXVI',
    TW / 2,
    1036,
    7,
    true,
  );

  TEAM.forEach((member, i) => {
    const [x, y] = SIGN_SLOTS[i];
    signature(ctx, x - 92, y - 40, 2.05, i * 9 + 5);
    ctx.strokeStyle = 'rgba(59,42,23,.5)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x - 124, y);
    ctx.lineTo(x + 124, y);
    ctx.stroke();
    ctx.fillStyle = 'rgba(59,42,23,.9)';
    ctx.font = `500 32px ${SERIF}`;
    mid(ctx, member.handle, y + 42, x);
    ctx.fillStyle = 'rgba(59,42,23,.58)';
    ctx.font = `700 15px ${SANS}`;
    track(ctx, member.roles.split(' · ')[0].toUpperCase(), x, y + 72, 5, true);
  });
  waxSeal(ctx, 600, 1352);

  rule(ctx, 1466, 180);
  ctx.fillStyle = 'rgba(59,42,23,.6)';
  ctx.font = `italic 400 24px ${SERIF}`;
  mid(ctx, 'The thesis review is a demo with synthetic data.', 1512);
}

// Where each face sits in its square sketch: centre x, centre y, crop size.
const CAMEO: Record<string, [number, number, number]> = {
  '0x_iroh': [0.47, 0.34, 0.58],
  '0x_Takezo': [0.52, 0.3, 0.56],
  david_grii: [0.47, 0.32, 0.56],
  PandaCoderexe: [0.52, 0.34, 0.58],
  tldde: [0.56, 0.24, 0.5],
};

export function drawBack(ctx: Ctx, portraits: (HTMLImageElement | null)[]) {
  paper(ctx, 1709);
  ctx.fillStyle = 'rgba(59,42,23,.78)';
  ctx.font = `700 22px ${SANS}`;
  track(
    ctx,
    `${PROJECT.studio.toUpperCase()} · THE SIGNATORIES`,
    TW / 2,
    196,
    9,
    true,
  );
  rule(ctx, 240, 215);
  ctx.fillStyle = INK;
  ctx.font = `400 82px ${SERIF}`;
  mid(ctx, 'Five friends of the Lotus', 346);

  TEAM.forEach((member, i) => {
    const top = ROSTER_ROW(i)[1] - 80;
    const cx = 226;
    const cy = top + 90;
    const img = portraits[i];
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, 84, 0, Math.PI * 2);
    ctx.clip();
    if (img?.complete && img.naturalWidth) {
      const [fx, fy, fs] = CAMEO[member.handle];
      const s = fs * img.naturalWidth;
      ctx.globalCompositeOperation = 'multiply';
      ctx.drawImage(
        img,
        fx * img.naturalWidth - s / 2,
        fy * img.naturalHeight - s / 2,
        s,
        s,
        cx - 84,
        cy - 84,
        168,
        168,
      );
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(59,42,23,.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 88, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.arc(cx, cy, 95, 0, Math.PI * 2);
    ctx.stroke();

    const x = 360;
    ctx.fillStyle = INK;
    ctx.font = `500 52px ${SERIF}`;
    ctx.fillText(member.handle, x, top + 50);
    ctx.fillStyle = EARTH;
    ctx.font = `700 17px ${SANS}`;
    track(ctx, member.roles.toUpperCase(), x, top + 88, 4, false);
    ctx.fillStyle = 'rgba(59,42,23,.84)';
    ctx.font = `italic 400 29px ${SERIF}`;
    wrap(ctx, member.bio, top + 132, 740, 38, x);
  });

  rule(ctx, 1474, 180);
  ctx.fillStyle = 'rgba(59,42,23,.6)';
  ctx.font = `700 16px ${SANS}`;
  track(ctx, 'EACH OF US IS ON X · COME SAY HELLO', TW / 2, 1506, 6, true);
}

export function sheetCanvas(draw: (ctx: Ctx) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = TW * SCALE;
  canvas.height = TH * SCALE;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(SCALE, SCALE);
  rr(ctx, 0, 0, TW, TH, 26);
  ctx.clip();
  draw(ctx);
  return canvas;
}
