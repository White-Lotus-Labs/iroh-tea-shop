import {
  CylinderGeometry,
  LatheGeometry,
  LineCurve3,
  SphereGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
  type BufferGeometry,
} from 'three';
import type { Point } from '../stations';
import { createRandom } from '../motion/dynamics';
import {
  block,
  brushText,
  canvasTexture,
  merge,
  paint,
  paper,
  place,
  useBuilt,
  WoodMaterial,
} from './craft';

const brass = '#b08a4a';
const lathe = (profile: number[][], at: Point, segments = 24) =>
  place(
    new LatheGeometry(
      profile.map(([r, y]) => new Vector2(r, y)),
      segments,
    ),
    at,
  );
const thread = (a: Point, b: Point) =>
  new TubeGeometry(
    new LineCurve3(new Vector3(...a), new Vector3(...b)),
    1,
    0.0009,
    4,
  );

/** A merchant's balance (tenbin): wooden base, brass post and beam, two pans on threads. */
function buildScale([x, y, z]: Point) {
  const beamY = y + 0.27,
    arm = 0.13,
    pan = y + 0.09;
  const metal: BufferGeometry[] = [
    place(new CylinderGeometry(0.006, 0.008, 0.25, 10), [x, y + 0.145, z]),
    place(
      new CylinderGeometry(0.004, 0.004, arm * 2, 8),
      [x, beamY, z],
      [Math.PI / 2, 0, 0],
    ),
    place(new SphereGeometry(0.011, 12, 8), [x, beamY + 0.004, z]),
    place(new CylinderGeometry(0.002, 0.004, 0.05, 6), [x, beamY + 0.03, z]),
  ];
  for (const side of [-1, 1]) {
    const pz = z + side * arm;
    metal.push(
      lathe(
        [
          [0, 0],
          [0.05, 0.004],
          [0.056, 0.014],
          [0.052, 0.015],
          [0, 0.006],
        ],
        [x, pan, pz],
      ),
    );
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      metal.push(
        thread(
          [x, beamY - 0.003, pz],
          [x + Math.cos(a) * 0.048, pan + 0.013, pz + Math.sin(a) * 0.048],
        ),
      );
    }
  }
  return {
    metal: merge(metal.map((part) => paint(part, brass))),
    wood: merge([
      block([0.12, 0.022, 0.34], [x, y + 0.011, z], '#2a180e'),
      block([0.05, 0.02, 0.05], [x, y + 0.03, z], '#1c100a'),
    ]),
  };
}

/** A brass hand bell with a turned wooden handle, lying on its side. */
function buildBell([x, y, z]: Point) {
  const bell = lathe(
    [
      [0, 0.07],
      [0.012, 0.068],
      [0.022, 0.05],
      [0.03, 0.018],
      [0.036, 0.004],
      [0.038, 0],
      [0.034, 0.002],
      [0.028, 0.02],
      [0.018, 0.052],
      [0, 0.062],
    ],
    [0, 0, 0],
  );
  const handle = lathe(
    [
      [0, 0],
      [0.009, 0],
      [0.011, 0.02],
      [0.008, 0.06],
      [0.01, 0.075],
      [0, 0.08],
    ],
    [0, 0.068, 0],
  );
  const turn: Point = [0, 0.4, Math.PI / 2 - 0.1],
    at: Point = [x, y + 0.037, z];
  return {
    bell: paint(place(bell, at, turn), brass),
    handle: paint(place(handle, at, turn), '#3a1e12'),
  };
}

/** Round tea cakes pressed from leaf, wrapped in printed paper; the print is 普洱 (pu-erh). */
function drawWrapper(ctx: CanvasRenderingContext2D) {
  const random = createRandom(88);
  paper(ctx, 0, 0, 256, 256, '#ece2cc', random);
  ctx.strokeStyle = 'rgba(160,40,30,.8)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(128, 128, 104, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(128, 128, 94, 0, Math.PI * 2);
  ctx.stroke();
  brushText(ctx, '普洱', 128, 52, 72, '150,34,24');
  for (let i = 0; i < 40; i++) {
    const a = random() * Math.PI * 2;
    ctx.fillStyle = 'rgba(110,70,30,.12)';
    ctx.fillRect(128 + Math.cos(a) * 118, 128 + Math.sin(a) * 118, 8, 2);
  }
}

const CAKES: [Point, number][] = [
  [[-3.8, 0.896, 5.35], 3],
  [[-2.2, 1.33, 5.65], 2],
];

/** Counter-top life: a balance scale, a hand bell and stacks of wrapped tea cakes. */
export function CounterDetail({ top }: { top: number }) {
  const built = useBuilt(() => {
    const scale = buildScale([-0.64, top, 5.78]),
      bell = buildBell([-0.78, top, 6.42]),
      cakes = merge(
        CAKES.flatMap(([[x, y, z], count]) =>
          Array.from({ length: count }, (_, i) =>
            place(
              new CylinderGeometry(0.1, 0.1, 0.028, 32),
              [x, y + 0.015 + i * 0.03, z],
              [0, i * 0.7, 0],
            ),
          ),
        ),
      ),
      metal = merge([scale.metal, bell.bell]),
      wood = merge([scale.wood, bell.handle]),
      wrapper = canvasTexture(256, 256, drawWrapper);
    return {
      metal,
      wood,
      cakes,
      wrapper,
      dispose() {
        [metal, wood, cakes, wrapper].forEach((item) => item.dispose());
      },
    };
  });
  return (
    <group name="counter-detail">
      <mesh geometry={built.metal} castShadow>
        <meshStandardMaterial vertexColors metalness={0.9} roughness={0.3} />
      </mesh>
      <mesh geometry={built.wood} castShadow receiveShadow>
        <WoodMaterial clearcoat={0.4} />
      </mesh>
      <mesh geometry={built.cakes} castShadow receiveShadow>
        <meshStandardMaterial map={built.wrapper} roughness={0.85} />
      </mesh>
    </group>
  );
}
