import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useTexture } from '@react-three/drei';
import {
  CatmullRomCurve3,
  DoubleSide,
  Matrix4,
  Quaternion,
  Vector2,
  Vector3,
  Euler,
  type InstancedMesh,
} from 'three';
import {
  Boxes,
  Solid,
  SurfaceMaterial,
  canvasTexture,
  useCanvasTexture,
} from '../Surfaces';
import type { Point } from '../stations';
import { createRandom } from '../motion/dynamics';
import { ShojiWindow } from './Shoji';

const timber = '#3a2419';
const plaster = '#8a7862';
const face = -6.18;
const wallZ = face - 0.085;
const veranda = { x0: -3.87, x1: -1.9, head: 2.93 };
const shoji = { x0: -1.65, x1: 0.66, y0: 0.96, y1: 2.93 };
const toko = { x0: 0.91, x1: 3.04, back: -6.9, top: 2.63, floor: 0.15 };
const deckTop = -0.05;
const deck = { x0: -4.35, x1: -1.55, z0: -6.36, z1: -7.9 };

const deckBoards: [Point, Point][] = Array.from({ length: 12 }, (_, i) => {
  const w = (deck.z0 - deck.z1) / 12;
  return [
    [(deck.x0 + deck.x1) / 2, deckTop - 0.02, deck.z0 - w * (i + 0.5)],
    [deck.x1 - deck.x0, 0.04, w - 0.008],
  ];
});
const rafters: [Point, Point][] = Array.from({ length: 16 }, (_, i) => [
  [deck.x0 + 0.1 + i * 0.18, 0, 0],
  [0.045, 0.06, 2.1],
]);
const koshiBattens: [Point, Point][] = Array.from({ length: 6 }, (_, i) => [
  [shoji.x0 + ((shoji.x1 - shoji.x0) * (i + 1)) / 7, 0.46, face - 0.02],
  [0.03, 0.9, 0.018],
]);

/** Dusk sky, haze ridges and the painted valley, cropped from the old backdrop and feathered in. */
function paintMatte(ctx: CanvasRenderingContext2D, image: HTMLImageElement) {
  const w = ctx.canvas.width,
    h = ctx.canvas.height,
    random = createRandom(52);
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#2c2440');
  sky.addColorStop(0.3, '#5a4263');
  sky.addColorStop(0.5, '#b0697a');
  sky.addColorStop(0.62, '#e99a72');
  sky.addColorStop(0.75, '#f2b27a');
  sky.addColorStop(1, '#3a2a28');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.filter = 'blur(6px)';
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = `rgba(255,${170 + random() * 40},${120 + random() * 40},${0.08 + random() * 0.1})`;
    ctx.beginPath();
    ctx.ellipse(
      random() * w,
      h * (0.3 + random() * 0.25),
      60 + random() * 160,
      3 + random() * 7,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.restore();
  const ridge = (base: number, amp: number, color: string, bumps: number) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 4) {
      const t = x / w;
      const y =
        base -
        amp *
          (0.6 * Math.sin(t * 5.1 + base) +
            0.3 * Math.sin(t * 13.7 + base * 2) +
            0.1 * Math.sin(t * 41)) -
        (bumps ? Math.abs(Math.sin(x * bumps)) * 7 * random() : 0);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.fill();
  };
  ridge(h * 0.6, h * 0.06, '#7a5566', 0);
  ridge(h * 0.66, h * 0.05, '#503848', 0);
  const crop = document.createElement('canvas');
  const sx = image.width * 0.108,
    sw = image.width * 0.146,
    sy = image.height * 0.3,
    sh = image.height * 0.36;
  const dw = w * 0.34,
    dh = (dw * sh) / sw;
  crop.width = Math.round(dw);
  crop.height = Math.round(dh);
  const c = crop.getContext('2d')!;
  c.drawImage(image, sx, sy, sw, sh, 0, 0, dw, dh);
  c.globalCompositeOperation = 'destination-in';
  const fadeX = c.createLinearGradient(0, 0, dw, 0);
  fadeX.addColorStop(0, 'rgba(0,0,0,0)');
  fadeX.addColorStop(0.25, 'rgba(0,0,0,1)');
  fadeX.addColorStop(0.75, 'rgba(0,0,0,1)');
  fadeX.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = fadeX;
  c.fillRect(0, 0, dw, dh);
  const fadeY = c.createLinearGradient(0, 0, 0, dh);
  fadeY.addColorStop(0, 'rgba(0,0,0,0)');
  fadeY.addColorStop(0.3, 'rgba(0,0,0,1)');
  fadeY.addColorStop(1, 'rgba(0,0,0,1)');
  c.fillStyle = fadeY;
  c.fillRect(0, 0, dw, dh);
  ctx.drawImage(crop, w * 0.5 - dw / 2, h * 0.72 - dh * 0.72);
  ridge(h * 0.8, h * 0.035, '#241a1f', 0.21);
  ridge(h * 0.88, h * 0.03, '#150f12', 0.33);
}

/** Near foliage in silhouette: a pine bough from the top-left and shrubs along the rail. */
function paintFoliage(ctx: CanvasRenderingContext2D) {
  const w = ctx.canvas.width,
    h = ctx.canvas.height,
    random = createRandom(8);
  ctx.fillStyle = ctx.strokeStyle = '#120d0b';
  ctx.lineCap = 'round';
  const tuft = (x: number, y: number, r: number) => {
    for (let i = 0; i < 26; i++) {
      const a = random() * Math.PI * 2,
        d = random() * r;
      ctx.beginPath();
      ctx.ellipse(
        x + Math.cos(a) * d,
        y + Math.sin(a) * d * 0.55,
        r * 0.35,
        r * 0.18,
        random() * Math.PI,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  };
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(-10, h * 0.05);
  ctx.quadraticCurveTo(w * 0.2, h * 0.02, w * 0.38, h * 0.14);
  ctx.stroke();
  ctx.lineWidth = 6;
  for (let i = 0; i < 7; i++) {
    const t = 0.15 + i * 0.12,
      x = w * 0.38 * t,
      y = h * (0.04 + 0.1 * t * t);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 30 + random() * 40, y + 20 + random() * 40);
    ctx.stroke();
    tuft(x + 40 + random() * 30, y + 40 + random() * 30, 30 + random() * 26);
  }
  for (let i = 0; i < 14; i++)
    tuft((i / 13) * w, h * (0.9 + random() * 0.06), 34 + random() * 30);
}

const matteAspect = 10 / 8;
function DistantView() {
  const source = useTexture('/images/tea-back-wall.jpg');
  const matte = useMemo(
    () =>
      canvasTexture(1024, Math.round(1024 / matteAspect), (ctx) =>
        paintMatte(ctx, source.image as HTMLImageElement),
      ),
    [source],
  );
  useEffect(() => () => matte.dispose(), [matte]);
  const foliage = useCanvasTexture(1024, 1024, paintFoliage);
  return (
    <group>
      <mesh position={[-5.2, 1.4, -11]}>
        <planeGeometry args={[10, 8]} />
        <meshBasicMaterial map={matte} color="#e6d2c4" fog={false} />
      </mesh>
      <mesh position={[-3.4, 1.9, -8.7]}>
        <planeGeometry args={[5.4, 5.4]} />
        <meshBasicMaterial
          map={foliage}
          transparent
          depthWrite={false}
          fog={false}
        />
      </mesh>
    </group>
  );
}

/** The engawa beyond the opening: deck boards, rail, eave post, rafters and a floor lamp. */
function Veranda() {
  const railZ = deck.z1 + 0.06;
  const width = deck.x1 - deck.x0;
  const midX = (deck.x0 + deck.x1) / 2;
  return (
    <group name="veranda">
      <Boxes
        items={deckBoards}
        color="#6a4630"
        jitter={0.22}
        seed={31}
        cast={false}
      />
      <Solid
        position={[midX, deckTop - 0.1, deck.z1 - 0.05]}
        size={[width, 0.16, 0.1]}
        color="#2c1b12"
        cast={false}
      />
      <Solid
        position={[midX, deckTop - 0.12, deck.z0 + 0.02]}
        size={[width, 0.14, 0.06]}
        color="#2c1b12"
        cast={false}
      />
      {[-3.95, -3.15, -2.35].map((x) => (
        <Solid
          key={x}
          position={[x, deckTop + 0.45, railZ]}
          size={[0.07, 0.9, 0.07]}
          color={timber}
          cast={false}
        />
      ))}
      <Solid
        position={[midX, deckTop + 0.9, railZ]}
        size={[width, 0.045, 0.1]}
        color={timber}
        cast={false}
      />
      {[0.5, 0.18].map((y) => (
        <Solid
          key={y}
          position={[midX, deckTop + y, railZ]}
          size={[width, 0.035, 0.04]}
          color={timber}
          cast={false}
        />
      ))}
      <Solid
        position={[-3.55, 1.55, deck.z1 + 0.1]}
        size={[0.15, 3.2, 0.15]}
        color={timber}
        cast={false}
      />
      <group position={[midX, 3.08, -7.35]} rotation={[-0.16, 0, 0]}>
        <Solid
          position={[0, 0.05, 0]}
          size={[width + 0.4, 0.03, 2.2]}
          color="#3b261a"
          cast={false}
        />
        <group position={[-midX, 0, 0]}>
          <Boxes items={rafters} color="#2a1a11" cast={false} />
        </group>
        <Solid
          position={[0, -0.04, -1.05]}
          size={[width + 0.4, 0.2, 0.09]}
          color="#24160e"
          cast={false}
        />
      </group>
      <group position={[-2.1, deckTop, -7.55]}>
        <Solid
          position={[0, 0.015, 0]}
          size={[0.2, 0.03, 0.2]}
          color="#1e130c"
          cast={false}
        />
        <mesh position={[0, 0.17, 0]}>
          <boxGeometry args={[0.15, 0.26, 0.15]} />
          <meshStandardMaterial
            color="#ffe2b0"
            emissive="#ff9a45"
            emissiveIntensity={2.4}
            roughness={0.9}
          />
        </mesh>
        <Solid
          position={[0, 0.315, 0]}
          size={[0.2, 0.03, 0.2]}
          color="#1e130c"
          cast={false}
        />
      </group>
    </group>
  );
}

type Stroke = { points: [number, number][]; width: number; dry: number };
const STROKES: Stroke[] = [
  {
    points: [
      [0.5, 0.1],
      [0.52, 0.3],
      [0.5, 0.55],
      [0.47, 0.72],
      [0.4, 0.78],
    ],
    width: 0.1,
    dry: 0.7,
  },
  {
    points: [
      [0.24, 0.24],
      [0.42, 0.26],
      [0.66, 0.22],
      [0.78, 0.27],
    ],
    width: 0.06,
    dry: 0.5,
  },
  {
    points: [
      [0.3, 0.44],
      [0.4, 0.47],
      [0.56, 0.46],
    ],
    width: 0.05,
    dry: 0.35,
  },
  {
    points: [
      [0.55, 0.5],
      [0.64, 0.6],
      [0.74, 0.7],
      [0.84, 0.74],
    ],
    width: 0.075,
    dry: 0.8,
  },
  {
    points: [
      [0.36, 0.58],
      [0.3, 0.66],
      [0.22, 0.7],
    ],
    width: 0.045,
    dry: 0.6,
  },
];

/** Abstract dry-brush strokes and a seal on aged paper; deliberately not a legible character. */
function drawCalligraphy(ctx: CanvasRenderingContext2D) {
  const w = 256,
    h = 640,
    random = createRandom(733);
  ctx.fillStyle = '#e6d9bd';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 2400; i++) {
    ctx.fillStyle = `rgba(120,88,48,${random() * 0.05})`;
    ctx.fillRect(random() * w, random() * h, 1 + random() * 5, 1);
  }
  const spot = ctx.createRadialGradient(
    w * 0.7,
    h * 0.85,
    0,
    w * 0.7,
    h * 0.85,
    h * 0.5,
  );
  spot.addColorStop(0, 'rgba(150,110,60,0.12)');
  spot.addColorStop(1, 'rgba(150,110,60,0)');
  ctx.fillStyle = spot;
  ctx.fillRect(0, 0, w, h);
  for (const stroke of STROKES) {
    const curve = new CatmullRomCurve3(
      stroke.points.map(([x, y]) => new Vector3(x * w, y * h, 0)),
    );
    const samples = curve.getSpacedPoints(90);
    const bristles = 34,
      maxWidth = stroke.width * w;
    for (let b = 0; b < bristles; b++) {
      const o = (b / (bristles - 1) - 0.5) * 2;
      const alpha = 0.35 + random() * 0.45;
      ctx.strokeStyle = `rgba(18,13,10,${alpha})`;
      ctx.lineWidth = 1 + random() * 1.6;
      ctx.beginPath();
      let pen = false;
      for (let i = 1; i < samples.length; i++) {
        const t = i / (samples.length - 1);
        const p = samples[i],
          q = samples[i - 1];
        const nx = -(p.y - q.y),
          ny = p.x - q.x,
          nl = Math.hypot(nx, ny) || 1;
        const press =
          Math.sin(Math.PI * Math.min(1, t * 1.6 + 0.12)) * 0.8 + 0.2;
        const half = (maxWidth * press) / 2;
        const x = p.x + (nx / nl) * o * half,
          y = p.y + (ny / nl) * o * half;
        const dry =
          t > 1 - stroke.dry &&
          random() < (t - (1 - stroke.dry)) * Math.abs(o) * 2.4;
        if (dry) {
          pen = false;
          continue;
        }
        if (!pen) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        pen = true;
      }
      ctx.stroke();
    }
  }
  ctx.fillStyle = 'rgba(18,13,10,.75)';
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.ellipse(
      w * 0.82,
      h * (0.34 + i * 0.045),
      4 + random() * 3,
      5,
      random(),
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.fillStyle = '#9e2f1c';
  ctx.fillRect(w * 0.76, h * 0.62, 24, 24);
  ctx.fillStyle = '#e6d9bd';
  ctx.fillRect(w * 0.76 + 5, h * 0.62 + 5, 14, 3);
  ctx.fillRect(w * 0.76 + 5, h * 0.62 + 11, 3, 8);
  ctx.fillRect(w * 0.76 + 13, h * 0.62 + 12, 6, 3);
}

/** A kakejiku: brocade mount, gold ichimonji bands, futai streamers, rod, roller and cord. */
function Kakejiku({ position }: { position: Point }) {
  const art = useCanvasTexture(256, 640, drawCalligraphy);
  return (
    <group position={position}>
      <mesh position={[0, 0, 0.002]} castShadow receiveShadow>
        <boxGeometry args={[0.5, 1.5, 0.004]} />
        <SurfaceMaterial surface="cloth" color="#4d4632" />
      </mesh>
      <mesh position={[0, 0.02, 0.0045]} receiveShadow>
        <planeGeometry args={[0.36, 0.9]} />
        <meshStandardMaterial map={art} roughness={0.92} />
      </mesh>
      {[0.49, -0.45].map((y) => (
        <mesh key={y} position={[0, y, 0.0046]}>
          <planeGeometry args={[0.36, 0.035]} />
          <meshStandardMaterial
            color="#9a7840"
            roughness={0.5}
            metalness={0.3}
          />
        </mesh>
      ))}
      {[-0.09, 0.09].map((x) => (
        <mesh key={x} position={[x, 0.56, 0.006]}>
          <boxGeometry args={[0.022, 0.38, 0.002]} />
          <SurfaceMaterial surface="cloth" color="#6a5d3e" />
        </mesh>
      ))}
      <mesh position={[0, 0.755, 0.008]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.008, 0.008, 0.52, 10]} />
        <meshStandardMaterial color="#2b1d12" roughness={0.6} />
      </mesh>
      <mesh
        position={[0, -0.76, 0.014]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
      >
        <cylinderGeometry args={[0.015, 0.015, 0.56, 16]} />
        <meshStandardMaterial color="#1e140d" roughness={0.4} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh
            position={[side * 0.3, -0.76, 0.014]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.021, 0.019, 0.04, 16]} />
            <meshPhysicalMaterial
              color="#120b07"
              roughness={0.25}
              clearcoat={1}
            />
          </mesh>
          <mesh
            position={[side * 0.12, 0.86, 0.008]}
            rotation={[0, 0, side * -1.05]}
          >
            <cylinderGeometry args={[0.002, 0.002, 0.27, 5]} />
            <meshStandardMaterial color="#6b5a3a" roughness={0.9} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.93, 0.006]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.005, 0.005, 0.03, 8]} />
        <meshStandardMaterial color="#2a2018" roughness={0.4} metalness={0.6} />
      </mesh>
    </group>
  );
}

const vaseProfile = [
  [0.0, 0.0],
  [0.042, 0.0],
  [0.048, 0.012],
  [0.07, 0.06],
  [0.078, 0.1],
  [0.066, 0.15],
  [0.034, 0.2],
  [0.026, 0.235],
  [0.033, 0.262],
  [0.029, 0.265],
  [0.022, 0.24],
].map(([r, y]) => new Vector2(r, y));
const branchCurve = new CatmullRomCurve3(
  [
    [0, 0.24, 0],
    [0.01, 0.4, 0.01],
    [-0.04, 0.58, 0.03],
    [-0.16, 0.74, 0.03],
    [-0.32, 0.8, 0.02],
    [-0.42, 0.78, 0.01],
  ].map(([x, y, z]) => new Vector3(x, y, z)),
);
const twigCurve = new CatmullRomCurve3(
  [
    [-0.03, 0.54, 0.03],
    [0.05, 0.64, 0.04],
    [0.1, 0.7, 0.05],
  ].map(([x, y, z]) => new Vector3(x, y, z)),
);
const LEAVES: { t: number; curve: 'branch' | 'twig'; turn: number }[] = [
  { t: 0.42, curve: 'branch', turn: 0.9 },
  { t: 0.55, curve: 'branch', turn: -0.8 },
  { t: 0.68, curve: 'branch', turn: 1.1 },
  { t: 0.82, curve: 'branch', turn: -1 },
  { t: 0.95, curve: 'branch', turn: 0.6 },
  { t: 0.7, curve: 'twig', turn: -0.9 },
  { t: 0.95, curve: 'twig', turn: 0.8 },
];

/** Chabana: a glazed vase on a thin board holding a single camellia branch. */
function Chabana({ position }: { position: Point }) {
  const leaves = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = leaves.current!,
      matrix = new Matrix4(),
      rotation = new Quaternion(),
      scale = new Vector3(0.028, 0.006, 0.06);
    LEAVES.forEach(({ t, curve, turn }, i) => {
      const path = curve === 'branch' ? branchCurve : twigCurve;
      const at = path.getPointAt(t),
        tangent = path.getTangentAt(t);
      const yaw = Math.atan2(tangent.x, tangent.z) + turn;
      rotation.setFromEuler(new Euler(0.5 * Math.sign(turn), yaw, 0.3));
      const offset = new Vector3(0, 0, 0.05).applyQuaternion(rotation);
      mesh.setMatrixAt(
        i,
        matrix.compose(at.clone().add(offset), rotation, scale),
      );
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, []);
  const bloom = branchCurve.getPointAt(1);
  const bud = twigCurve.getPointAt(1);
  return (
    <group position={position}>
      <Solid
        position={[0, 0.0075, 0]}
        size={[0.3, 0.015, 0.22]}
        color="#2a1a10"
        clearcoat={0.4}
        cast={false}
      />
      <mesh position={[0, 0.015, 0]} castShadow receiveShadow>
        <latheGeometry args={[vaseProfile, 40]} />
        <meshPhysicalMaterial
          color="#35403a"
          roughness={0.28}
          clearcoat={1}
          clearcoatRoughness={0.15}
          side={DoubleSide}
        />
      </mesh>
      <group position={[0, 0.015, 0]}>
        <mesh castShadow>
          <tubeGeometry args={[branchCurve, 48, 0.0055, 6, false]} />
          <meshStandardMaterial color="#3b2a1c" roughness={0.85} />
        </mesh>
        <mesh castShadow>
          <tubeGeometry args={[twigCurve, 16, 0.0035, 5, false]} />
          <meshStandardMaterial color="#3b2a1c" roughness={0.85} />
        </mesh>
        <instancedMesh
          ref={leaves}
          args={[undefined, undefined, LEAVES.length]}
          castShadow
        >
          <sphereGeometry args={[1, 12, 8]} />
          <meshPhysicalMaterial
            color="#1f3322"
            roughness={0.35}
            clearcoat={0.6}
          />
        </instancedMesh>
        <group position={bloom}>
          {Array.from({ length: 5 }, (_, i) => (
            <mesh
              key={i}
              rotation={[0.9, (i / 5) * Math.PI * 2, 0]}
              position={[
                Math.cos((i / 5) * Math.PI * 2) * 0.02,
                0.005,
                Math.sin((i / 5) * Math.PI * 2) * -0.02,
              ]}
              scale={[0.024, 0.006, 0.022]}
            >
              <sphereGeometry args={[1, 12, 8]} />
              <meshStandardMaterial color="#e9ddd0" roughness={0.6} />
            </mesh>
          ))}
          <mesh position={[0, 0.012, 0]}>
            <sphereGeometry args={[0.009, 10, 8]} />
            <meshStandardMaterial color="#d8a93a" roughness={0.7} />
          </mesh>
        </group>
        <mesh position={bud} scale={[0.012, 0.018, 0.012]}>
          <sphereGeometry args={[1, 10, 8]} />
          <meshStandardMaterial color="#6e2a26" roughness={0.6} />
        </mesh>
      </group>
    </group>
  );
}

const pillarProfile = Array.from({ length: 14 }, (_, i) => {
  const t = i / 13;
  return new Vector2(
    0.062 - t * 0.008 + Math.sin(t * 17) * 0.002 + Math.sin(t * 5.3) * 0.003,
    t * (veranda.head + 0.07),
  );
});

/** A bronze incense burner on three ball feet, with a domed lid and a bead finial. */
function Koro({ position }: { position: Point }) {
  const bowl = useMemo(
    () =>
      [
        [0, 0.012],
        [0.045, 0.012],
        [0.07, 0.03],
        [0.075, 0.055],
        [0.066, 0.075],
        [0.06, 0.078],
      ].map(([r, y]) => new Vector2(r, y)),
    [],
  );
  const lid = useMemo(
    () =>
      [
        [0.062, 0],
        [0.058, 0.018],
        [0.035, 0.04],
        [0.012, 0.05],
        [0, 0.052],
      ].map(([r, y]) => new Vector2(r, y)),
    [],
  );
  const bronze = (
    <meshStandardMaterial color="#6b4a2a" metalness={1} roughness={0.38} />
  );
  return (
    <group position={position}>
      <mesh castShadow>
        <latheGeometry args={[bowl, 28]} />
        {bronze}
      </mesh>
      <mesh position={[0, 0.078, 0]} castShadow>
        <latheGeometry args={[lid, 28]} />
        {bronze}
      </mesh>
      <mesh position={[0, 0.138, 0]} castShadow>
        <sphereGeometry args={[0.012, 12, 8]} />
        {bronze}
      </mesh>
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * 0.05, 0.007, Math.sin(a) * 0.05]}
          >
            <sphereGeometry args={[0.011, 8, 6]} />
            {bronze}
          </mesh>
        );
      })}
    </group>
  );
}

/** The tokonoma: raised board floor, lacquered edge, natural toko-bashira, scroll and flowers. */
function Tokonoma() {
  const width = toko.x1 - toko.x0,
    midX = (toko.x0 + toko.x1) / 2,
    depth = face - toko.back,
    midZ = (face + toko.back) / 2;
  return (
    <group name="tokonoma">
      <Solid
        position={[midX, toko.floor / 2, midZ - 0.02]}
        size={[width, toko.floor, depth - 0.04]}
        color="#6b4a30"
        clearcoat={0.45}
        grain={0}
        cast={false}
      />
      <Solid
        position={[midX, toko.floor / 2 + 0.005, face - 0.03]}
        size={[width, toko.floor + 0.01, 0.07]}
        color="#0f0a07"
        clearcoat={0.9}
        cast={false}
      />
      <Solid
        position={[midX, toko.top / 2, toko.back - 0.05]}
        size={[width + 0.2, toko.top, 0.1]}
        color={plaster}
        surface="plaster"
        cast={false}
      />
      {[toko.x0 - 0.05, toko.x1 + 0.05].map((x) => (
        <Solid
          key={x}
          position={[x, toko.top / 2, midZ]}
          size={[0.1, toko.top, depth + 0.02]}
          color={plaster}
          surface="plaster"
          cast={false}
        />
      ))}
      <Solid
        position={[midX, toko.top + 0.015, midZ]}
        size={[width + 0.2, 0.03, depth + 0.02]}
        color="#4a3020"
        cast={false}
      />
      <Solid
        position={[midX + 0.06, toko.top - 0.04, face - 0.03]}
        size={[width + 0.12, 0.08, 0.1]}
        color={timber}
        cast={false}
      />
      <mesh
        position={[toko.x0 + 0.055, 0, face - 0.05]}
        castShadow
        receiveShadow
      >
        <latheGeometry args={[pillarProfile, 20]} />
        <SurfaceMaterial color="#7a5638" clearcoat={0.35} />
      </mesh>
      <Solid
        position={[toko.x1 + 0.06, toko.top / 2, face - 0.04]}
        size={[0.12, toko.top, 0.12]}
        color={timber}
        cast={false}
      />
      <pointLight
        position={[midX, toko.top - 0.12, midZ + 0.05]}
        color="#ffc488"
        intensity={4.2}
        distance={2.8}
      />
      <Kakejiku position={[midX - 0.12, 1.62, toko.back]} />
      <Chabana position={[midX + 0.55, toko.floor, midZ - 0.05]} />
      <Koro position={[midX - 0.68, toko.floor, midZ + 0.02]} />
    </group>
  );
}

/** The sculpted back wall: veranda opening, lit shoji and tokonoma alcove. */
export function BackWall() {
  const shojiW = shoji.x1 - shoji.x0,
    shojiX = (shoji.x0 + shoji.x1) / 2;
  return (
    <group name="back-wall">
      <Solid
        position={[-1.5475, 3.36, wallZ]}
        size={[4.915, 0.72, 0.17]}
        color={plaster}
        surface="plaster"
        cast={false}
      />
      <Solid
        position={[2.035, 3.175, wallZ]}
        size={[2.25, 1.09, 0.17]}
        color={plaster}
        surface="plaster"
        cast={false}
      />
      <Solid
        position={[3.5825, 1.86, wallZ]}
        size={[0.845, 3.72, 0.17]}
        color={plaster}
        surface="plaster"
        cast={false}
      />
      <Solid
        position={[-1.5475, veranda.head + 0.07, face - 0.06]}
        size={[4.915, 0.14, 0.22]}
        color={timber}
        cast={false}
      />
      <Solid
        position={[0, 3.3, face - 0.035]}
        size={[8.01, 0.07, 0.07]}
        color={timber}
        cast={false}
      />
      {[-1.775, 0.785].map((x) => (
        <Solid
          key={x}
          position={[x, 1.86, face - 0.02]}
          size={[0.25, 3.72, 0.22]}
          color={timber}
          cast={false}
        />
      ))}
      <Solid
        position={[(veranda.x0 + veranda.x1) / 2, 0.02, face - 0.08]}
        size={[veranda.x1 - veranda.x0, 0.04, 0.2]}
        color="#352116"
        cast={false}
      />
      <Solid
        position={[shojiX, shoji.y0 / 2, face - 0.05]}
        size={[shojiW, shoji.y0, 0.06]}
        color="#4a2e1d"
        cast={false}
      />
      <Boxes items={koshiBattens} color="#2e1c12" cast={false} />
      <Solid
        position={[shojiX, shoji.y0 - 0.02, face - 0.06]}
        size={[shojiW, 0.05, 0.16]}
        color="#3f2819"
        cast={false}
      />
      <ShojiWindow
        position={[shojiX, (shoji.y0 + shoji.y1) / 2 + 0.005, face - 0.07]}
        width={shojiW}
        height={shoji.y1 - shoji.y0 - 0.01}
        cols={3}
        rows={7}
        glow={0.95}
        seed={5}
      />
      <Tokonoma />
      <Veranda />
      <Suspense fallback={null}>
        <DistantView />
      </Suspense>
    </group>
  );
}
