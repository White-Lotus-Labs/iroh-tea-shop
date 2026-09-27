import type { Member } from './content';

// One face of a tanzaku, drawn on a fixed grid. The slip is about 1:3.8.
export const FW = 360;
export const FH = 1368;
/** Where the cord passes through, measured down from the top edge. */
export const HOLE_Y = 60;

const SERIF =
  '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif';
const SANS = 'Arial, Helvetica, sans-serif';
const INK = '#2b1d13';
const SEAL = '#a8321f';

// Tanabata's five colours (goshiki), softened into washi tints for dusk.
export const PAPERS = ['#e9a491', '#ecd48c', '#b8c99a', '#efe6d3', '#c6b4d8'];

// Where each face sits in its square sketch: centre x, centre y, crop size.
export const CAMEO: Record<string, [number, number, number]> = {
  '0x_iroh': [0.47, 0.34, 0.58],
  '0x_Takezo': [0.52, 0.3, 0.56],
  david_grii: [0.47, 0.32, 0.56],
  PandaCoderexe: [0.52, 0.34, 0.58],
  tldde: [0.56, 0.24, 0.5],
};

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

/** Letter-spaced text along the current x axis. */
function track(
  ctx: Ctx,
  text: string,
  x: number,
  y: number,
  sp: number,
  centre = false,
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

/** Latin set on its side, reading top to bottom, like vertical Japanese. */
function vertical(ctx: Ctx, x: number, y: number, draw: () => void) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.PI / 2);
  ctx.textBaseline = 'middle';
  draw();
  ctx.restore();
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

/** The house emblem: a two-leaf tea sprout inside a ring. */
export function sprout(ctx: Ctx, r: number, colour: string, width: number) {
  ctx.strokeStyle = colour;
  ctx.fillStyle = colour;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  const leaf = (dir: number, turn: number) => {
    ctx.save();
    ctx.rotate(turn);
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
    ctx.restore();
  };
  leaf(-1, -0.36);
  leaf(1, 0.3);
  ctx.beginPath();
  ctx.moveTo(0, r * 0.48);
  ctx.lineTo(0, r * 0.7);
  ctx.stroke();
}

function washi(ctx: Ctx, colour: string, seed: number) {
  const rnd = rng(seed);
  // A torn, not cut, edge: the outline wanders a pixel or two.
  ctx.beginPath();
  ctx.moveTo(4, 4);
  for (let x = 4; x <= FW - 4; x += 10) ctx.lineTo(x, 2.5 + rnd() * 3);
  for (let y = 4; y <= FH - 4; y += 10) ctx.lineTo(FW - 2.5 - rnd() * 3, y);
  for (let x = FW - 4; x >= 4; x -= 10) ctx.lineTo(x, FH - 2.5 - rnd() * 3);
  for (let y = FH - 4; y >= 4; y -= 10) ctx.lineTo(2.5 + rnd() * 3, y);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = colour;
  ctx.fillRect(0, 0, FW, FH);

  // Cloudy density, the way handmade sheets thin and thicken.
  for (let i = 0; i < 70; i++) {
    const x = rnd() * FW;
    const y = rnd() * FH;
    const r = 30 + rnd() * 120;
    const light = rnd() < 0.5;
    const a = 0.03 + rnd() * 0.05;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, light ? `rgba(255,252,242,${a})` : `rgba(96,62,30,${a})`);
    g.addColorStop(1, light ? 'rgba(255,252,242,0)' : 'rgba(96,62,30,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  ctx.lineWidth = 1;
  for (let i = 0; i < 1100; i++) {
    const x = rnd() * FW;
    const y = rnd() * FH;
    const a = rnd() * Math.PI;
    const l = 3 + rnd() * 9;
    ctx.strokeStyle =
      rnd() < 0.55 ? 'rgba(255,251,240,.26)' : 'rgba(90,60,30,.12)';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
  // Long kozo fibres.
  ctx.lineWidth = 0.9;
  for (let i = 0; i < 34; i++) {
    const x = rnd() * FW;
    const y = rnd() * FH;
    const a = rnd() * Math.PI * 2;
    const l = 40 + rnd() * 90;
    ctx.strokeStyle = `rgba(255,250,238,${0.18 + rnd() * 0.2})`;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(
      x + Math.cos(a + 0.8) * l * 0.5,
      y + Math.sin(a + 0.8) * l * 0.5,
      x + Math.cos(a) * l,
      y + Math.sin(a) * l,
    );
    ctx.stroke();
  }
  // Scattered gold leaf, as on good tanzaku.
  for (let i = 0; i < 26; i++) {
    const x = rnd() * FW;
    const y = rnd() * FH;
    const s = 2 + rnd() * 6;
    ctx.fillStyle = `rgba(206,160,74,${0.35 + rnd() * 0.35})`;
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.lineTo(x + s * (0.5 + rnd()), y - s * 0.2);
    ctx.lineTo(x + s * 0.3, y + s);
    ctx.lineTo(x - s * (0.4 + rnd() * 0.6), y + s * 0.3);
    ctx.closePath();
    ctx.fill();
  }
  const edge = ctx.createLinearGradient(0, 0, FW, 0);
  edge.addColorStop(0, 'rgba(80,50,24,.16)');
  edge.addColorStop(0.1, 'rgba(80,50,24,0)');
  edge.addColorStop(0.9, 'rgba(80,50,24,0)');
  edge.addColorStop(1, 'rgba(80,50,24,.16)');
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, FW, FH);
}

function hole(ctx: Ctx) {
  ctx.strokeStyle = 'rgba(70,44,20,.3)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(FW / 2, HOLE_Y, 16, 0, Math.PI * 2);
  ctx.stroke();
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(FW / 2, HOLE_Y, 9.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function hanko(ctx: Ctx, y: number, size: number, paper: string, seed: number) {
  const rnd = rng(seed);
  ctx.save();
  ctx.translate(FW / 2, y);
  ctx.rotate(-0.05);
  ctx.fillStyle = SEAL;
  rr(ctx, -size / 2, -size / 2, size, size, size * 0.12);
  ctx.fill();
  ctx.strokeStyle = paper;
  ctx.lineWidth = size * 0.035;
  rr(ctx, -size * 0.4, -size * 0.4, size * 0.8, size * 0.8, size * 0.06);
  ctx.stroke();
  sprout(ctx, size * 0.28, paper, size * 0.035);
  // Stamps never take evenly.
  ctx.fillStyle = paper;
  for (let i = 0; i < 70; i++) {
    ctx.globalAlpha = 0.25 + rnd() * 0.5;
    const r = 0.6 + rnd() * 1.6;
    ctx.beginPath();
    ctx.arc((rnd() - 0.5) * size, (rnd() - 0.5) * size, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawFront(
  ctx: Ctx,
  member: Member,
  i: number,
  portrait: HTMLImageElement | null,
) {
  const paper = PAPERS[i];
  washi(ctx, paper, 311 + i * 97);
  hole(ctx);

  const cx = FW / 2;
  const cy = 236;
  const r = 112;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,252,244,.4)';
  ctx.fill();
  if (portrait?.complete && portrait.naturalWidth) {
    const [fx, fy, fs] = CAMEO[member.handle];
    const s = fs * portrait.naturalWidth;
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(
      portrait,
      fx * portrait.naturalWidth - s / 2,
      fy * portrait.naturalHeight - s / 2,
      s,
      s,
      cx - r,
      cy - r,
      2 * r,
      2 * r,
    );
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(43,29,19,.72)';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 12, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = 'rgba(43,29,19,.55)';
  ctx.save();
  ctx.translate(cx, 392);
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-4, -4, 8, 8);
  ctx.restore();

  // Handle first, then the roles in a slim column to its right.
  const label = `@${member.handle}`;
  let size = 74;
  ctx.font = `500 ${size}px ${SERIF}`;
  const room = 740;
  const w = ctx.measureText(label).width;
  if (w > room) {
    size = Math.floor((size * room) / w);
    ctx.font = `500 ${size}px ${SERIF}`;
  }
  ctx.fillStyle = INK;
  vertical(ctx, 164, 440, () => ctx.fillText(label, 0, 0));
  ctx.font = `700 21px ${SANS}`;
  ctx.fillStyle = 'rgba(43,29,19,.7)';
  vertical(ctx, 284, 444, () =>
    track(ctx, member.roles.toUpperCase(), 0, 0, 3),
  );
  ctx.strokeStyle = 'rgba(43,29,19,.28)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(250, 440);
  ctx.lineTo(250, 1160);
  ctx.stroke();

  hanko(ctx, 1262, 76, paper, 900 + i);
}

export function drawBack(ctx: Ctx, member: Member, i: number) {
  const paper = PAPERS[i];
  washi(ctx, paper, 733 + i * 131);
  hole(ctx);
  ctx.save();
  ctx.translate(FW / 2, 150);
  sprout(ctx, 24, 'rgba(43,29,19,.5)', 2.2);
  ctx.restore();

  // The wish, in columns read right to left.
  ctx.font = `italic 400 33px ${SERIF}`;
  ctx.fillStyle = 'rgba(43,29,19,.88)';
  const cols = lines(ctx, member.bio, 900);
  const gap = 54;
  const x0 = FW / 2 + ((cols.length - 1) * gap) / 2;
  cols.forEach((text, k) =>
    vertical(ctx, x0 - k * gap, 222, () => ctx.fillText(text, 0, 0)),
  );

  ctx.font = `italic 400 24px ${SERIF}`;
  ctx.fillStyle = 'rgba(43,29,19,.7)';
  track(ctx, `— @${member.handle}`, FW / 2, 1320, 0.5, true);
  hanko(ctx, 1244, 54, paper, 1200 + i);
}

export function faceCanvas(draw: (ctx: Ctx) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = FW;
  canvas.height = FH;
  draw(canvas.getContext('2d')!);
  return canvas;
}
