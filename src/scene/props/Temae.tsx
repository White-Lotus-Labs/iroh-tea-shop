import { useState } from 'react';
import {
  CylinderGeometry,
  LatheGeometry,
  LineCurve3,
  PlaneGeometry,
  SphereGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from 'three';
import { Steam } from '../Steam';
import { Solid } from '../Surfaces';
import type { Point } from '../stations';
import { createRandom } from '../motion/dynamics';
import { Chabana } from './BackWall';
import {
  block,
  canvasTexture,
  inkStroke,
  merge,
  paint,
  place,
  useBuilt,
  WoodMaterial,
} from './craft';

const lathe = (profile: number[][], segments = 28) =>
  new LatheGeometry(
    profile.map(([r, y]) => new Vector2(r, y)),
    segments,
  );

const JAR = [
  [0, 0],
  [0.066, 0],
  [0.074, 0.008],
  [0.084, 0.05],
  [0.086, 0.11],
  [0.08, 0.16],
  [0.077, 0.172],
  [0.08, 0.178],
  [0.072, 0.18],
  [0.068, 0.172],
  [0, 0.172],
];
const BOWL = [
  [0, 0],
  [0.05, 0],
  [0.058, 0.006],
  [0.07, 0.05],
  [0.076, 0.082],
  [0.071, 0.084],
  [0.064, 0.052],
  [0.05, 0.014],
  [0, 0.014],
];

/**
 * Temae utensils beside the brazier: a lidded water jar (mizusashi), a bronze waste
 * bowl (kensui) with a bamboo ladle (hishaku) resting on its lid rest, and a folded fukusa.
 */
export function TemaeSet() {
  const built = useBuilt(() => {
    const jar = place(lathe(JAR), [2.24, 0, -1.74]),
      lacquer = merge([
        paint(
          place(
            new CylinderGeometry(0.075, 0.075, 0.012, 28),
            [2.24, 0.186, -1.74],
          ),
          '#120a06',
        ),
        paint(
          place(new SphereGeometry(0.012, 12, 8), [2.24, 0.196, -1.74]),
          '#120a06',
        ),
      ]),
      bronze = lathe(BOWL);
    place(bronze, [1.96, 0, -1.34]);
    const bamboo = merge([
      paint(
        place(
          new CylinderGeometry(0.028, 0.026, 0.045, 18, 1, true),
          [1.96, 0.075, -1.34],
        ),
        '#c9a860',
      ),
      paint(
        new TubeGeometry(
          new LineCurve3(
            new Vector3(1.982, 0.092, -1.322),
            new Vector3(2.29, 0.061, -1.06),
          ),
          1,
          0.0055,
          6,
        ),
        '#c9a860',
      ),
      paint(
        place(
          new CylinderGeometry(0.024, 0.024, 0.055, 14),
          [2.28, 0.0275, -1.07],
        ),
        '#a88a48',
      ),
    ]);
    return {
      jar,
      lacquer,
      bronze,
      bamboo,
      dispose() {
        [jar, lacquer, bronze, bamboo].forEach((g) => g.dispose());
      },
    };
  });
  return (
    <group name="temae-set">
      <mesh geometry={built.jar} castShadow receiveShadow>
        <meshPhysicalMaterial
          color="#d8c7a6"
          roughness={0.42}
          clearcoat={0.6}
          clearcoatRoughness={0.25}
        />
      </mesh>
      <mesh geometry={built.lacquer} castShadow>
        <meshPhysicalMaterial
          vertexColors
          roughness={0.2}
          clearcoat={1}
          clearcoatRoughness={0.1}
        />
      </mesh>
      <mesh geometry={built.bronze} castShadow receiveShadow>
        <meshStandardMaterial
          color="#6b4b28"
          metalness={0.8}
          roughness={0.42}
        />
      </mesh>
      <mesh geometry={built.bamboo} castShadow>
        <meshStandardMaterial vertexColors roughness={0.55} />
      </mesh>
      <Solid
        position={[1.24, 0.058, -1.42]}
        size={[0.13, 0.012, 0.09]}
        color="#6e2433"
        surface="cloth"
      />
      <Solid
        position={[1.235, 0.068, -1.425]}
        size={[0.12, 0.01, 0.07]}
        color="#7a2a3a"
        surface="cloth"
      />
    </group>
  );
}

const LEG = 0.17;
/** A low lacquer flower stand (hanadai) with a chabana and a burning incense stick. */
export function FlowerStand({ position }: { position: Point }) {
  const [reduced] = useState(
    // ponytail: reads the OS setting once; the shell's in-app motion toggle is not threaded here.
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const built = useBuilt(() => {
    const wood = merge([
      block([0.56, 0.026, 0.36], [0, LEG + 0.013, 0], '#1c100a'),
      block([0.5, 0.04, 0.012], [0, LEG - 0.02, 0.165], '#24150c'),
      block([0.5, 0.04, 0.012], [0, LEG - 0.02, -0.165], '#24150c'),
      ...[-1, 1].flatMap((x) =>
        [-1, 1].map((z) =>
          block([0.03, LEG, 0.03], [x * 0.25, LEG / 2, z * 0.15], '#1c100a', {
            rotation: [z * 0.08, 0, -x * 0.08],
          }),
        ),
      ),
    ]);
    const cup = lathe([
      [0, 0],
      [0.028, 0],
      [0.03, 0.03],
      [0.027, 0.032],
      [0, 0.03],
    ]);
    return {
      wood,
      cup,
      dispose() {
        wood.dispose();
        cup.dispose();
      },
    };
  });
  const top = LEG + 0.026;
  return (
    <group position={position} rotation={[0, -0.5, 0]}>
      <mesh geometry={built.wood} castShadow receiveShadow>
        <WoodMaterial clearcoat={0.8} />
      </mesh>
      <Chabana position={[0.08, top, 0]} />
      <mesh geometry={built.cup} position={[-0.19, top, 0.06]} castShadow>
        <meshPhysicalMaterial color="#2c3a3a" roughness={0.3} clearcoat={0.8} />
      </mesh>
      <mesh position={[-0.19, top + 0.1, 0.06]} rotation={[0, 0, 0.06]}>
        <cylinderGeometry args={[0.0018, 0.0018, 0.15, 5]} />
        <meshStandardMaterial color="#4a2e1a" roughness={0.9} />
      </mesh>
      <mesh position={[-0.1945, top + 0.176, 0.06]}>
        <sphereGeometry args={[0.0025, 6, 4]} />
        <meshStandardMaterial
          color="#ff7a2a"
          emissive="#ff5a10"
          emissiveIntensity={4}
        />
      </mesh>
      <Steam
        origin={[-0.195, top + 0.18, 0.06]}
        active
        reduced={reduced}
        count={7}
        strength={0.7}
        rise={0.55}
      />
    </group>
  );
}

const FOLD = 0.42;

/** Gold leaf squares under an ink landscape: far ridges, gold cloud bands and a leaning pine. */
function drawScreen(ctx: CanvasRenderingContext2D) {
  const w = 1024,
    h = 720,
    random = createRandom(1597);
  for (let y = 0; y < h; y += 48)
    for (let x = 0; x < w; x += 48) {
      const tone = 150 + random() * 30;
      ctx.fillStyle = `rgb(${tone + 40},${tone + 8},${tone * 0.45})`;
      ctx.fillRect(x, y, 48, 48);
      ctx.fillStyle = 'rgba(90,60,20,.18)';
      ctx.fillRect(x, y, 48, 1);
      ctx.fillRect(x, y, 1, 48);
    }
  for (const [base, alpha] of [
    [430, 0.22],
    [500, 0.35],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 16)
      ctx.lineTo(
        x,
        base -
          Math.abs(Math.sin(x * 0.006 + base)) * 120 -
          Math.sin(x * 0.021) * 18,
      );
    ctx.lineTo(w, h);
    ctx.fillStyle = `rgba(40,34,26,${alpha})`;
    ctx.fill();
  }
  for (const y of [180, 560]) {
    const band = ctx.createLinearGradient(0, y - 40, 0, y + 40);
    band.addColorStop(0, 'rgba(236,196,110,0)');
    band.addColorStop(0.5, 'rgba(240,204,120,.75)');
    band.addColorStop(1, 'rgba(236,196,110,0)');
    ctx.fillStyle = band;
    ctx.fillRect(0, y - 40, w, 80);
  }
  const trunk: [number, number][] = [
    [690, 720],
    [676, 600],
    [640, 480],
    [560, 380],
    [470, 330],
  ];
  inkStroke(ctx, trunk, 34, random);
  const branches: [number, number][][] = [
    [
      [640, 480],
      [740, 430],
      [840, 420],
    ],
    [
      [560, 380],
      [520, 300],
      [560, 230],
    ],
    [
      [470, 330],
      [380, 320],
      [300, 350],
    ],
  ];
  branches.forEach((path) => inkStroke(ctx, path, 12, random));
  for (const [cx, cy] of [
    [840, 410],
    [560, 225],
    [300, 340],
    [460, 320],
    [740, 425],
  ])
    for (let i = 0; i < 70; i++) {
      const a = random() * Math.PI * 2,
        r = 20 + random() * 50,
        x = cx + Math.cos(a) * r * 1.4,
        y = cy + Math.sin(a) * r * 0.5;
      inkStroke(
        ctx,
        [
          [x, y],
          [x + 10 + random() * 12, y - 4 + random() * 8],
        ],
        2.2,
        random,
        '22,34,24',
      );
    }
}

/** A folding screen (byobu): lacquer frames, gold ink painting and a paper back. */
export function Byobu({
  position,
  turn = 0,
  panels: PANELS = 2,
  width: PANEL_W = 0.62,
  height: PANEL_H = 0.64,
}: {
  position: Point;
  turn?: number;
  panels?: number;
  width?: number;
  height?: number;
}) {
  const built = useBuilt(() => {
    const art = canvasTexture(1024, 720, drawScreen);
    let x = 0,
      z = 0;
    const faces = [],
      frames = [];
    for (let i = 0; i < PANELS; i++) {
      const angle = i % 2 ? FOLD : -FOLD,
        cx = x + (Math.cos(angle) * PANEL_W) / 2,
        cz = z - (Math.sin(angle) * PANEL_W) / 2;
      const face = new PlaneGeometry(PANEL_W - 0.03, PANEL_H - 0.05);
      const uv = face.attributes.uv;
      for (let k = 0; k < uv.count; k++) uv.setX(k, (i + uv.getX(k)) / PANELS);
      faces.push(place(face, [cx, PANEL_H / 2 + 0.03, cz], [0, angle, 0]));
      const r: Point = [0, angle, 0],
        at = (dx: number, y: number): Point => [
          cx + Math.cos(angle) * dx,
          y,
          cz - Math.sin(angle) * dx,
        ];
      frames.push(
        block([PANEL_W, 0.022, 0.024], at(0, 0.03), '#140b07', { rotation: r }),
        block([PANEL_W, 0.022, 0.024], at(0, PANEL_H + 0.03), '#140b07', {
          rotation: r,
        }),
        block(
          [0.018, PANEL_H, 0.024],
          at(-PANEL_W / 2 + 0.009, PANEL_H / 2 + 0.03),
          '#140b07',
          {
            rotation: r,
          },
        ),
        block(
          [0.018, PANEL_H, 0.022],
          at(PANEL_W / 2 - 0.009, PANEL_H / 2 + 0.03),
          '#140b07',
          {
            rotation: r,
          },
        ),
        block(
          [PANEL_W - 0.02, PANEL_H - 0.04, 0.006],
          at(0, PANEL_H / 2 + 0.03),
          '#b9a27a',
          {
            rotation: r,
          },
        ),
      );
      x += Math.cos(angle) * PANEL_W;
      z -= Math.sin(angle) * PANEL_W;
    }
    const face = merge(faces),
      frame = merge(frames);
    return {
      art,
      face,
      frame,
      dispose() {
        [art, face, frame].forEach((item) => item.dispose());
      },
    };
  });
  return (
    <group position={position} rotation={[0, turn, 0]}>
      <mesh geometry={built.frame} castShadow receiveShadow>
        <WoodMaterial clearcoat={0.9} />
      </mesh>
      <mesh geometry={built.face} position={[0, 0, 0.0045]} receiveShadow>
        <meshStandardMaterial
          map={built.art}
          metalness={0.35}
          roughness={0.5}
        />
      </mesh>
    </group>
  );
}
