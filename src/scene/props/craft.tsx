import { useEffect, useState } from 'react';
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  Euler,
  Matrix4,
  Quaternion,
  SRGBColorSpace,
  TubeGeometry,
  Vector3,
  type Curve,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Point } from '../stations';
import { useSurfaceMaps } from '../Surfaces';

/** Builds a GPU resource once and disposes it on unmount. */
export function useBuilt<T extends { dispose(): void }>(make: () => T) {
  const [value] = useState(make);
  useEffect(() => () => value.dispose(), [value]);
  return value;
}

export function canvasTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d')!);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** Metres per wood texture tile: [along the grain, across it]; matches Surfaces. */
const WOOD_TILE: [number, number] = [1.6, 0.4];

/** Box-projected UVs in texture tiles, with the grain along `grain` when a face contains it. */
export function boxUv(
  geometry: BufferGeometry,
  grain: number,
  seed = 0,
  [along, across] = WOOD_TILE,
) {
  const position = geometry.attributes.position,
    normal = geometry.attributes.normal,
    uv = new Float32Array(position.count * 2),
    offsetU = (seed * 7.31) % 1,
    offsetV = (seed * 3.17) % 1;
  for (let i = 0; i < position.count; i++) {
    const n = [
      Math.abs(normal.getX(i)),
      Math.abs(normal.getY(i)),
      Math.abs(normal.getZ(i)),
    ];
    const face = n[0] > n[1] && n[0] > n[2] ? 0 : n[1] > n[2] ? 1 : 2;
    const [a, b] = face === 0 ? [2, 1] : face === 1 ? [0, 2] : [0, 1];
    const g = a === grain || b === grain ? grain : a,
      c = g === a ? b : a;
    uv[i * 2] = position.getComponent(i, g) / along + offsetU;
    uv[i * 2 + 1] = position.getComponent(i, c) / across + offsetV;
  }
  geometry.setAttribute('uv', new BufferAttribute(uv, 2));
  return geometry;
}

/** Fills a linear-space vertex colour attribute. */
export function paint(geometry: BufferGeometry, color: string | Color) {
  const c = typeof color === 'string' ? new Color(color) : color,
    count = geometry.attributes.position.count,
    data = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) c.toArray(data, i * 3);
  geometry.setAttribute('color', new BufferAttribute(data, 3));
  return geometry;
}

const matrix = new Matrix4(),
  quaternion = new Quaternion(),
  euler = new Euler(),
  vPosition = new Vector3(),
  vScale = new Vector3();
export function place(
  geometry: BufferGeometry,
  position: Point,
  rotation: Point = [0, 0, 0],
  scale: number | Point = 1,
) {
  const s = typeof scale === 'number' ? [scale, scale, scale] : scale;
  matrix.compose(
    vPosition.set(...position),
    quaternion.setFromEuler(euler.set(...rotation)),
    vScale.set(s[0], s[1], s[2]),
  );
  return geometry.applyMatrix4(matrix);
}

/** A rounded wood block with grain-aligned UVs and a vertex colour, placed in world space. */
export function block(
  size: Point,
  position: Point,
  color: string,
  {
    rotation,
    radius,
    grain,
  }: { rotation?: Point; radius?: number; grain?: number } = {},
) {
  const geometry = new RoundedBoxGeometry(
    ...size,
    2,
    radius ?? Math.min(0.006, Math.min(...size) * 0.4),
  );
  const seed = Math.abs(
    Math.sin(position[0] * 12.99 + position[1] * 78.23 + position[2] * 37.72) *
      437.58,
  );
  boxUv(geometry, grain ?? size.indexOf(Math.max(...size)), seed);
  return place(paint(geometry, color), position, rotation);
}

/** Merges parts into one static geometry; keeps only position, normal, uv and color. */
export function merge(parts: BufferGeometry[]) {
  const indexed = parts.every((part) => part.index);
  const ready = parts.map((part) => {
    const geometry = indexed || !part.index ? part : part.toNonIndexed();
    for (const name of Object.keys(geometry.attributes))
      if (!['position', 'normal', 'uv', 'color'].includes(name))
        geometry.deleteAttribute(name);
    geometry.clearGroups();
    return geometry;
  });
  const merged = mergeGeometries(ready)!;
  ready.forEach((geometry) => geometry.dispose());
  merged.computeBoundingSphere();
  return merged;
}

/** A tube whose radius follows `radius(t)`; UVs run in texture tiles along and around it. */
export function taperedTube(
  curve: Curve<Vector3>,
  radius: (t: number) => number,
  tubular = 24,
  radial = 7,
  [along, around] = WOOD_TILE,
) {
  const geometry = new TubeGeometry(curve, tubular, 1, radial, false);
  const position = geometry.attributes.position,
    uv = geometry.attributes.uv,
    length = curve.getLength(),
    p = new Vector3(),
    v = new Vector3();
  for (let i = 0; i <= tubular; i++) {
    const t = i / tubular,
      r = radius(t);
    curve.getPointAt(t, p);
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      v.fromBufferAttribute(position, k).sub(p).multiplyScalar(r).add(p);
      position.setXYZ(k, v.x, v.y, v.z);
      uv.setXY(k, (t * length) / along, ((j / radial) * r * 6.3) / around);
    }
  }
  return geometry;
}

/** Oiled-wood material for merged parts; tone comes from vertex colours. */
export function WoodMaterial({ clearcoat }: { clearcoat?: number }) {
  const maps = useSurfaceMaps('wood');
  const props = {
    vertexColors: true,
    map: maps.color,
    normalMap: maps.normal,
    roughnessMap: maps.rough,
    roughness: 1,
  };
  return clearcoat ? (
    <meshPhysicalMaterial
      {...props}
      clearcoat={clearcoat}
      clearcoatRoughness={0.3}
    />
  ) : (
    <meshStandardMaterial {...props} />
  );
}

/** A dry-brush ink stroke: bristle lines along a path, thinning and fading toward the end. */
export function inkStroke(
  ctx: CanvasRenderingContext2D,
  path: [number, number][],
  width: number,
  random: () => number,
  ink = '24,17,12',
) {
  const bristles = Math.max(5, Math.round(width * 1.4));
  for (let b = 0; b < bristles; b++) {
    const offset = (b / (bristles - 1) - 0.5) * width,
      dry = 0.55 + random() * 0.45;
    ctx.beginPath();
    path.forEach(([x, y], i) => {
      const t = i / (path.length - 1),
        [nx, ny] = path[Math.min(i + 1, path.length - 1)],
        [px, py] = path[Math.max(i - 1, 0)],
        dx = nx - px,
        dy = ny - py,
        length = Math.hypot(dx, dy) || 1,
        o = offset * (1.1 - t * 0.7);
      const X = x - (dy / length) * o,
        Y = y + (dx / length) * o;
      if (i === 0) ctx.moveTo(X, Y);
      else if (t < dry || Math.abs(offset) < width * 0.25) ctx.lineTo(X, Y);
    });
    ctx.strokeStyle = `rgba(${ink},${0.45 + random() * 0.5})`;
    ctx.lineWidth = Math.max(0.8, (width / bristles) * (1.4 + random()));
    ctx.lineCap = 'round';
    ctx.stroke();
  }
}

const BRUSH_FONT =
  '"Hiragino Mincho ProN","Yu Mincho","YuMincho","Noto Serif JP","Noto Serif CJK JP","MS Mincho",serif';

/** Real Japanese text written top to bottom, centred on x, in a heavy mincho face. */
export function brushText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  ink = '24,17,12',
) {
  ctx.save();
  ctx.font = `600 ${size}px ${BRUSH_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = `rgba(${ink},.9)`;
  [...text].forEach((char, i) => ctx.fillText(char, x, y + i * size * 1.04));
  ctx.restore();
}

/** Speckled handmade-paper fill. */
export function paper(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  tone: string,
  random: () => number,
) {
  ctx.fillStyle = tone;
  ctx.fillRect(x, y, w, h);
  for (let i = 0; i < (w * h) / 40; i++) {
    ctx.fillStyle = `rgba(110,80,45,${random() * 0.07})`;
    ctx.fillRect(
      x + random() * w,
      y + random() * h,
      1 + random() * 5,
      0.6 + random(),
    );
  }
}
