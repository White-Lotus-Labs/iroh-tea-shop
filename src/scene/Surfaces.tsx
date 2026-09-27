import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import {
  CanvasTexture,
  Color,
  DataTexture,
  Matrix4,
  type InstancedMesh,
  LinearFilter,
  LinearMipmapLinearFilter,
  NoColorSpace,
  RepeatWrapping,
  RGBAFormat,
  SRGBColorSpace,
  Vector2,
  type ColorSpace,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Point } from './stations';
import { createRandom } from './motion/dynamics';
export type Surface =
  | 'wood'
  | 'plaster'
  | 'paper'
  | 'cloth'
  | 'floor'
  | 'tatami'
  | 'shoji';

/** Metres covered by one texture tile on a Solid: [along the grain, across it]. */
const TILE: Record<Surface, [number, number]> = {
  wood: [1.6, 0.4],
  floor: [3.2, 0.96],
  plaster: [1.4, 1.4],
  paper: [0.7, 0.7],
  shoji: [0.7, 0.7],
  cloth: [0.35, 0.35],
  tatami: [0.45, 0.45],
};
const SIZE: Record<Surface, [number, number]> = {
  wood: [512, 512],
  floor: [1024, 512],
  plaster: [512, 512],
  paper: [256, 256],
  shoji: [256, 256],
  cloth: [256, 256],
  tatami: [512, 256],
};
const RELIEF: Record<Surface, number> = {
  wood: 1.5,
  floor: 2.6,
  plaster: 0.4,
  paper: 1.2,
  shoji: 1.2,
  cloth: 1.6,
  tatami: 3,
};

/** Tileable value noise. Coordinates and period are in lattice cells. */
function periodicNoise(seed: number) {
  const random = createRandom(seed);
  const values = Float32Array.from({ length: 256 }, () => random());
  const perm = Uint8Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  const at = (x: number, y: number) => values[perm[(perm[y & 255] + x) & 255]];
  return (x: number, y: number, px: number, py: number) => {
    const xi = Math.floor(x),
      yi = Math.floor(y),
      fx = x - xi,
      fy = y - yi,
      u = fx * fx * (3 - 2 * fx),
      v = fy * fy * (3 - 2 * fy),
      x0 = ((xi % px) + px) % px,
      y0 = ((yi % py) + py) % py,
      x1 = (x0 + 1) % px,
      y1 = (y0 + 1) % py,
      a = at(x0, y0),
      b = at(x1, y0),
      c = at(x0, y1),
      d = at(x1, y1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}
type Noise = ReturnType<typeof periodicNoise>;
function fbm(
  noise: Noise,
  x: number,
  y: number,
  px: number,
  py: number,
  octaves: number,
) {
  let sum = 0,
    amp = 0.5,
    norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise(x, y, px, py);
    norm += amp;
    x *= 2;
    y *= 2;
    px *= 2;
    py *= 2;
    amp *= 0.5;
  }
  return sum / norm;
}
const smooth = (edge0: number, edge1: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/** albedo multiplier, roughness, height, warm shift; s runs along the grain. */
type Texel = [number, number, number, number];
function sampler(kind: Surface): (s: number, t: number) => Texel {
  const n1 = periodicNoise(715),
    n2 = periodicNoise(211),
    n3 = periodicNoise(937),
    n4 = periodicNoise(58);
  const grain = (s: number, t: number, seed = 0, lines = 60): Texel => {
    const figure = fbm(n1, s, t * 6 + seed, 1, 6, 4);
    const warp = fbm(n2, s * 2, t * 2 + seed, 2, 2, 3);
    const line =
      0.5 + 0.5 * Math.sin((t * lines + warp * 3 + seed) * Math.PI * 2);
    const late = smooth(0.62, 1, line) ** 1.5;
    const fine = fbm(n3, s * 6, t * 120, 6, 120, 2);
    const pore = Math.max(0, n4(s * 40, t * 320, 40, 320) - 0.7) * 3.2;
    return [
      0.86 +
        (figure - 0.5) * 0.26 -
        late * 0.09 +
        (fine - 0.5) * 0.04 -
        pore * 0.08,
      0.5 + late * 0.08 + pore * 0.3 + (fine - 0.5) * 0.08,
      0.6 - late * 0.12 - pore * 0.35 + (fine - 0.5) * 0.2,
      late * 0.04 + (figure - 0.5) * 0.08,
    ];
  };
  switch (kind) {
    case 'wood':
      return (s, t) => grain(s, t);
    case 'floor': {
      const planks = 4,
        random = createRandom(4401);
      const plank = Array.from({ length: planks }, () => ({
        tone: random() - 0.5,
        joint: random(),
        warm: random() - 0.5,
        wear: random(),
      }));
      return (s, t) => {
        const index = Math.min(planks - 1, Math.floor(t * planks)),
          across = t * planks - index,
          p = plank[index];
        const [albedo, rough, height, warm] = grain(
          s,
          across / planks,
          index * 3,
          84,
        );
        const edge = Math.min(across, 1 - across);
        const gap = 1 - smooth(0.004, 0.02, edge);
        const jointDistance = Math.abs(((s - p.joint + 1.5) % 1) - 0.5);
        const joint = 1 - smooth(0.0008, 0.0035, jointDistance);
        const seam = Math.max(gap, joint);
        const wear = fbm(n2, s * 2, t * 2, 2, 2, 4);
        return [
          (albedo * (1 + p.tone * 0.15) + (wear - 0.5) * 0.12) *
            (1 - seam * 0.7),
          Math.min(
            1,
            0.34 +
              rough * 0.35 +
              (wear - 0.5) * 0.18 +
              p.wear * 0.08 +
              seam * 0.5,
          ),
          height * (1 - seam) + (edge < 0.05 ? -0.15 * (1 - edge / 0.05) : 0),
          warm + p.warm * 0.06,
        ];
      };
    }
    case 'plaster':
      return (s, t) => {
        const mottle = fbm(n1, s * 2, t * 2, 2, 2, 5);
        const cloud = fbm(n4, s * 6, t * 6, 6, 6, 3);
        const trowel = fbm(n2, (s + t) * 6, (s - t) * 14, 6, 14, 3);
        const sand = n3(s * 240, t * 240, 240, 240);
        const speck = Math.max(0, sand - 0.88) * 5;
        const straw = Math.max(0, n4(s * 160, t * 14, 160, 14) - 0.8) * 3;
        return [
          0.9 +
            (mottle - 0.5) * 0.12 +
            (cloud - 0.5) * 0.06 +
            (trowel - 0.5) * 0.04 +
            (sand - 0.5) * 0.05 -
            speck * 0.12 +
            straw * 0.07,
          0.94 + (sand - 0.5) * 0.06 - (trowel - 0.5) * 0.04,
          mottle * 0.1 + trowel * 0.25 + sand * 0.55 + straw * 0.1,
          (mottle - 0.5) * 0.03 + straw * 0.04,
        ];
      };
    case 'paper':
    case 'shoji':
      return (s, t) => {
        const cloud = fbm(n1, s * 4, t * 4, 4, 4, 4);
        const fibre = fbm(n2, s * 6, t * 80, 6, 80, 2);
        const cross = fbm(n3, s * 70, t * 5, 70, 5, 2);
        return [
          0.93 +
            (cloud - 0.5) * 0.14 +
            (fibre - 0.5) * 0.08 +
            (cross - 0.5) * 0.06,
          0.9,
          fibre * 0.5 + cross * 0.3 + cloud * 0.2,
          (cloud - 0.5) * 0.04,
        ];
      };
    case 'cloth':
      return (s, t) => {
        const cells = 96,
          x = s * cells,
          y = t * cells,
          over = (Math.floor(x) + Math.floor(y)) % 4 < 2;
        const thread = over
          ? Math.sin(Math.PI * (y - Math.floor(y)))
          : Math.sin(Math.PI * (x - Math.floor(x)));
        const slub = fbm(n1, s * 6, t * 6, 6, 6, 3);
        return [
          0.8 + thread * 0.14 + (slub - 0.5) * 0.14,
          0.86 + (1 - thread) * 0.1,
          thread * 0.8 + slub * 0.2,
          0,
        ];
      };
    case 'tatami':
      return (s, t) => {
        const stalks = 128,
          x = s * stalks,
          xi = Math.floor(x),
          round = Math.sin(Math.PI * (x - xi));
        const tone = n1(xi, 0.5, stalks, 1) - 0.5;
        const warpLine = 1 - smooth(0.02, 0.07, Math.abs(((t * 22) % 1) - 0.5));
        const age = fbm(n2, s * 3, t * 3, 3, 3, 4);
        return [
          0.76 +
            round * 0.16 +
            tone * 0.16 -
            warpLine * 0.22 +
            (age - 0.5) * 0.14,
          0.74 - round * 0.16 + warpLine * 0.1,
          round * 0.75 - warpLine * 0.35,
          tone * 0.06 + (age - 0.5) * 0.05,
        ];
      };
  }
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
/** A canvas texture painted once by a module-level `draw`, disposed on unmount. */
export function useCanvasTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
) {
  const texture = useMemo(
    () => canvasTexture(width, height, draw),
    [width, height, draw],
  );
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

function dataTexture(
  data: Uint8Array,
  width: number,
  height: number,
  colorSpace: ColorSpace,
) {
  const texture = new DataTexture(data, width, height, RGBAFormat);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.colorSpace = colorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

/** Colour, tangent-space normal, and roughness maps from one procedural height field. */
function surfaceMaps(kind: Surface) {
  const [width, height] = SIZE[kind],
    sample = sampler(kind),
    count = width * height,
    heights = new Float32Array(count),
    color = new Uint8Array(count * 4),
    normal = new Uint8Array(count * 4),
    rough = new Uint8Array(count * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const [albedo, roughness, h, warm] = sample(x / width, y / height);
      const i = y * width + x,
        a = Math.max(0, Math.min(1, albedo)) * 255;
      heights[i] = h;
      color[i * 4] = Math.min(255, a * (1 + warm));
      color[i * 4 + 1] = a;
      color[i * 4 + 2] = Math.max(0, a * (1 - warm * 1.4));
      color[i * 4 + 3] = 255;
      rough[i * 4 + 1] = Math.max(0, Math.min(1, roughness)) * 255;
      rough[i * 4 + 3] = 255;
    }
  const relief = RELIEF[kind];
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const at = (dx: number, dy: number) =>
        heights[
          ((y + dy + height) % height) * width + ((x + dx + width) % width)
        ];
      const nx = (at(-1, 0) - at(1, 0)) * relief,
        ny = (at(0, -1) - at(0, 1)) * relief,
        length = Math.hypot(nx, ny, 1),
        i = (y * width + x) * 4;
      normal[i] = (nx / length) * 127.5 + 127.5;
      normal[i + 1] = (ny / length) * 127.5 + 127.5;
      normal[i + 2] = (1 / length) * 127.5 + 127.5;
      normal[i + 3] = 255;
    }
  return {
    color: dataTexture(color, width, height, SRGBColorSpace),
    normal: dataTexture(normal, width, height, NoColorSpace),
    rough: dataTexture(rough, width, height, NoColorSpace),
  };
}
type Maps = ReturnType<typeof surfaceMaps>;
const KINDS = Object.keys(TILE) as Surface[];
const SurfaceContext = createContext<Record<Surface, Maps> | null>(null);
export function Surfaces({ children }: { children: ReactNode }) {
  const textures = useMemo(
    () =>
      Object.fromEntries(
        KINDS.map((kind) => [kind, surfaceMaps(kind)]),
      ) as Record<Surface, Maps>,
    [],
  );
  useEffect(
    () => () =>
      Object.values(textures).forEach((maps) =>
        Object.values(maps).forEach((texture) => texture.dispose()),
      ),
    [textures],
  );
  return (
    <SurfaceContext.Provider value={textures}>
      {children}
    </SurfaceContext.Provider>
  );
}
export function useSurfaceMaps(surface: Surface) {
  return useContext(SurfaceContext)![surface];
}
const NORMAL_SCALE = new Vector2(1, 1);
export function SurfaceMaterial({
  surface = 'wood',
  color,
  clearcoat,
  glow = 0.55,
}: {
  surface?: Surface;
  color: string;
  clearcoat?: number;
  glow?: number;
}) {
  const maps = useSurfaceMaps(surface);
  const props = {
    color,
    map: maps.color,
    normalMap: maps.normal,
    normalScale: NORMAL_SCALE,
    roughnessMap: maps.rough,
    roughness: 1,
    ...(surface === 'shoji' && {
      emissive: '#ffbf78',
      emissiveMap: maps.color,
      emissiveIntensity: glow,
    }),
  };
  return clearcoat ? (
    <meshPhysicalMaterial
      {...props}
      clearcoat={clearcoat}
      clearcoatRoughness={0.24}
    />
  ) : (
    <meshStandardMaterial {...props} />
  );
}

/** Many static boxes in one draw call; `jitter` varies each box's tone. */
export function Boxes({
  items,
  color,
  surface = 'wood',
  jitter = 0,
  cast = true,
  seed = 1,
}: {
  items: [position: Point, size: Point][];
  color: string;
  surface?: Surface;
  jitter?: number;
  cast?: boolean;
  seed?: number;
}) {
  const maps = useSurfaceMaps(surface);
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current!,
      random = createRandom(seed),
      matrix = new Matrix4(),
      tint = new Color();
    items.forEach(([[x, y, z], [sx, sy, sz]], i) => {
      mesh.setMatrixAt(i, matrix.makeScale(sx, sy, sz).setPosition(x, y, z));
      if (jitter)
        mesh.setColorAt(i, tint.setScalar(1 - jitter / 2 + random() * jitter));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items, jitter, seed]);
  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, items.length]}
      castShadow={cast}
      receiveShadow
    >
      <boxGeometry />
      <meshStandardMaterial
        color={color}
        map={maps.color}
        normalMap={maps.normal}
        roughnessMap={maps.rough}
        roughness={1}
      />
    </instancedMesh>
  );
}

/** Box-projected UVs in metres, with the grain along `longest` when a face contains it. */
function worldUvs(
  geometry: RoundedBoxGeometry,
  size: Point,
  surface: Surface,
  seed: number,
  longest: number,
) {
  const position = geometry.attributes.position,
    normal = geometry.attributes.normal,
    uv = geometry.attributes.uv,
    [along, across] = TILE[surface],
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
    const grain =
      a === longest || b === longest ? longest : size[a] >= size[b] ? a : b;
    const cross = grain === a ? b : a;
    uv.setXY(
      i,
      position.getComponent(i, grain) / along + offsetU,
      position.getComponent(i, cross) / across + offsetV,
    );
  }
  uv.needsUpdate = true;
}
export function Solid({
  position,
  size,
  color,
  surface = 'wood',
  clearcoat,
  cast = true,
  grain,
}: {
  position: Point;
  size: Point;
  color: string;
  surface?: Surface;
  clearcoat?: number;
  cast?: boolean;
  /** Axis the grain runs along; defaults to the longest side. */
  grain?: 0 | 1 | 2;
}) {
  const [x, y, z] = size;
  const [px, py, pz] = position;
  const geometry = useMemo(() => {
    const box = new RoundedBoxGeometry(
      x,
      y,
      z,
      2,
      Math.min(0.014, x * 0.12, y * 0.12, z * 0.12),
    );
    const seed = Math.abs(
      Math.sin(px * 12.9898 + py * 78.233 + pz * 37.719) * 43758.5453,
    );
    const longest = grain ?? [x, y, z].indexOf(Math.max(x, y, z));
    worldUvs(box, [x, y, z], surface, seed, longest);
    return box;
  }, [x, y, z, px, py, pz, surface, grain]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh
      geometry={geometry}
      position={position}
      receiveShadow
      castShadow={cast}
    >
      <SurfaceMaterial surface={surface} color={color} clearcoat={clearcoat} />
    </mesh>
  );
}
