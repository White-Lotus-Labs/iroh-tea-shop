import {
  CylinderGeometry,
  LatheGeometry,
  PlaneGeometry,
  SphereGeometry,
  Vector2,
  Vector3,
} from 'three';
import { Steam } from '../Steam';
import { once, Solid } from '../Surfaces';
import type { Point } from '../stations';
import { createRandom } from '../motion/dynamics';
import { Chabana } from './BackWall';
import {
  block,
  canvasTexture,
  cord,
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
const BOWL_RIM = 0.084;
const BOWL = [
  [0, 0],
  [0.05, 0],
  [0.058, 0.006],
  [0.07, 0.05],
  [0.076, 0.082],
  [0.071, BOWL_RIM],
  [0.064, 0.052],
  [0.05, 0.014],
  [0, 0.014],
];

/** Shino glaze: cream with an orange blush, pinholes and iron-brushed grasses; top of canvas is the rim. */
function drawShino(ctx: CanvasRenderingContext2D) {
  const random = createRandom(733);
  const base = ctx.createLinearGradient(0, 0, 0, 256);
  base.addColorStop(0, '#c98a58');
  base.addColorStop(0.18, '#e2d2b6');
  base.addColorStop(0.8, '#e6d8be');
  base.addColorStop(1, '#b8764a');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 600; i++) {
    ctx.fillStyle = `rgba(${random() > 0.5 ? '190,120,70' : '120,90,60'},${random() * 0.35})`;
    ctx.beginPath();
    ctx.arc(
      random() * 512,
      random() * 256,
      0.6 + random() * 1.4,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  for (let g = 0; g < 3; g++) {
    const x = 60 + g * 170 + random() * 30;
    for (let blade = 0; blade < 3; blade++)
      inkStroke(
        ctx,
        [
          [x + blade * 5, 196],
          [x + blade * 8 + 6, 160],
          [x + blade * 16 + (random() - 0.5) * 24, 128 + random() * 14],
        ],
        2.2,
        random,
        '128,72,40',
      );
  }
}
const shinoMap = once(() => canvasTexture(512, 256, drawShino));

const KENSUI: Point = [2.02, 0, -1.3];
const LID_REST: Point = [2.34, 0, -1.03];
const LID_REST_H = 0.055;

/**
 * Temae utensils beside the brazier: a lidded water jar (mizusashi), a bronze waste
 * bowl (kensui), a bamboo lid rest holding the ladle's upturned cup with the handle
 * laid on the kensui rim, and a folded fukusa.
 */
export function TemaeSet() {
  const built = useBuilt(() => {
    const jarAt: Point = [2.12, 0, -1.8],
      jar = place(lathe(JAR), jarAt),
      lacquer = merge([
        paint(
          place(new CylinderGeometry(0.075, 0.075, 0.012, 28), [
            jarAt[0],
            0.186,
            jarAt[2],
          ]),
          '#120a06',
        ),
        paint(
          place(new SphereGeometry(0.012, 12, 8), [jarAt[0], 0.196, jarAt[2]]),
          '#120a06',
        ),
      ]),
      bronze = place(lathe(BOWL), KENSUI);
    const [kx, , kz] = KENSUI,
      [fx, , fz] = LID_REST,
      toward = new Vector3(kx - fx, 0, kz - fz).normalize(),
      cupY = LID_REST_H + 0.0225,
      joint = new Vector3(fx, cupY, fz).addScaledVector(toward, 0.028),
      rim = new Vector3(kx, BOWL_RIM + 0.0055, kz).addScaledVector(
        toward,
        -0.076,
      ),
      tip = rim
        .clone()
        .addScaledVector(rim.clone().sub(joint).normalize(), 0.035);
    const bamboo = merge([
      paint(
        place(new CylinderGeometry(0.026, 0.028, 0.045, 18), [fx, cupY, fz]),
        '#c9a860',
      ),
      paint(cord(joint.toArray(), tip.toArray(), 0.0055), '#c9a860'),
      paint(
        place(new CylinderGeometry(0.024, 0.024, LID_REST_H, 14), [
          fx,
          LID_REST_H / 2,
          fz,
        ]),
        '#a88a48',
      ),
    ]);
    return {
      jar,
      shino: shinoMap(),
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
          map={built.shino}
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
      {/* Folded flat on the tatami, whose top is at 0.052 m. */}
      <Solid
        position={[1.24, 0.0565, -1.42]}
        size={[0.13, 0.009, 0.09]}
        color="#6e2433"
        surface="cloth"
      />
      <Solid
        position={[1.238, 0.063, -1.44]}
        size={[0.124, 0.004, 0.046]}
        color="#7a2a3a"
        surface="cloth"
      />
    </group>
  );
}

const LEG = 0.17;
/** A low lacquer flower stand (hanadai) with a chabana and a burning incense stick. */
export function FlowerStand({
  position,
  reduced,
}: {
  position: Point;
  reduced: boolean;
}) {
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
  // Ink wash, not solid black: a blurred pale bleed under a thin, dilute stroke.
  const wash = (path: [number, number][], width: number) => {
    ctx.save();
    ctx.filter = 'blur(7px)';
    ctx.globalAlpha = 0.3;
    inkStroke(ctx, path, width * 1.7, random, '92,74,52');
    ctx.filter = 'none';
    ctx.globalAlpha = 0.45;
    inkStroke(ctx, path, width, random, '66,52,38');
    ctx.restore();
  };
  const trunk: [number, number][] = [
    [690, 720],
    [676, 600],
    [640, 480],
    [560, 380],
    [470, 330],
  ];
  wash(trunk, 30);
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
  branches.forEach((path) => wash(path, 11));
  ctx.globalAlpha = 0.5;
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
        '52,66,50',
      );
    }
  ctx.globalAlpha = 1;
}
const screenArt = once(() => canvasTexture(1024, 720, drawScreen));

/** Lacquer frame section: face width and depth. The painting sits inside the depth. */
const FRAME = { face: 0.026, depth: 0.03 };
/**
 * A folding screen (byobu): each panel is a lacquer frame that wraps its gold painting
 * and paper back, and brass hinges join the stiles at every fold.
 */
export function Byobu({
  position,
  turn = 0,
  panels: PANELS = 2,
  width: PANEL_W = 0.62,
  height: PANEL_H = 0.68,
}: {
  position: Point;
  turn?: number;
  panels?: number;
  width?: number;
  height?: number;
}) {
  const built = useBuilt(() => {
    const { face: F, depth: D } = FRAME,
      innerW = PANEL_W - 2 * F + 0.008,
      innerH = PANEL_H - 2 * F + 0.008;
    let x = 0,
      z = 0;
    const faces = [],
      frames = [],
      hinges = [];
    for (let i = 0; i < PANELS; i++) {
      const angle = i % 2 ? FOLD : -FOLD,
        cx = x + (Math.cos(angle) * PANEL_W) / 2,
        cz = z - (Math.sin(angle) * PANEL_W) / 2,
        r: Point = [0, angle, 0],
        // Panel-local (along, up, out of the painted face) to screen space.
        at = (dx: number, y: number, dn = 0): Point => [
          cx + Math.cos(angle) * dx + Math.sin(angle) * dn,
          y,
          cz - Math.sin(angle) * dx + Math.cos(angle) * dn,
        ];
      const face = new PlaneGeometry(innerW, innerH);
      const uv = face.attributes.uv;
      for (let k = 0; k < uv.count; k++) uv.setX(k, (i + uv.getX(k)) / PANELS);
      faces.push(place(face, at(0, PANEL_H / 2, 0.004), r));
      const lacquer = '#140b07';
      frames.push(
        block([PANEL_W, F, D], at(0, F / 2), lacquer, { rotation: r }),
        block([PANEL_W, F, D], at(0, PANEL_H - F / 2), lacquer, {
          rotation: r,
        }),
        ...[-1, 1].map((side) =>
          block(
            [F, PANEL_H - 2 * F + 0.002, D],
            at(side * (PANEL_W / 2 - F / 2), PANEL_H / 2),
            lacquer,
            { rotation: r },
          ),
        ),
        block([innerW, innerH, 0.004], at(0, PANEL_H / 2, -0.004), '#b9a27a', {
          rotation: r,
        }),
      );
      x += Math.cos(angle) * PANEL_W;
      z -= Math.sin(angle) * PANEL_W;
      if (i === PANELS - 1) continue;
      // The knuckle fills the V on the fold's convex side; a leaf sits on each stile there.
      const next = i % 2 ? -FOLD : FOLD,
        s = i % 2 ? -1 : 1,
        nx = x + Math.cos(next) * 0.013 + Math.sin(next) * s * (D / 2),
        nz = z - Math.sin(next) * 0.013 + Math.cos(next) * s * (D / 2);
      for (const y of [0.1, PANEL_H / 2, PANEL_H - 0.1])
        hinges.push(
          paint(
            place(new CylinderGeometry(0.0055, 0.0055, 0.05, 12), [
              x,
              y,
              z + s * (D / 2 - 0.001),
            ]),
            '#fff',
          ),
          block(
            [0.024, 0.044, 0.002],
            at(PANEL_W / 2 - 0.013, y, s * (D / 2)),
            '#fff',
            { rotation: r },
          ),
          block([0.024, 0.044, 0.002], [nx, y, nz], '#fff', {
            rotation: [0, next, 0],
          }),
        );
    }
    const face = merge(faces),
      frame = merge(frames),
      hinge = merge(hinges);
    return {
      art: screenArt(),
      face,
      frame,
      hinge,
      dispose() {
        [face, frame, hinge].forEach((item) => item.dispose());
      },
    };
  });
  return (
    <group position={position} rotation={[0, turn, 0]}>
      <mesh geometry={built.frame} castShadow receiveShadow>
        <WoodMaterial clearcoat={0.9} />
      </mesh>
      <mesh geometry={built.face} receiveShadow>
        <meshStandardMaterial
          map={built.art}
          metalness={0.35}
          roughness={0.5}
        />
      </mesh>
      <mesh geometry={built.hinge} castShadow>
        <meshStandardMaterial
          vertexColors
          color="#9a7a3e"
          metalness={0.9}
          roughness={0.35}
        />
      </mesh>
    </group>
  );
}
