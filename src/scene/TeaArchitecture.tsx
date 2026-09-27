import { useMemo } from 'react';
import { ContactShadows } from '@react-three/drei';
import { DoubleSide, Vector2, type BufferGeometry } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Solid, SurfaceMaterial, useCanvasTexture } from './Surfaces';
import type { Point } from './stations';
import { createRandom } from './motion/dynamics';
import { Counter } from './props/Counter';
import { ChamberDressing, WaitingDressing } from './props/Dressing';
import { TeaTable } from './props/TeaTable';
import { BackWall } from './props/BackWall';
import { RightWall } from './props/RightWall';
import { WallShelf, WallTrim } from './props/WallDetail';
import {
  block,
  boxUv,
  brushText,
  merge,
  place,
  useBuilt,
  WoodMaterial,
} from './props/craft';

const timber = '#3a2419';
const plaster = '#8a7862';

function Beam({
  position,
  size,
  color = timber,
  cast = true,
}: {
  position: Point;
  size: Point;
  color?: string;
  cast?: boolean;
}) {
  return <Solid position={position} size={size} color={color} cast={cast} />;
}

function drawLanternPaper(ctx: CanvasRenderingContext2D) {
  const random = createRandom(91);
  ctx.fillStyle = '#fff3dc';
  ctx.fillRect(0, 0, 64, 256);
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(150,96,40,${random() * 0.06})`;
    ctx.fillRect(random() * 64, random() * 256, 1 + random() * 3, 1);
  }
  for (let rib = 1; rib < 16; rib++) {
    const y = (rib / 16) * 256;
    ctx.fillStyle = 'rgba(120,70,30,.55)';
    ctx.fillRect(0, y - 1.5, 64, 3);
  }
}

/** A chochin paper lantern: ribbed lathe shell, lacquer caps and a cord. */
export function PaperLantern({
  position,
  drop = 0.6,
  light,
  radius = 0.17,
}: {
  position: Point;
  drop?: number;
  light?: number;
  radius?: number;
}) {
  const paper = useCanvasTexture(64, 256, drawLanternPaper);
  const profile = useMemo(
    () =>
      Array.from({ length: 13 }, (_, i) => {
        const t = i / 12;
        return new Vector2(
          radius * (0.62 + 0.38 * Math.sin(Math.PI * t)),
          (t - 0.5) * radius * 2.5,
        );
      }),
    [radius],
  );
  const half = radius * 1.25;
  return (
    <group position={position}>
      <mesh>
        <latheGeometry args={[profile, 32]} />
        <meshStandardMaterial
          color="#e8b77e"
          map={paper}
          emissive="#ff8c35"
          emissiveMap={paper}
          emissiveIntensity={1.7}
          roughness={0.92}
          side={DoubleSide}
        />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[0, side * (half + 0.012), 0]}>
          <cylinderGeometry args={[radius * 0.66, radius * 0.66, 0.035, 24]} />
          <meshStandardMaterial color="#1c120c" roughness={0.35} />
        </mesh>
      ))}
      <mesh position={[0, half + drop / 2, 0]}>
        <cylinderGeometry args={[0.004, 0.004, drop, 6]} />
        <meshStandardMaterial color="#1a110b" roughness={0.8} />
      </mesh>
      <mesh position={[0, half + 0.045, 0]}>
        <torusGeometry args={[0.014, 0.0025, 6, 14]} />
        <meshStandardMaterial color="#6a5028" metalness={0.8} roughness={0.4} />
      </mesh>
      <mesh position={[0, half + drop - 0.012, 0]}>
        <cylinderGeometry args={[0.035, 0.042, 0.018, 16]} />
        <meshStandardMaterial
          color="#5a4424"
          metalness={0.8}
          roughness={0.45}
        />
      </mesh>
      {light !== undefined && (
        <pointLight color="#ffc68f" intensity={light} distance={6} />
      )}
    </group>
  );
}

function drawEnso(ctx: CanvasRenderingContext2D) {
  const random = createRandom(306);
  ctx.fillStyle = '#e9dcc0';
  ctx.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = `rgba(120,90,50,${random() * 0.05})`;
    ctx.fillRect(random() * 256, random() * 512, 1 + random() * 6, 1);
  }
  const cx = 128,
    cy = 200,
    r = 78;
  for (let bristle = 0; bristle < 26; bristle++) {
    const offset = (bristle / 25 - 0.5) * 22;
    ctx.beginPath();
    const start = -1.2 + random() * 0.08,
      sweep = Math.PI * 1.86 - bristle * 0.004;
    for (let step = 0; step <= 120; step++) {
      const t = step / 120,
        angle = start + sweep * t,
        rr = r + offset * (1 - t * 0.55) + Math.sin(t * 9) * 1.5;
      const x = cx + Math.cos(angle) * rr,
        y = cy + Math.sin(angle) * rr;
      if (step === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `rgba(22,16,12,${0.28 + random() * 0.4})`;
    ctx.lineWidth = 1.2 + random() * 1.4;
    ctx.stroke();
  }
  ctx.fillStyle = '#a3321f';
  ctx.fillRect(170, 356, 22, 22);
  ctx.fillStyle = '#e9dcc0';
  ctx.fillRect(175, 361, 12, 4);
  ctx.fillRect(179, 368, 4, 7);
  ctx.fillStyle = 'rgba(22,16,12,.8)';
  for (let i = 0; i < 4; i++) ctx.fillRect(180, 300 + i * 13, 10, 6);
}

function drawBamboo(ctx: CanvasRenderingContext2D) {
  const random = createRandom(412);
  ctx.fillStyle = '#e6d8bb';
  ctx.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = `rgba(120,90,50,${random() * 0.05})`;
    ctx.fillRect(random() * 256, random() * 512, 1 + random() * 6, 1);
  }
  for (const [x, width, tone] of [
    [96, 13, 0.78],
    [150, 9, 0.45],
  ]) {
    let y = 470;
    while (y > 40) {
      const length = 58 + random() * 40,
        lean = (470 - y) * 0.04;
      ctx.fillStyle = `rgba(22,18,12,${tone * (0.75 + random() * 0.25)})`;
      ctx.beginPath();
      ctx.moveTo(x + lean - width / 2, y);
      ctx.lineTo(x + lean + length * 0.04 - width / 2, y - length + 5);
      ctx.lineTo(x + lean + length * 0.04 + width / 2, y - length + 5);
      ctx.lineTo(x + lean + width / 2, y);
      ctx.fill();
      ctx.fillStyle = `rgba(14,10,8,${tone})`;
      ctx.fillRect(
        x + lean + length * 0.04 - width / 2 - 2,
        y - length,
        width + 4,
        3,
      );
      y -= length;
    }
  }
  for (let leaf = 0; leaf < 22; leaf++) {
    const x = 90 + random() * 110,
      y = 60 + random() * 200,
      angle = 0.3 + random() * 1.2 * (random() > 0.5 ? 1 : -1) + Math.PI / 2,
      length = 34 + random() * 30;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = `rgba(20,16,10,${0.45 + random() * 0.45})`;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(length * 0.4, -length * 0.12, length, 0);
    ctx.quadraticCurveTo(length * 0.4, length * 0.12, 0, 0);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = '#a3321f';
  ctx.fillRect(196, 400, 18, 18);
  ctx.fillStyle = 'rgba(22,16,12,.8)';
  for (let i = 0; i < 3; i++) ctx.fillRect(203, 330 + i * 16, 8, 7);
}

/** A hanging scroll with ink art (an enso by default), brocade border and a wooden roller. */
/** 一期一会 ("one time, one meeting") in brush script, with a signature and seal. */
function drawIchigo(ctx: CanvasRenderingContext2D) {
  const random = createRandom(512);
  ctx.fillStyle = '#e6d8ba';
  ctx.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = `rgba(120,90,50,${random() * 0.05})`;
    ctx.fillRect(random() * 256, random() * 512, 1 + random() * 6, 1);
  }
  brushText(ctx, '一期一会', 118, 40, 92);
  brushText(ctx, '閑人', 214, 360, 20);
  ctx.fillStyle = '#9e2f1c';
  ctx.fillRect(203, 410, 22, 22);
  brushText(ctx, '閑', 214, 412, 18, '230,216,186');
}

function Scroll({
  position,
  paint = drawEnso,
  turn = Math.PI / 2,
}: {
  position: Point;
  paint?: (ctx: CanvasRenderingContext2D) => void;
  turn?: number;
}) {
  const art = useCanvasTexture(256, 512, paint);
  return (
    <group position={position} rotation={[0, turn, 0]}>
      <mesh position={[0, 0, -0.004]} castShadow receiveShadow>
        <boxGeometry args={[0.58, 1.36, 0.006]} />
        <SurfaceMaterial surface="cloth" color="#4a4630" />
      </mesh>
      <mesh position={[0, 0.03, 0]} receiveShadow>
        <planeGeometry args={[0.44, 0.88]} />
        <meshStandardMaterial map={art} roughness={0.92} />
      </mesh>
      <mesh
        position={[0, -0.7, 0.012]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
      >
        <cylinderGeometry args={[0.018, 0.018, 0.66, 16]} />
        <meshStandardMaterial color="#1e140d" roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.69, 0.008]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.009, 0.009, 0.6, 10]} />
        <meshStandardMaterial color="#2b1d12" roughness={0.6} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * 0.09, 0.8, 0.006]}
          rotation={[0, 0, side * -0.62]}
        >
          <cylinderGeometry args={[0.0025, 0.0025, 0.22, 5]} />
          <meshStandardMaterial color="#6b5a3a" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

/** A floor andon: timber frame around lit paper, with its own warm pool of light. */
function Andon({ position }: { position: Point }) {
  const w = 0.3,
    h = 0.62;
  return (
    <group position={position}>
      <mesh position={[0, 0.12 + h / 2, 0]}>
        <boxGeometry args={[w - 0.02, h, w - 0.02]} />
        <SurfaceMaterial surface="shoji" color="#f2dcb2" glow={1.7} />
      </mesh>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <Beam
            key={`${sx}${sz}`}
            position={[(sx * w) / 2, (0.12 + h + 0.03) / 2, (sz * w) / 2]}
            size={[0.024, 0.12 + h + 0.03, 0.024]}
            color="#24170f"
          />
        )),
      )}
      {[0.12, 0.12 + h / 2, 0.12 + h].map((y) => (
        <group key={y}>
          {[-1, 1].map((side) => (
            <group key={side}>
              <Beam
                position={[0, y, (side * w) / 2]}
                size={[w + 0.02, 0.018, 0.018]}
                color="#24170f"
              />
              <Beam
                position={[(side * w) / 2, y, 0]}
                size={[0.018, 0.018, w + 0.02]}
                color="#24170f"
              />
            </group>
          ))}
        </group>
      ))}
      <pointLight
        position={[0, 0.12 + h * 0.55, 0]}
        color="#ffb061"
        intensity={2.6}
        distance={3.6}
      />
    </group>
  );
}

function Shoji({
  x,
  z,
  width = 2.3,
}: {
  x: number;
  z: number;
  width?: number;
}) {
  return (
    <group>
      <Solid
        position={[x, 1.79, z]}
        size={[width - 0.08, 2.8, 0.035]}
        color="#e0bd8e"
        surface="shoji"
      />
      {[-1, 1].map((side) => (
        <Beam
          key={side}
          position={[x + (width / 2 - 0.035) * side, 1.79, z + 0.04]}
          size={[0.075, 2.88, 0.085]}
        />
      ))}
      {Array.from({ length: 5 }, (_, index) => (
        <Beam
          key={index}
          position={[x, 0.42 + index * 0.68, z + 0.045]}
          size={[width, 0.037, 0.065]}
        />
      ))}
      {[-0.25, 0.25].map((fraction) => (
        <Beam
          key={fraction}
          position={[x + width * fraction, 1.79, z + 0.045]}
          size={[0.035, 2.8, 0.065]}
        />
      ))}
    </group>
  );
}

function Floor({ center, length }: { center: number; length: number }) {
  return (
    <Solid
      position={[0, -0.16, center]}
      size={[8.3, 0.31, length]}
      color="#80563a"
      surface="floor"
      grain={2}
    />
  );
}

/** Plank boards on a sao-buchi grid: long battens, cross battens every 0.9 m and a perimeter molding. */
function Ceiling({ center, length }: { center: number; length: number }) {
  const grid = useBuilt(() => {
    const z0 = center - length / 2,
      parts = Array.from({ length: 17 }, (_, i) =>
        block(
          [0.034, 0.032, length],
          [-3.84 + i * 0.48, 3.684, center],
          '#2a1a11',
        ),
      );
    for (let z = z0 + 0.45; z < z0 + length - 0.2; z += 0.9)
      parts.push(block([8.1, 0.026, 0.03], [0, 3.674, z], '#24160e'));
    for (const x of [-1, 1])
      parts.push(
        block([0.07, 0.06, length], [x * 4.0, 3.67, center], '#2a1a11'),
        block([0.03, 0.02, length], [x * 3.955, 3.632, center], '#1e120b'),
      );
    return merge(parts);
  });
  return (
    <group>
      <Solid
        position={[0, 3.72, center]}
        size={[8.2, 0.04, length]}
        color="#56382a"
        surface="floor"
        grain={0}
        cast={false}
      />
      <mesh geometry={grid}>
        <WoodMaterial />
      </mesh>
    </group>
  );
}

/** Posts, rails and a board wainscot on a plaster wall; `face` is the wall's inner x. */
function FramedWall({
  face,
  from,
  to,
  posts,
  cast = true,
}: {
  face: number;
  from: number;
  to: number;
  posts: number[];
  cast?: boolean;
}) {
  const side = Math.sign(face),
    length = to - from,
    center = (from + to) / 2,
    at = (depth: number) => face - side * depth;
  const frame = useBuilt(() =>
    merge([
      ...posts.map((z) =>
        block([0.13, 3.7, 0.14], [at(0.06), 1.85, z], timber),
      ),
      block([0.09, 0.12, length], [at(0.045), 2.32, center], timber),
      block([0.07, 0.07, length], [at(0.035), 3.3, center], timber),
      block([0.04, 0.94, length], [at(0.02), 0.47, center], '#4a2e1d'),
      block([0.07, 0.05, length], [at(0.04), 0.96, center], timber),
      block([0.07, 0.07, length], [at(0.04), 0.035, center], timber),
      ...[0.33, 0.64].map((y) =>
        block([0.004, 0.006, length], [at(0.041), y, center], '#1f140d'),
      ),
    ]),
  );
  return (
    <group>
      <mesh geometry={frame} castShadow={cast} receiveShadow>
        <WoodMaterial />
      </mesh>
      <WallTrim face={face} from={from} to={to} posts={posts} />
    </group>
  );
}

const matBox = (size: Point, position: Point, tile: number) =>
  place(
    boxUv(new RoundedBoxGeometry(...size, 2, 0.012), 0, position[2], [
      tile,
      tile,
    ]),
    position,
  );

/** Ten mats with cloth borders, as two merged meshes; UVs keep the weave at real scale. */
function Tatami({ center }: { center: Point }) {
  const [cx, , cz] = center;
  const built = useBuilt(() => {
    const mats: BufferGeometry[] = [],
      borders: BufferGeometry[] = [];
    for (const x of [-0.9, 0.9])
      for (const z of [-1.35, -0.45, 0.45, 1.35, 2.25]) {
        mats.push(matBox([1.79, 0.052, 0.885], [cx + x, 0.026, cz + z], 0.45));
        for (const edge of [-1, 1])
          borders.push(
            matBox(
              [1.792, 0.054, 0.036],
              [cx + x, 0.027, cz + z + edge * 0.425],
              0.35,
            ),
          );
      }
    const mat = merge(mats),
      border = merge(borders);
    return {
      mat,
      border,
      dispose() {
        mat.dispose();
        border.dispose();
      },
    };
  });
  return (
    <group>
      <mesh geometry={built.mat} castShadow receiveShadow>
        <SurfaceMaterial surface="tatami" color="#a28f62" />
      </mesh>
      <mesh geometry={built.border} castShadow receiveShadow>
        <SurfaceMaterial surface="cloth" color="#26302a" />
      </mesh>
    </group>
  );
}
function TeaHouseDoorway() {
  const doorWidth = 2.6;
  const postThickness = 0.22;
  const postDepth = 0.26;
  const leftPostX = -(doorWidth / 2 + postThickness / 2);
  const rightPostX = doorWidth / 2 + postThickness / 2;
  const z = 3.32;

  const transomSlatPositions = [
    -1.12, -0.9, -0.68, -0.45, -0.23, 0, 0.23, 0.45, 0.68, 0.9, 1.12,
  ];

  return (
    <group name="teahouse-doorway">
      {/* Continuous solid partition walls meeting outer walls with no gaps */}
      <Solid
        position={[-2.785, 1.85, z]}
        size={[2.53, 3.7, 0.18]}
        color={plaster}
        surface="plaster"
      />
      <Solid
        position={[2.785, 1.85, z]}
        size={[2.53, 3.7, 0.18]}
        color={plaster}
        surface="plaster"
      />
      <Solid
        position={[0, 3.56, z]}
        size={[doorWidth, 0.28, 0.18]}
        color={plaster}
        surface="plaster"
      />

      {/* Wall flank timber framing */}
      <Beam position={[-2.785, 0.06, z]} size={[2.53, 0.12, 0.22]} />
      <Beam position={[2.785, 0.06, z]} size={[2.53, 0.12, 0.22]} />
      <Beam position={[-2.785, 0.95, z]} size={[2.53, 0.07, 0.21]} />
      <Beam position={[2.785, 0.95, z]} size={[2.53, 0.07, 0.21]} />
      <Beam position={[-2.785, 2.48, z]} size={[2.53, 0.12, 0.22]} />
      <Beam position={[2.785, 2.48, z]} size={[2.53, 0.12, 0.22]} />
      <Beam position={[-2.785, 1.85, z]} size={[0.12, 3.7, 0.22]} />
      <Beam position={[2.785, 1.85, z]} size={[0.12, 3.7, 0.22]} />
      <Beam position={[-3.98, 1.85, z]} size={[0.14, 3.7, 0.22]} />
      <Beam position={[3.98, 1.85, z]} size={[0.14, 3.7, 0.22]} />
      <Beam position={[0, 3.64, z]} size={[8.2, 0.14, 0.26]} />

      {/* Main doorway jamb posts and base plinths */}
      {[leftPostX, rightPostX].map((x) => (
        <group key={x}>
          <Beam
            position={[x, 1.85, z]}
            size={[postThickness, 3.7, postDepth]}
          />
          <Solid
            position={[x, 0.045, z]}
            size={[postThickness + 0.04, 0.09, postDepth + 0.04]}
            color="#25150e"
          />
        </group>
      ))}

      {/* Doorway threshold with sliding runner tracks */}
      <Solid
        position={[0, 0.02, z]}
        size={[doorWidth + 0.02, 0.04, 0.28]}
        color="#352116"
      />
      <Solid
        position={[0, 0.041, z - 0.04]}
        size={[doorWidth, 0.004, 0.02]}
        color="#1f140d"
      />
      <Solid
        position={[0, 0.041, z + 0.04]}
        size={[doorWidth, 0.004, 0.02]}
        color="#1f140d"
      />

      {/* Main doorway lintel spanning across posts */}
      <Beam
        position={[0, 2.48, z]}
        size={[doorWidth + postThickness * 2 + 0.16, 0.14, 0.28]}
      />
      <Beam position={[-1.61, 2.48, z]} size={[0.04, 0.16, 0.3]} />
      <Beam position={[1.61, 2.48, z]} size={[0.04, 0.16, 0.3]} />

      {/* Transom (Ranma) with wooden lattice and washi paper */}
      <Beam position={[0, 3.38, z]} size={[doorWidth + 0.02, 0.08, 0.24]} />
      <Solid
        position={[0, 2.93, z]}
        size={[doorWidth, 0.78, 0.02]}
        color="#e8d1a7"
        surface="paper"
      />
      {transomSlatPositions.map((slatX) => (
        <Beam
          key={slatX}
          position={[slatX, 2.93, z]}
          size={[0.028, 0.78, 0.06]}
        />
      ))}
      <Beam position={[0, 2.93, z]} size={[doorWidth, 0.03, 0.065]} />

      {/* Open sliding shoji screen panels flanking the jambs */}
      <group position={[-1.46, 1.25, z - 0.04]}>
        <Solid
          position={[0, 0, 0]}
          size={[0.3, 2.38, 0.028]}
          color="#dfbe90"
          surface="paper"
        />
        <Beam position={[-0.135, 0, 0.01]} size={[0.03, 2.38, 0.04]} />
        <Beam position={[0.135, 0, 0.01]} size={[0.03, 2.38, 0.04]} />
        {[-0.8, -0.4, 0, 0.4, 0.8].map((sy) => (
          <Beam key={sy} position={[0, sy, 0.012]} size={[0.3, 0.024, 0.038]} />
        ))}
      </group>
      <group position={[1.46, 1.25, z + 0.04]}>
        <Solid
          position={[0, 0, 0]}
          size={[0.3, 2.38, 0.028]}
          color="#dfbe90"
          surface="paper"
        />
        <Beam position={[-0.135, 0, 0.01]} size={[0.03, 2.38, 0.04]} />
        <Beam position={[0.135, 0, 0.01]} size={[0.03, 2.38, 0.04]} />
        {[-0.8, -0.4, 0, 0.4, 0.8].map((sy) => (
          <Beam key={sy} position={[0, sy, 0.012]} size={[0.3, 0.024, 0.038]} />
        ))}
      </group>

      {/* Traditional Jasmine Dragon split noren curtain */}
      <group position={[0, 0, 0]}>
        <mesh position={[0, 2.38, z + 0.06]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.014, 0.014, doorWidth + 0.02, 12]} />
          <meshStandardMaterial color="#2d1c12" roughness={0.7} />
        </mesh>
        <Beam position={[-1.3, 2.38, z + 0.06]} size={[0.03, 0.04, 0.06]} />
        <Beam position={[1.3, 2.38, z + 0.06]} size={[0.03, 0.04, 0.06]} />

        {[-0.82, 0, 0.82].map((nx, idx) => (
          <group key={idx}>
            <Solid
              position={[nx, 2.38, z + 0.06]}
              size={[0.08, 0.04, 0.032]}
              color="#3c4c34"
              surface="cloth"
            />
            <Solid
              position={[nx, 2.2, z + 0.06]}
              size={[0.74, 0.34, 0.014]}
              color="#425339"
              surface="cloth"
            />
          </group>
        ))}

        {/* Jasmine Dragon Crest on center noren panel */}
        <mesh position={[0, 2.2, z + 0.068]}>
          <circleGeometry args={[0.075, 24]} />
          <meshStandardMaterial color="#eae2cb" roughness={0.9} />
        </mesh>
        <mesh position={[0, 2.2, z + 0.07]} rotation={[0, 0, 0.35]}>
          <ringGeometry args={[0.015, 0.045, 16]} />
          <meshStandardMaterial color="#425339" roughness={0.9} />
        </mesh>
      </group>

      {/* Warm doorway lantern on jamb */}
      <group position={[1.32, 1.94, z + 0.2]}>
        <Beam position={[-0.08, 0.12, -0.07]} size={[0.04, 0.04, 0.14]} />
        <Solid
          position={[0, 0.13, 0]}
          size={[0.18, 0.025, 0.18]}
          color="#25150e"
        />
        <mesh position={[0, 0, 0]} castShadow>
          <boxGeometry args={[0.14, 0.22, 0.14]} />
          <meshStandardMaterial
            color="#ffe5b0"
            emissive="#ffa834"
            emissiveIntensity={0.65}
            roughness={0.9}
          />
        </mesh>
        {[-0.07, 0.07].map((lx) =>
          [-0.07, 0.07].map((lz) => (
            <Beam
              key={`${lx}${lz}`}
              position={[lx, 0, lz]}
              size={[0.014, 0.22, 0.014]}
              color="#25150e"
            />
          )),
        )}
        <Solid
          position={[0, -0.12, 0]}
          size={[0.16, 0.025, 0.16]}
          color="#25150e"
        />
        <pointLight
          position={[0, 0, 0.04]}
          color="#ffcf8e"
          intensity={2.2}
          distance={4.2}
        />
      </group>
    </group>
  );
}

export function WaitingRoom() {
  return (
    <group name="waiting-counter-room">
      <Floor center={7.3} length={8.1} />
      <Ceiling center={7.3} length={8.1} />
      <Solid
        position={[-4.1, 1.85, 7.3]}
        size={[0.19, 3.7, 8.1]}
        color={plaster}
        surface="plaster"
      />
      <Solid
        position={[4.1, 1.85, 7.3]}
        size={[0.19, 3.7, 8.1]}
        color={plaster}
        surface="plaster"
      />
      <Solid
        position={[0, 1.85, 11.28]}
        size={[8.2, 3.7, 0.17]}
        color={plaster}
        surface="plaster"
      />
      <TeaHouseDoorway />
      <FramedWall
        face={-4.005}
        from={3.35}
        to={11.2}
        posts={[4.05, 7.4, 10.74]}
        cast={false}
      />
      <FramedWall
        face={4.005}
        from={3.35}
        to={5.66}
        posts={[5.66]}
        cast={false}
      />
      <FramedWall
        face={4.005}
        from={7.94}
        to={11.2}
        posts={[7.94, 10.74]}
        cast={false}
      />
      {[4.1, 7.45, 10.7].map((z) => (
        <Beam
          key={z}
          position={[0, 3.48, z]}
          size={[8.2, 0.22, 0.25]}
          cast={false}
        />
      ))}
      <Shoji x={3.95} z={6.8} width={2.15} />
      <Counter />
      <WaitingDressing />
      <Scroll position={[-3.99, 1.72, 9.05]} paint={drawBamboo} />
      <PaperLantern position={[-2.3, 2.5, 5.55]} drop={0.92} light={7} />
      <PaperLantern position={[-1.2, 2.62, 7.35]} drop={0.8} light={5} />
    </group>
  );
}

export function TeaChamber({ children }: { children: React.ReactNode }) {
  return (
    <group name="tea-chamber">
      <Floor center={-1.5} length={9.7} />
      <Ceiling center={-1.5} length={9.7} />
      <Solid
        position={[-4.1, 1.85, -1.48]}
        size={[0.19, 3.7, 9.75]}
        color={plaster}
        surface="plaster"
      />
      <Solid
        position={[4.1, 1.85, -1.48]}
        size={[0.19, 3.7, 9.75]}
        color={plaster}
        surface="plaster"
      />
      <FramedWall
        face={-4.005}
        from={-6.3}
        to={3.25}
        posts={[-6.1, -3.4, -0.9, 1.7]}
      />
      <Scroll position={[-3.99, 1.62, -4.62]} />
      <Scroll position={[-3.99, 1.62, 0.4]} paint={drawBamboo} />
      <Scroll
        position={[3.99, 1.62, -2.45]}
        paint={drawIchigo}
        turn={-Math.PI / 2}
      />
      <Andon position={[-3.5, 0, -1.95]} />
      <WallShelf position={[-3.865, 1.42, -2.25]} />
      <RightWall />
      {[-5.94, -1.53, 3.17].map((z) => (
        <Beam key={z} position={[3.91, 1.85, z]} size={[0.17, 3.7, 0.17]} />
      ))}
      {[-5.7, -3.4, -0.9, 1.7].map((z) => (
        <Beam
          key={z}
          position={[0, 3.47, z]}
          size={[8.1, 0.2, 0.29]}
          cast={false}
        />
      ))}
      <BackWall />
      <Tatami center={[0, 0, -2.5]} />
      <ContactShadows
        position={[0, 0.054, -2.5]}
        opacity={0.55}
        scale={4.2}
        blur={2.2}
        far={1.2}
        resolution={512}
        frames={1}
        color="#1c110a"
      />
      <TeaTable />
      <ChamberDressing />
      <PaperLantern position={[-1.05, 2.45, -2.6]} drop={0.96} light={3.6} />
      <pointLight
        position={[-2.3, 2.45, -5.25]}
        intensity={7}
        color="#ffd5a0"
        distance={7}
      />
      {children}
    </group>
  );
}
