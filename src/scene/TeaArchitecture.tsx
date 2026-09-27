import { Suspense, useEffect, useMemo } from 'react';
import { ContactShadows, useTexture } from '@react-three/drei';
import {
  CanvasTexture,
  DoubleSide,
  PlaneGeometry,
  SRGBColorSpace,
  Vector2,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Cup } from './Ceramics';
import { Solid, SurfaceMaterial } from './Surfaces';
import type { Point } from './stations';
import { createRandom } from './motion/dynamics';

const timber = '#3a2419';
const plaster = '#917354';
const backdropTint = '#e4d3bf';

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

function canvasTexture(
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
function useCanvasTexture(
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
          color="#f0cf9c"
          map={paper}
          emissive="#ff9f4a"
          emissiveMap={paper}
          emissiveIntensity={2.4}
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
      {light !== undefined && (
        <pointLight color="#ffb35c" intensity={light} distance={6} />
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

/** A hanging scroll with an ink circle, brocade border and a wooden roller. */
function Scroll({ position }: { position: Point }) {
  const art = useCanvasTexture(256, 512, drawEnso);
  return (
    <group position={position} rotation={[0, Math.PI / 2, 0]}>
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

function drawNoren(ctx: CanvasRenderingContext2D) {
  const random = createRandom(512);
  ctx.fillStyle = '#23324a';
  ctx.fillRect(0, 0, 512, 192);
  for (let i = 0; i < 1800; i++) {
    ctx.fillStyle = `rgba(${random() > 0.5 ? '255,255,255' : '0,0,0'},${random() * 0.05})`;
    ctx.fillRect(random() * 512, random() * 192, 1 + random() * 8, 1);
  }
  ctx.strokeStyle = '#e8dcc2';
  ctx.fillStyle = '#e8dcc2';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(256, 96, 50, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(256, 134);
  ctx.quadraticCurveTo(252, 110, 256, 92);
  ctx.stroke();
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(256, 104);
    ctx.rotate(side * 0.62);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-15, -12, -13, -38, 0, -52);
    ctx.bezierCurveTo(13, -38, 15, -12, 0, 0);
    ctx.fill();
    ctx.strokeStyle = '#23324a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.lineTo(0, -44);
    ctx.stroke();
    ctx.restore();
  }
}

/** A split doorway curtain with soft vertical folds. */
function Noren({ position, width }: { position: Point; width: number }) {
  const art = useCanvasTexture(512, 192, drawNoren);
  const panels = 3,
    gap = 0.02,
    panelWidth = (width - gap * (panels - 1)) / panels,
    height = 0.66;
  const geometry = useMemo(() => {
    const plane = new PlaneGeometry(panelWidth, height, 24, 1);
    const position = plane.attributes.position;
    for (let i = 0; i < position.count; i++)
      position.setZ(
        i,
        Math.sin((position.getX(i) / panelWidth) * Math.PI * 6) * 0.012,
      );
    plane.computeVertexNormals();
    return plane;
  }, [panelWidth]);
  const slices = useMemo(
    () =>
      Array.from({ length: panels }, (_, index) => {
        const texture = art.clone();
        texture.repeat.set(1 / panels, 1);
        texture.offset.set(index / panels, 0);
        return texture;
      }),
    [art],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(
    () => () => slices.forEach((texture) => texture.dispose()),
    [slices],
  );
  return (
    <group position={position}>
      <mesh rotation={[0, 0, Math.PI / 2]} position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.012, 0.012, width + 0.12, 10]} />
        <meshStandardMaterial color="#2a1a10" roughness={0.5} />
      </mesh>
      {slices.map((texture, index) => {
        const x = (index - (panels - 1) / 2) * (panelWidth + gap);
        return (
          <mesh
            key={index}
            geometry={geometry}
            position={[x, -height / 2, 0]}
            castShadow
          >
            <meshStandardMaterial
              map={texture}
              roughness={0.94}
              side={DoubleSide}
            />
          </mesh>
        );
      })}
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

function Ceiling({ center, length }: { center: number; length: number }) {
  return (
    <group>
      <Solid
        position={[0, 3.72, center]}
        size={[8.2, 0.04, length]}
        color="#4a3020"
        cast={false}
      />
      {Array.from({ length: 17 }, (_, index) => (
        <Beam
          key={index}
          position={[-3.84 + index * 0.48, 3.684, center]}
          size={[0.034, 0.032, length]}
          color="#2a1a11"
          cast={false}
        />
      ))}
    </group>
  );
}

/** Posts, rails and a board wainscot on a plaster wall; `face` is the wall's inner x. */
function FramedWall({
  face,
  from,
  to,
  posts,
}: {
  face: number;
  from: number;
  to: number;
  posts: number[];
}) {
  const side = Math.sign(face),
    length = to - from,
    center = (from + to) / 2,
    at = (depth: number) => face - side * depth;
  return (
    <group>
      {posts.map((z) => (
        <Beam key={z} position={[at(0.06), 1.85, z]} size={[0.13, 3.7, 0.14]} />
      ))}
      <Beam position={[at(0.045), 2.32, center]} size={[0.09, 0.12, length]} />
      <Beam position={[at(0.035), 3.3, center]} size={[0.07, 0.07, length]} />
      <Solid
        position={[at(0.02), 0.47, center]}
        size={[0.04, 0.94, length]}
        color="#4a2e1d"
      />
      <Beam position={[at(0.04), 0.96, center]} size={[0.07, 0.05, length]} />
      <Beam position={[at(0.04), 0.035, center]} size={[0.07, 0.07, length]} />
      {[0.33, 0.64].map((y) => (
        <Beam
          key={y}
          position={[at(0.041), y, center]}
          size={[0.004, 0.006, length]}
          color="#1f140d"
        />
      ))}
    </group>
  );
}

function Vase({ position }: { position: Point }) {
  return (
    <group position={position}>
      <mesh castShadow>
        <sphereGeometry args={[0.17, 20, 16]} />
        <meshPhysicalMaterial
          color="#394638"
          roughness={0.35}
          clearcoat={0.25}
        />
      </mesh>
      <mesh position={[0, 0.14, 0]} castShadow>
        <cylinderGeometry args={[0.075, 0.11, 0.16, 18]} />
        <meshPhysicalMaterial
          color="#394638"
          roughness={0.35}
          clearcoat={0.25}
        />
      </mesh>
      {[
        [-0.2, 0.33],
        [0.08, 0.44],
        [0.24, 0.26],
      ].map(([x, y], index) => (
        <group key={index}>
          <mesh position={[x / 2, y / 2 + 0.16, 0]} rotation={[0, 0, -x * 0.7]}>
            <cylinderGeometry args={[0.008, 0.012, y, 5]} />
            <meshStandardMaterial color="#48583a" />
          </mesh>
          <mesh position={[x, y + 0.12, 0]} scale={[0.45, 1, 0.32]}>
            <sphereGeometry args={[0.11, 8, 6]} />
            <meshStandardMaterial color="#506346" roughness={1} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function TeaBackdrop() {
  const texture = useTexture('/images/tea-back-wall.jpg');
  texture.colorSpace = SRGBColorSpace;
  return (
    <mesh position={[0, 1.85, -6.18]}>
      <planeGeometry args={[8.25, 4.64]} />
      <meshBasicMaterial map={texture} color={backdropTint} />
    </mesh>
  );
}

function RightWallBackdrop() {
  const texture = useTexture('/images/tea-right-wall.jpg');
  texture.colorSpace = SRGBColorSpace;
  return (
    <mesh position={[3.994, 1.85, -3.05]} rotation={[0, -Math.PI / 2, 0]}>
      <planeGeometry args={[9.55, 3.65]} />
      <meshBasicMaterial map={texture} color={backdropTint} />
    </mesh>
  );
}

function CounterBackdrop() {
  const texture = useTexture('/images/counter-wall.jpg');
  texture.colorSpace = SRGBColorSpace;
  return (
    <mesh position={[-3.99, 1.85, 7.35]} rotation={[0, Math.PI / 2, 0]}>
      <planeGeometry args={[7.1, 4]} />
      <meshBasicMaterial map={texture} color={backdropTint} />
    </mesh>
  );
}

function Cushion({ position }: { position: Point }) {
  const geometry = useMemo(
    () => new RoundedBoxGeometry(0.74, 0.11, 0.8, 4, 0.045),
    [],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh
      geometry={geometry}
      position={position}
      rotation={[0, 0.18, 0]}
      castShadow
      receiveShadow
    >
      <SurfaceMaterial surface="cloth" color="#3f4a37" />
    </mesh>
  );
}

function Tatami({ center }: { center: Point }) {
  const [cx, , cz] = center;
  return (
    <group>
      {[-0.9, 0.9].flatMap((x) =>
        [-1.35, -0.45, 0.45, 1.35].map((z) => (
          <group key={`${x}${z}`}>
            <Solid
              position={[cx + x, 0.026, cz + z]}
              size={[1.79, 0.052, 0.885]}
              color="#a28f62"
              surface="tatami"
            />
            {[-1, 1].map((edge) => (
              <Solid
                key={edge}
                position={[cx + x, 0.027, cz + z + edge * 0.425]}
                size={[1.792, 0.054, 0.036]}
                color="#26302a"
                surface="cloth"
              />
            ))}
          </group>
        )),
      )}
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
      <Suspense fallback={null}>
        <CounterBackdrop />
      </Suspense>
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
      <Solid
        position={[-3.1, 1.85, 3.32]}
        size={[2, 3.7, 0.19]}
        color={plaster}
        surface="plaster"
      />
      <Solid
        position={[3.1, 1.85, 3.32]}
        size={[2, 3.7, 0.19]}
        color={plaster}
        surface="plaster"
      />
      <Solid
        position={[0, 3.34, 3.32]}
        size={[4.25, 0.72, 0.2]}
        color={plaster}
        surface="plaster"
      />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Solid
            position={[side * 2.67, 0.47, 3.435]}
            size={[2.86, 0.94, 0.04]}
            color="#4a2e1d"
          />
          <Beam
            position={[side * 2.67, 0.96, 3.45]}
            size={[2.86, 0.05, 0.07]}
          />
          <Beam
            position={[side * 2.67, 2.32, 3.45]}
            size={[2.86, 0.12, 0.08]}
          />
        </group>
      ))}
      <Beam position={[0, 3.06, 3.43]} size={[2.35, 0.19, 0.26]} />
      {[-1.23, 1.23].map((x) => (
        <Beam key={x} position={[x, 1.53, 3.44]} size={[0.18, 3.08, 0.28]} />
      ))}
      <Noren position={[0, 2.94, 3.6]} width={2.2} />
      {[4.05, 7.4, 10.74].map((z) => (
        <Beam key={z} position={[-3.94, 1.85, z]} size={[0.16, 3.7, 0.16]} />
      ))}
      {[4.1, 7.45, 10.7].map((z) => (
        <Beam
          key={z}
          position={[0, 3.48, z]}
          size={[8.2, 0.22, 0.25]}
          cast={false}
        />
      ))}
      <Shoji x={3.95} z={6.8} width={2.15} />
      <Solid
        position={[-2.2, 0.62, 6.07]}
        size={[3.3, 1.24, 0.96]}
        color="#3d2517"
      />
      <Solid
        position={[-2.2, 1.26, 6.07]}
        size={[3.55, 0.14, 1.11]}
        color="#6a3f25"
        clearcoat={0.35}
      />
      {Array.from({ length: 17 }, (_, index) => (
        <Beam
          key={index}
          position={[-3.72 + index * 0.19, 0.62, 6.565]}
          size={[0.05, 1.1, 0.035]}
          color="#2a1a10"
        />
      ))}
      <Cup position={[-2.86, 1.4, 5.93]} color="#a5a077" />
      <Cup position={[-2.4, 1.4, 5.93]} color="#b98755" />
      <Vase position={[2.55, 0.17, 4.46]} />
      <PaperLantern position={[-1.9, 2.7, 7.5]} drop={0.72} light={9} />
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
      <Andon position={[-3.52, 0, -4.2]} />
      <Suspense fallback={null}>
        <RightWallBackdrop />
      </Suspense>
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
      <Suspense fallback={null}>
        <TeaBackdrop />
      </Suspense>
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
      <Solid
        position={[0, 0.575, -2.41]}
        size={[2.58, 0.07, 1.37]}
        color="#5b3522"
        clearcoat={0.55}
      />
      <Solid
        position={[0, 0.505, -2.41]}
        size={[2.3, 0.07, 1.15]}
        color="#3a2216"
      />
      {[-1.04, 1.04].flatMap((x) =>
        [-0.51, 0.51].map((z) => (
          <Beam
            key={`${x}${z}`}
            position={[x, 0.27, -2.41 + z]}
            size={[0.14, 0.47, 0.16]}
          />
        )),
      )}
      <Solid
        position={[0, 0.6115, -2.36]}
        size={[2.05, 0.003, 0.36]}
        color="#bba98a"
        surface="cloth"
      />
      <Cup position={[-0.58, 0.68, -2.18]} color="#828069" />
      <Cup position={[0.58, 0.68, -2.34]} color="#a9a18a" />
      <Cushion position={[-0.76, 0.105, -0.93]} />
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
