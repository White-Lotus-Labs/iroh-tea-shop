import {
  CylinderGeometry,
  LatheGeometry,
  SphereGeometry,
  Vector2,
} from 'three';
import type { CanvasTexture } from 'three';
import type { Point } from '../stations';
import { createRandom } from '../motion/dynamics';
import {
  block,
  canvasTexture,
  merge,
  paint,
  place,
  useBuilt,
  WoodMaterial,
} from './craft';

const timber = '#3a2419';
const BANDS: [number, number][] = [
  [0.985, 2.26],
  [2.38, 3.265],
];

let wear: CanvasTexture | undefined;
// ponytail: one shared, never-disposed 256² texture for every bay; stains repeat per bay.
function wearTexture() {
  wear ??= canvasTexture(256, 256, (ctx) => {
    const random = createRandom(404);
    const edge = (
      x0: number,
      y0: number,
      x1: number,
      y1: number,
      alpha: number,
    ) => {
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, `rgba(20,12,6,${alpha})`);
      g.addColorStop(1, 'rgba(20,12,6,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 256);
    };
    edge(0, 0, 0, 56, 0.5);
    edge(0, 256, 0, 190, 0.42);
    edge(0, 0, 34, 0, 0.36);
    edge(256, 0, 222, 0, 0.36);
    for (let i = 0; i < 5; i++) {
      const x = 30 + random() * 196,
        y = 60 + random() * 150,
        r = 20 + random() * 50,
        g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(60,38,18,${0.06 + random() * 0.08})`);
      g.addColorStop(1, 'rgba(60,38,18,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 256);
    }
  });
  return wear;
}

/**
 * Trim for a plaster wall whose inner face sits at x = `face`: wainscot stiles, bronze
 * nail covers on the nageshi at each post, and soft grime in every plaster bay.
 */
export function WallTrim({
  face,
  from,
  to,
  posts,
  window,
}: {
  face: number;
  from: number;
  to: number;
  posts: number[];
  /** z range of an opening in the lower plaster band, left bare. */
  window?: [number, number];
}) {
  const side = Math.sign(face),
    at = (depth: number) => face - side * depth;
  const built = useBuilt(() => {
    const stiles = [];
    for (let z = from + 0.22; z < to - 0.1; z += 0.45)
      if (posts.every((p) => Math.abs(p - z) > 0.12))
        stiles.push(block([0.014, 0.84, 0.034], [at(0.046), 0.51, z], timber));
    const covers = posts.flatMap((z) => [
      paint(
        place(
          new CylinderGeometry(0.034, 0.038, 0.01, 18),
          [at(0.093), 2.32, z],
          [0, 0, Math.PI / 2],
        ),
        '#8a6a34',
      ),
      paint(
        place(new SphereGeometry(0.013, 12, 8), [at(0.098), 2.32, z]),
        '#b08a48',
      ),
    ]);
    const wood = merge(stiles),
      bronze = merge(covers);
    return {
      wood,
      bronze,
      dispose() {
        wood.dispose();
        bronze.dispose();
      },
    };
  });
  const edges = [...new Set([from, ...posts, to])].sort((a, b) => a - b);
  const map = wearTexture();
  return (
    <group>
      <mesh geometry={built.wood} receiveShadow>
        <WoodMaterial />
      </mesh>
      <mesh geometry={built.bronze}>
        <meshStandardMaterial vertexColors metalness={0.85} roughness={0.38} />
      </mesh>
      {edges.slice(1).flatMap((z1, i) => {
        const z0 = edges[i] + 0.07,
          width = z1 - 0.07 - z0;
        const mid = (z0 + z1) / 2;
        if (width < 0.1) return [];
        return BANDS.filter(
          (_, band) =>
            band > 0 || !window || mid < window[0] || mid > window[1],
        ).map(([y0, y1]) => (
          <mesh
            key={`${z0}${y0}`}
            position={[at(0.004), (y0 + y1) / 2, (z0 + z1 - 0.07) / 2]}
            rotation={[0, side < 0 ? Math.PI / 2 : -Math.PI / 2, 0]}
          >
            <planeGeometry args={[width, y1 - y0]} />
            <meshBasicMaterial
              color="#000"
              map={map}
              transparent
              depthWrite={false}
            />
          </mesh>
        ));
      })}
    </group>
  );
}

const VASE = [
  [0, 0],
  [0.022, 0],
  [0.03, 0.03],
  [0.026, 0.07],
  [0.011, 0.1],
  [0.009, 0.125],
  [0.013, 0.135],
  [0.011, 0.137],
].map(([r, y]) => new Vector2(r, y));

/** A staggered display shelf (chigaidana) hung on the left wall, with a bud vase and an incense box. */
export function WallShelf({ position }: { position: Point }) {
  const built = useBuilt(() => {
    const wood = merge([
      block([0.2, 0.024, 0.56], [0, 0, 0.1], '#4a2c1a'),
      block([0.2, 0.024, 0.48], [0, 0.26, -0.14], '#4a2c1a'),
      block([0.2, 0.28, 0.022], [0, 0.13, -0.02], '#3a2215'),
      block([0.012, 0.03, 0.56], [0.1, -0.006, 0.1], '#24150c'),
      block([0.012, 0.03, 0.48], [0.1, 0.254, -0.14], '#24150c'),
      block([0.03, 0.12, 0.03], [-0.085, -0.07, 0.34], timber, {
        rotation: [0.6, 0, 0],
      }),
      block([0.03, 0.12, 0.03], [-0.085, 0.19, -0.34], timber, {
        rotation: [-0.6, 0, 0],
      }),
    ]);
    const ceramic = merge([
      paint(place(new LatheGeometry(VASE, 20), [0.02, 0.012, 0.26]), '#2f3a34'),
      paint(
        place(
          new CylinderGeometry(0.035, 0.035, 0.03, 20),
          [0.02, 0.287, -0.2],
        ),
        '#8e2a22',
      ),
      paint(
        place(
          new CylinderGeometry(0.036, 0.036, 0.012, 20),
          [0.02, 0.308, -0.2],
        ),
        '#1c120c',
      ),
    ]);
    return {
      wood,
      ceramic,
      dispose() {
        wood.dispose();
        ceramic.dispose();
      },
    };
  });
  return (
    <group position={position}>
      <mesh geometry={built.wood} castShadow receiveShadow>
        <WoodMaterial clearcoat={0.3} />
      </mesh>
      <mesh geometry={built.ceramic} castShadow>
        <meshPhysicalMaterial
          vertexColors
          roughness={0.3}
          clearcoat={0.8}
          clearcoatRoughness={0.15}
        />
      </mesh>
      <mesh position={[0.02, 0.2, 0.25]} rotation={[0.2, 0, -0.15]}>
        <cylinderGeometry args={[0.0018, 0.0018, 0.16, 4]} />
        <meshStandardMaterial color="#3a4a26" roughness={0.8} />
      </mesh>
      <mesh position={[0.008, 0.28, 0.238]} scale={[0.018, 0.022, 0.018]}>
        <sphereGeometry args={[1, 10, 8]} />
        <meshStandardMaterial color="#f2ece0" roughness={0.6} />
      </mesh>
    </group>
  );
}
