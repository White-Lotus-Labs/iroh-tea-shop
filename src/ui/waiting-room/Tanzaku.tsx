'use client';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  CanvasTexture,
  CatmullRomCurve3,
  Color,
  DoubleSide,
  Euler,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  TubeGeometry,
  Vector2,
  Vector3,
  type Texture,
} from 'three';
import { PROJECT, TEAM, xUrl, type Member } from './content';
import { SakuraPetals } from './SakuraPetals';
import {
  CAMEO,
  drawBack,
  drawFront,
  faceCanvas,
  FH,
  FW,
  HOLE_Y,
  PAPERS,
} from './slipArt';
import './Tanzaku.css';

// Five tanzaku tied to a sasa branch, one per friend of the Lotus. The doorway
// breeze swings and twirls them; a pointer brushing through does too.
const N = TEAM.length;
const SW = 0.5;
const SH = (SW * FH) / FW;
const HOLE = (HOLE_Y / FH) * SH;
const GAP = 0.76;
const PIVOT_X = TEAM.map((_, i) => (i - (N - 1) / 2) * GAP);
const CORD = [0.46, 0.8, 0.3, 0.66, 0.5];
const REST_TWIST = [0.22, -0.36, 0.12, -0.2, 0.3];
const culmY = (x: number) => 0.07 * x - 0.006 * x * x;
const CULM_X0 = -2.08;
const CULM_X1 = 7;
const culmR = (x: number) =>
  0.021 + 0.03 * ((x - CULM_X0) / (CULM_X1 - CULM_X0));
// The rig's own bounds: slips, cords, and the leaves over the culm. The tip's
// leaves may reach a little past the left edge, into the column gap.
const RIG = { left: -2.2, right: 1.96, top: 0.46, bottom: -2.8 };
const FOV = 28;
const CAM_Z = 10;
const TAU = Math.PI * 2;
const NUMERALS = ['一', '二', '三', '四'];
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
// A soft hyphen for long names on narrow flaps; not every browser hyphenates.
const soft = (word: string) => word.replace(/^(\w{7})(\w{4,})$/, '$1\u00ad$2');

type Rect = { x: number; y: number; w: number; h: number };
type Pointer = { x: number; y: number; inside: boolean };

const BEND = /* glsl */ `
uniform float uTime, uAmp, uFreq, uFlutter, uPhase, uLean;
uniform vec2 uSize;

float sTheta(float s, float u) {
  float a = uAmp * (0.04 + pow(s, 1.4)) * (0.85 + 0.3 * u);
  float ph = uFreq * s + 0.7 * u + uTime * 0.9 + uPhase;
  return a * sin(ph) + uFlutter * a * 0.5 * sin(ph * 2.7 + uTime * 2.1) + uLean * s;
}
// Paper keeps its length: integrate the bend down from the tie.
vec3 sheetAt(float u, float v) {
  float s = 1.0 - v;
  float y = 0.0, z = 0.0;
  const int NS = 16;
  float h = 1.0 / float(NS);
  for (int i = 0; i < NS; i++) {
    float ss = (float(i) + 0.5) * h;
    float w = clamp((s - (ss - 0.5 * h)) / h, 0.0, 1.0);
    float th = sTheta(ss, u);
    y += cos(th) * h * w;
    z += sin(th) * h * w;
  }
  float W = uSize.x, H = uSize.y;
  float cup = (u - 0.5) * (u - 0.5) * 4.0;
  return vec3((u - 0.5) * W, H * 0.5 - y * H, z * H - cup * 0.04 * W * s);
}
void sheetPoint(vec2 q, out vec3 P, out vec3 NN) {
  P = sheetAt(q.x, q.y);
  vec3 pu = sheetAt(q.x + 0.004, q.y);
  vec3 pv = sheetAt(q.x, q.y + 0.002);
  NN = normalize(cross(pu - P, pv - P));
}`;

function paperTexture(canvas: HTMLCanvasElement) {
  const t = new CanvasTexture(canvas);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function slipMaterial(front: Texture, back: Texture, i: number) {
  const uniforms = {
    uTime: { value: 0 },
    uAmp: { value: 0.16 },
    uFreq: { value: 2.6 },
    uFlutter: { value: 0.5 },
    uPhase: { value: i * 1.7 },
    uLean: { value: 0 },
    uSize: { value: new Vector2(SW, SH) },
    uBack: { value: back },
    uLift: { value: 0 },
    uDim: { value: 0 },
    uWarm: { value: new Color('#ffcf98') },
  };
  const material = new MeshStandardMaterial({
    map: front,
    side: DoubleSide,
    roughness: 0.9,
    transparent: true,
    alphaTest: 0.02,
    opacity: 0,
  });
  // One DoubleSide pass, so gl_FrontFacing can pick the face's own artwork.
  material.forceSinglePass = true;
  material.customProgramCacheKey = () => 'tanzaku-slip';
  material.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\n${BEND}`)
      .replace(
        '#include <beginnormal_vertex>',
        `vec3 sheetP; vec3 objectNormal;
        sheetPoint(uv, sheetP, objectNormal);
        #ifdef USE_TANGENT
          vec3 objectTangent = vec3( tangent.xyz );
        #endif`,
      )
      .replace('#include <begin_vertex>', 'vec3 transformed = sheetP;');
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform sampler2D uBack;\nuniform float uLift, uDim;\nuniform vec3 uWarm;',
      )
      .replace(
        '#include <map_fragment>',
        `vec4 sampledDiffuseColor = gl_FrontFacing
          ? texture2D( map, vMapUv )
          : texture2D( uBack, vec2( 1.0 - vMapUv.x, vMapUv.y ) );
        diffuseColor *= sampledDiffuseColor;`,
      )
      .replace(
        '#include <alphatest_fragment>',
        'if ( diffuseColor.a / max( opacity, 1e-4 ) < alphaTest ) discard;',
      )
      .replace(
        '#include <opaque_fragment>',
        `float fres = pow( 1.0 - clamp( abs( dot( geometryNormal, geometryViewDir ) ), 0.0, 1.0 ), 3.0 );
        outgoingLight += fres * 0.1 * uWarm;
        // Lantern light from the doorway comes through the paper.
        outgoingLight += diffuseColor.rgb * ( 0.1 + 0.3 * uLift ) * uWarm;
        outgoingLight += fres * 0.35 * uLift * uWarm;
        outgoingLight *= 1.0 - 0.45 * uDim;
        gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,
      );
  };
  return { material, uniforms };
}

// Culm joints, as fractions of its length from the tip.
const NODES = [0.035, 0.12, 0.215, 0.32, 0.435, 0.56, 0.7, 0.85];

function bambooTexture() {
  const w = 1024;
  const h = 64;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d')!;
  const g = x.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, '#7f9150');
  g.addColorStop(1, '#6a7d3f');
  x.fillStyle = g;
  x.fillRect(0, 0, w, h);
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 90; i++) {
    x.fillStyle = rnd() < 0.5 ? 'rgba(220,226,160,.14)' : 'rgba(40,52,20,.16)';
    x.fillRect(0, rnd() * h, w, 0.6 + rnd() * 1.6);
  }
  for (const u of NODES) {
    const px = u * w;
    x.fillStyle = 'rgba(236,236,210,.28)';
    x.fillRect(px + 2, 0, 9, h);
    x.fillStyle = '#3d4b22';
    x.fillRect(px - 1, 0, 2.5, h);
    x.fillStyle = 'rgba(200,196,120,.55)';
    x.fillRect(px - 4, 0, 3, h);
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

function culmGeometry() {
  const pts: Vector3[] = [];
  for (let k = 0; k <= 16; k++) {
    const x = CULM_X0 + ((CULM_X1 - CULM_X0) * k) / 16;
    pts.push(new Vector3(x, culmY(x), 0));
  }
  const curve = new CatmullRomCurve3(pts);
  const len = curve.getLength();
  const T = 260;
  const R = 12;
  const g = new TubeGeometry(curve, T, 1, R, false);
  const pos = g.attributes.position;
  const c = new Vector3();
  const p = new Vector3();
  for (let i = 0; i <= T; i++) {
    const t = i / T;
    curve.getPointAt(t, c);
    let r = culmR(c.x);
    for (const n of NODES) {
      const d = ((t - n) * len) / 0.022;
      r *= 1 + 0.16 * Math.exp(-d * d);
    }
    for (let j = 0; j <= R; j++) {
      const k = i * (R + 1) + j;
      p.fromBufferAttribute(pos, k).sub(c).multiplyScalar(r).add(c);
      pos.setXYZ(k, p.x, p.y, p.z);
    }
  }
  g.computeVertexNormals();
  return g;
}

function leafGeometry() {
  const s = new Shape();
  const W = 0.13;
  s.moveTo(0, 0);
  s.bezierCurveTo(W * 0.7, 0.05, W, 0.3, W * 0.62, 0.6);
  s.bezierCurveTo(W * 0.35, 0.82, W * 0.08, 0.95, 0, 1);
  s.bezierCurveTo(-W * 0.08, 0.95, -W * 0.35, 0.82, -W * 0.62, 0.6);
  s.bezierCurveTo(-W, 0.3, -W * 0.7, 0.05, 0, 0);
  const g = new ShapeGeometry(s, 10);
  const pos = g.attributes.position;
  for (let k = 0; k < pos.count; k++) {
    const x = pos.getX(k);
    const y = pos.getY(k);
    // Arch along the length and fold along the midrib.
    pos.setZ(k, -0.16 * y * y + Math.abs(x) * 0.5);
  }
  g.computeVertexNormals();
  return g;
}

type Leaf = {
  at: Vector3;
  ang: number;
  len: number;
  tilt: number;
  roll: number;
  phase: number;
};

function leafLayout() {
  let seed = 0x5a5a;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const twigs: { from: Vector3; to: Vector3 }[] = [];
  const leaves: Leaf[] = [];
  for (const x of [-2.02, -1.12, -0.38, 0.38, 1.14, 1.92, 2.8, 3.8]) {
    const tip = x < -2;
    const from = new Vector3(x, culmY(x), -0.01);
    const to = from
      .clone()
      .add(new Vector3(-0.12 + rnd() * 0.16, 0.15 + rnd() * 0.09, -0.08));
    if (tip) to.x = x + 0.05;
    twigs.push({ from, to });
    const n = 6 + Math.floor(rnd() * 3);
    for (let j = 0; j < n; j++) {
      leaves.push({
        at: to,
        ang: -Math.PI / 2 + (j / (n - 1) - 0.5) * 2.7 + (rnd() - 0.5) * 0.3,
        len: (0.3 + rnd() * 0.2) * (tip ? 0.66 : 1),
        tilt: -0.5 + rnd() * 0.7,
        roll: (rnd() - 0.5) * 0.9,
        phase: rnd() * TAU,
      });
    }
  }
  return { twigs, leaves };
}

function Bamboo({
  reduced,
  leavesRef,
  layout,
}: {
  reduced: boolean;
  leavesRef: RefObject<InstancedMesh | null>;
  layout: ReturnType<typeof leafLayout>;
}) {
  const culm = useMemo(culmGeometry, []);
  const leaf = useMemo(leafGeometry, []);
  const bark = useMemo(bambooTexture, []);
  useEffect(
    () => () => {
      culm.dispose();
      leaf.dispose();
      bark.dispose();
    },
    [culm, leaf, bark],
  );
  useEffect(() => {
    const m = leavesRef.current;
    if (!m) return;
    const c = new Color();
    layout.leaves.forEach((_, k) => {
      const shade = 0.78 + ((k * 37) % 11) / 30;
      m.setColorAt(k, c.setRGB(0.24 * shade, 0.36 * shade, 0.18 * shade));
    });
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [layout, leavesRef]);
  const up = new Vector3(0, 1, 0);
  return (
    <group>
      <mesh geometry={culm}>
        <meshStandardMaterial map={bark} roughness={0.42} />
      </mesh>
      {layout.twigs.map(({ from, to }, k) => {
        const d = to.clone().sub(from);
        return (
          <mesh
            key={k}
            position={from.clone().addScaledVector(d, 0.5)}
            quaternion={new Quaternion().setFromUnitVectors(
              up,
              d.clone().normalize(),
            )}
          >
            <cylinderGeometry args={[0.004, 0.008, d.length(), 5]} />
            <meshStandardMaterial color="#6d7a3e" roughness={0.6} />
          </mesh>
        );
      })}
      {PIVOT_X.map((x) => (
        <mesh
          key={x}
          position={[x, culmY(x), 0]}
          rotation={[0, Math.PI / 2, 0]}
        >
          <torusGeometry args={[culmR(x) + 0.004, 0.0055, 6, 18]} />
          <meshStandardMaterial color="#e8dcc0" roughness={0.8} />
        </mesh>
      ))}
      <instancedMesh
        ref={leavesRef}
        args={[leaf, undefined, layout.leaves.length]}
        frustumCulled={false}
      >
        <meshStandardMaterial
          side={DoubleSide}
          roughness={0.62}
          color="#ffffff"
          emissive="#1a2410"
          emissiveIntensity={reduced ? 0.4 : 0.3}
        />
      </instancedMesh>
    </group>
  );
}

function Scene({
  reduced,
  area,
  focus,
  hover,
  pointer,
  hits,
}: {
  reduced: boolean;
  area: RefObject<Rect>;
  focus: RefObject<number | null>;
  hover: RefObject<number | null>;
  pointer: RefObject<Pointer>;
  hits: RefObject<(HTMLButtonElement | null)[]>;
}) {
  const { camera, size } = useThree();
  const rig = useRef<Group>(null);
  const leaves = useRef<InstancedMesh>(null);
  const swings = useRef<(Group | null)[]>([]);
  const twists = useRef<(Group | null)[]>([]);
  const hinges = useRef<(Group | null)[]>([]);
  const cords = useRef<(Mesh | null)[]>([]);
  const slips = useRef<(Mesh | null)[]>([]);
  const layout = useMemo(leafLayout, []);
  const state = useRef(
    TEAM.map((_, i) => ({
      sw: 0,
      vsw: 0,
      fa: 0,
      vfa: 0,
      tw: REST_TWIST[i],
      vtw: 0,
      show: reduced ? 1 : 0,
      near: 0,
      lift: 0,
      dim: 0,
    })),
  );
  const brush = useRef({ x: 0, y: 0, vx: 0, has: false });
  const boxes = useRef(TEAM.map(() => [0, 0, 0, 0]));

  const faces = useMemo(
    () =>
      TEAM.map((m, i) => {
        const front = paperTexture(faceCanvas((c) => drawFront(c, m, i, null)));
        const back = paperTexture(faceCanvas((c) => drawBack(c, m, i)));
        return { front, back, ...slipMaterial(front, back, i) };
      }),
    [],
  );

  // Each slip's cameo waits for its sketch.
  useEffect(() => {
    let alive = true;
    TEAM.forEach((m, i) => {
      const img = new Image();
      img.src = m.portrait;
      img
        .decode()
        .then(() => {
          if (!alive) return;
          faces[i].front.image = faceCanvas((c) => drawFront(c, m, i, img));
          faces[i].front.needsUpdate = true;
        })
        .catch(() => undefined);
    });
    return () => {
      alive = false;
    };
  }, [faces]);

  useEffect(
    () => () => {
      for (const f of faces) {
        f.material.dispose();
        f.front.dispose();
        f.back.dispose();
      }
    },
    [faces],
  );

  const tmp = useMemo(
    () => ({
      v: new Vector3(),
      m: new Matrix4(),
      q: new Quaternion(),
      e: new Euler(),
      s: new Vector3(),
    }),
    [],
  );

  useFrame((three, delta) => {
    const g = rig.current;
    if (!g) return;
    const dt = Math.min(delta, 1 / 30);
    const t = three.clock.elapsedTime;

    // Fit the rig into the slips area the page lays out.
    const visH = 2 * CAM_Z * Math.tan((FOV * Math.PI) / 360);
    const unit = visH / size.height;
    const a = area.current;
    const sc = Math.min(
      (a.w * unit) / (RIG.right - RIG.left),
      (a.h * unit) / (RIG.top - RIG.bottom),
    );
    g.scale.setScalar(sc);
    g.position.set(
      (a.x + a.w / 2 - size.width / 2) * unit -
        (sc * (RIG.left + RIG.right)) / 2,
      (size.height / 2 - a.y - a.h / 2) * unit -
        (sc * (RIG.top + RIG.bottom)) / 2,
      0,
    );

    // The pointer, in rig units, and how fast it crosses.
    const p = pointer.current;
    const b = brush.current;
    if (p.inside && !reduced) {
      const lx = ((p.x - size.width / 2) * unit - g.position.x) / sc;
      const ly = ((size.height / 2 - p.y) * unit - g.position.y) / sc;
      if (b.has) b.vx += ((lx - b.x) / dt - b.vx) * Math.min(1, dt * 18);
      b.x = lx;
      b.y = ly;
      b.has = true;
    } else {
      b.has = false;
      b.vx = 0;
    }

    const gust = reduced
      ? 0
      : 0.55 + 0.45 * Math.sin(t * 0.21) * Math.sin(t * 0.083 + 1.3);
    const f = focus.current;
    const h = hover.current;
    for (let i = 0; i < N; i++) {
      const s = state.current[i];
      const focused = f === i;
      const py = culmY(PIVOT_X[i]);
      if (t > 0.3 + i * 0.16) s.show = Math.min(1, s.show + dt * 1.5);
      const drop = 1 - (1 - s.show) ** 3;
      s.near += ((focused ? 1 : 0) - s.near) * Math.min(1, dt * 5);
      s.lift += ((focused || h === i ? 1 : 0) - s.lift) * Math.min(1, dt * 6);
      s.dim += ((f !== null && !focused ? 1 : 0) - s.dim) * Math.min(1, dt * 4);

      if (reduced) {
        s.sw = 0;
        s.fa = focused ? -0.22 : 0;
        s.tw = focused ? 0 : REST_TWIST[i];
      } else {
        const ph = i * 0.9;
        let aSw =
          0.9 *
          gust *
          (Math.sin(t * 0.8 - ph) + 0.4 * Math.sin(t * 1.9 - ph * 1.7));
        let aFa = -0.5 * gust * (0.5 + 0.5 * Math.sin(t * 0.55 - ph * 0.6));
        let aTw =
          1.1 *
          gust *
          (Math.sin(t * 0.33 + i * 2.3) + 0.5 * Math.sin(t * 0.91 + i));
        let k = 6;
        let kTw = 1.1;
        let c = 1.2;
        let cTw = 0.55;
        let rFa = 0;
        let rTw = 0;
        if (h === i && !focused) {
          // A hand near the slip steadies it and turns it to be read.
          aSw *= 0.3;
          aTw *= 0.2;
          c = 3.2;
          kTw = 3.2;
          cTw = 2.4;
          rFa = -0.12;
          rTw = Math.round(s.tw / TAU) * TAU;
        }
        if (focused) {
          aSw = aFa = aTw = 0;
          k = kTw = 30;
          c = cTw = 9;
          rFa = -0.26;
          rTw = Math.round(s.tw / TAU) * TAU;
        } else if (b.has && s.show >= 1) {
          // A pointer brushing through pushes the slip and twirls it.
          const len = CORD[i] - HOLE + SH / 2;
          const dx = b.x - (PIVOT_X[i] + Math.sin(s.sw) * len);
          const dy = b.y - (py - Math.cos(s.sw) * len);
          if (Math.abs(dx) < SW * 0.8 && Math.abs(dy) < SH * 0.56) {
            const push = clamp(b.vx, -7, 7);
            s.vsw = clamp(s.vsw + push * 1.0 * dt, -1.1, 1.1);
            s.vtw = clamp(s.vtw + push * Math.sign(dx || 1) * 3.6 * dt, -5, 5);
          }
        }
        s.vsw += (-k * s.sw - c * s.vsw + aSw) * dt;
        s.sw += s.vsw * dt;
        s.vfa += (-k * (s.fa - rFa) - c * 1.2 * s.vfa + aFa) * dt;
        s.fa += s.vfa * dt;
        s.vtw += (-kTw * (s.tw - rTw) - cTw * s.vtw + aTw) * dt;
        s.tw += s.vtw * dt;
      }

      const sg = swings.current[i];
      const tg = twists.current[i];
      const hg = hinges.current[i];
      const cord = cords.current[i];
      if (!sg || !tg || !hg || !cord) continue;
      sg.rotation.set(s.fa, 0, s.sw);
      tg.rotation.y = s.tw;
      const L = CORD[i] * drop;
      cord.scale.y = Math.max(L, 1e-3);
      cord.position.y = -L / 2;
      hg.position.y = -L;
      // Held up to read: the paper hinges at its tie to face the viewer.
      hg.rotation.x = -s.fa * s.near;
      const u = faces[i].uniforms;
      u.uTime.value = reduced ? 3 + i : t;
      u.uLift.value = s.lift;
      u.uDim.value = s.dim;
      u.uLean.value = reduced ? 0.02 : 0.06 * gust - s.vfa * 0.1;
      u.uAmp.value = 0.16 * (1 - 0.7 * s.near);
      faces[i].material.opacity = drop;
    }

    const lm = leaves.current;
    if (lm) {
      layout.leaves.forEach((leaf, k) => {
        const w = reduced
          ? 0
          : Math.sin(t * 1.3 + leaf.phase) * 0.07 * gust +
            Math.sin(t * 2.9 + leaf.phase * 1.3) * 0.025;
        tmp.e.set(
          leaf.tilt + w * 0.6,
          leaf.roll,
          leaf.ang - Math.PI / 2 + w,
          'ZXY',
        );
        tmp.q.setFromEuler(tmp.e);
        tmp.s.setScalar(leaf.len);
        tmp.m.compose(leaf.at, tmp.q, tmp.s);
        lm.setMatrixAt(k, tmp.m);
      });
      lm.instanceMatrix.needsUpdate = true;
    }

    // Keep each slip's button over the slip, so the page stays the hit target.
    g.updateMatrixWorld();
    for (let i = 0; i < N; i++) {
      const mesh = slips.current[i];
      const btn = hits.current[i];
      if (!mesh || !btn) continue;
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (const [cx, cy] of [
        [-SW / 2, SH / 2],
        [SW / 2, SH / 2],
        [-SW / 2, -SH / 2],
        [SW / 2, -SH / 2],
      ]) {
        tmp.v.set(cx, cy, 0).applyMatrix4(mesh.matrixWorld).project(camera);
        const px = ((tmp.v.x + 1) / 2) * size.width;
        const py = ((1 - tmp.v.y) / 2) * size.height;
        x0 = Math.min(x0, px);
        x1 = Math.max(x1, px);
        y0 = Math.min(y0, py);
        y1 = Math.max(y1, py);
      }
      const w = Math.max(44, x1 - x0 + 10);
      const box = [(x0 + x1) / 2 - w / 2, y0 - 5, w, y1 - y0 + 10];
      const last = boxes.current[i];
      if (box.some((v, k) => Math.abs(v - last[k]) > 0.5)) {
        boxes.current[i] = box;
        btn.style.transform = `translate(${box[0].toFixed(1)}px, ${box[1].toFixed(1)}px)`;
        btn.style.width = `${box[2].toFixed(1)}px`;
        btn.style.height = `${box[3].toFixed(1)}px`;
      }
    }
  });

  return (
    <>
      <ambientLight color="#b9a6c9" intensity={0.62} />
      <directionalLight
        color="#ffd6a0"
        position={[-3.3, 2.1, 2.4]}
        intensity={2.1}
      />
      <directionalLight
        color="#ffcf9a"
        position={[3.6, 0.6, 1.8]}
        intensity={0.8}
      />
      <directionalLight
        color="#ffb070"
        position={[0.4, 1.2, -2.6]}
        intensity={1.3}
      />
      <group ref={rig}>
        <Bamboo reduced={reduced} leavesRef={leaves} layout={layout} />
        {TEAM.map((m, i) => (
          <group
            key={m.handle}
            position={[PIVOT_X[i], culmY(PIVOT_X[i]), 0]}
            ref={(el) => {
              swings.current[i] = el;
            }}
          >
            <group
              ref={(el) => {
                twists.current[i] = el;
              }}
            >
              <mesh
                ref={(el) => {
                  cords.current[i] = el;
                }}
              >
                <cylinderGeometry args={[0.0045, 0.0045, 1, 5]} />
                <meshStandardMaterial color="#efe3c6" roughness={0.85} />
              </mesh>
              <group
                ref={(el) => {
                  hinges.current[i] = el;
                }}
              >
                <mesh
                  ref={(el) => {
                    slips.current[i] = el;
                  }}
                  position={[0, HOLE - SH / 2, 0]}
                  material={faces[i].material}
                  frustumCulled={false}
                >
                  <planeGeometry args={[SW, SH, 6, 48]} />
                </mesh>
              </group>
            </group>
          </group>
        ))}
      </group>
      <group scale={0.3} position={[0, 0, 0.6]}>
        <SakuraPetals count={30} size={1.8} seed={0x7a2c} reduced={reduced} />
      </group>
    </>
  );
}

/** A tall crop of the sketch, centred a little below the face. */
function portraitStyle(member: Member): CSSProperties {
  const [fx, fy] = CAMEO[member.handle];
  const cw = 0.62;
  const ch = (cw * 4) / 3;
  const left = clamp(fx - cw / 2, 0, 1 - cw);
  const top = clamp(fy - 0.2, 0, 1 - ch);
  return {
    backgroundImage: `url(${member.portrait})`,
    backgroundSize: `${100 / cw}% auto`,
    backgroundPosition: `${(left / (1 - cw)) * 100}% ${(top / (1 - ch)) * 100}%`,
  };
}

function Mon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <g transform="translate(24 24)" fill="currentColor">
        <circle r="20" fill="none" stroke="currentColor" strokeWidth="2" />
        <path
          transform="rotate(-20.6)"
          d="M0 9.6C-1 2-3-5.6-.8-11.6C-11.6-8-13.2 2.4 0 9.6Z"
        />
        <path
          transform="rotate(17.2)"
          d="M0 9.6C1 2 3-5.6.8-11.6C11.6-8 13.2 2.4 0 9.6Z"
        />
        <path d="M0 9.6V14" stroke="currentColor" strokeWidth="2" />
      </g>
    </svg>
  );
}

export function Tanzaku({ reduced }: { reduced: boolean }) {
  const [focus, setFocus] = useState<number | null>(null);
  const [step, setStep] = useState(0);
  const [wide, setWide] = useState(true);
  const stage = useRef<HTMLDivElement>(null);
  const slipsBox = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLElement>(null);
  const area = useRef<Rect>({ x: 0, y: 0, w: 1, h: 1 });
  const offset = useRef({ x: 0, y: 0 });
  const focusRef = useRef<number | null>(null);
  const hover = useRef<number | null>(null);
  const pointer = useRef<Pointer>({ x: 0, y: 0, inside: false });
  const hits = useRef<(HTMLButtonElement | null)[]>([]);
  const last = useRef(0);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1000px)');
    const apply = () => setWide(media.matches);
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);

  // The canvas bleeds past the slips column; fit the rig to the column itself.
  useEffect(() => {
    const s = stage.current;
    const a = slipsBox.current;
    if (!s || !a) return;
    const measure = () => {
      const sb = s.getBoundingClientRect();
      const ab = a.getBoundingClientRect();
      offset.current = { x: sb.left, y: sb.top };
      area.current = {
        x: ab.left - sb.left,
        y: ab.top - sb.top,
        w: ab.width,
        h: ab.height,
      };
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(s);
    ro.observe(a);
    const scroller = s.closest('.tz');
    scroller?.addEventListener('scroll', measure, { passive: true });
    return () => {
      ro.disconnect();
      scroller?.removeEventListener('scroll', measure);
    };
  }, []);

  useEffect(() => {
    const opening = focusRef.current === null && focus !== null;
    focusRef.current = focus;
    // On a short phone the card sits above the fold; focusing scrolls to it.
    if (opening) card.current?.focus();
  }, [focus]);

  const open = (i: number) => {
    last.current = i;
    setFocus(i);
  };
  const close = (restore: boolean) => {
    setFocus(null);
    if (restore) hits.current[last.current]?.focus();
  };

  useEffect(() => {
    if (focus === null) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFocus(null);
        hits.current[last.current]?.focus();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const next = (focus + (e.key === 'ArrowRight' ? 1 : N - 1)) % N;
        last.current = next;
        setFocus(next);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [focus]);

  const member = focus === null ? null : TEAM[focus];
  const prev = focus === null ? 0 : (focus + N - 1) % N;
  const next = focus === null ? 0 : (focus + 1) % N;
  return (
    <div
      className="tz"
      data-reading={focus !== null || undefined}
      onPointerMove={(e) => {
        pointer.current = {
          x: e.clientX - offset.current.x,
          y: e.clientY - offset.current.y,
          inside: true,
        };
      }}
      onPointerLeave={() => (pointer.current.inside = false)}
      onPointerDown={(e) => {
        const target = e.target as Element;
        if (focus !== null && !target.closest('.tz-card, .tz-hit'))
          close(false);
      }}
    >
      <div className="tz-left">
        <section
          className="tz-noren"
          aria-labelledby="tz-title"
          inert={focus !== null}
        >
          <div className="tz-rod" aria-hidden="true" />
          <div className="tz-cloth">
            <header className="tz-band tz-weave">
              <Mon className="tz-mon" />
              <h1 id="tz-title">{PROJECT.name}</h1>
              <p className="tz-tagline">{PROJECT.tagline}</p>
              <p className="tz-summary">{PROJECT.summary}</p>
            </header>
            <ol className="tz-flaps" aria-label="Four stations inside">
              {PROJECT.steps.map((s, i) => {
                const body = (
                  <>
                    <span className="tz-flap-num" aria-hidden="true">
                      {NUMERALS[i]}
                    </span>
                    <span className="tz-flap-label">{soft(s.label)}</span>
                    <span className="tz-flap-caption">{s.caption}</span>
                    {wide && <span className="tz-flap-text">{s.text}</span>}
                  </>
                );
                return (
                  <li
                    key={s.label}
                    className="tz-flap"
                    data-active={(!wide && step === i) || undefined}
                    style={{ '--i': i } as CSSProperties}
                  >
                    {wide ? (
                      <div className="tz-flap-face tz-weave">{body}</div>
                    ) : (
                      <button
                        type="button"
                        className="tz-flap-face tz-weave"
                        aria-expanded={step === i}
                        aria-controls="tz-step"
                        onClick={() => setStep(i)}
                      >
                        {body}
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
          {!wide && (
            <p id="tz-step" className="tz-step" aria-live="polite">
              <strong>{PROJECT.steps[step].caption}.</strong>{' '}
              {PROJECT.steps[step].text}
            </p>
          )}
          <p className="tz-honesty">{PROJECT.honesty}</p>
        </section>

        {member && focus !== null && (
          <article
            ref={card}
            id="tz-card"
            className="tz-card"
            tabIndex={-1}
            aria-labelledby="tz-card-name"
            style={{ '--paper': PAPERS[focus] } as CSSProperties}
          >
            <div className="tz-card-sheet" key={focus}>
              <div className="tz-card-art" aria-hidden="true">
                <div style={portraitStyle(member)} />
                <Mon className="tz-card-seal" />
              </div>
              <div className="tz-card-body">
                <h2 id="tz-card-name">@{member.handle}</h2>
                <p className="tz-card-roles">{member.roles}</p>
                <p className="tz-card-bio">{member.bio}</p>
                <a
                  className="tz-card-x"
                  href={xUrl(member.handle)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Follow on X <span aria-hidden="true">↗</span>
                </a>
              </div>
            </div>
            <nav className="tz-card-nav" aria-label="Other slips">
              <button
                type="button"
                onClick={() => open(prev)}
                aria-label={`Previous slip: @${TEAM[prev].handle}`}
              >
                <span aria-hidden="true">←</span>
                <span className="tz-card-nav-name">@{TEAM[prev].handle}</span>
              </button>
              <span className="tz-card-count" aria-hidden="true">
                {focus + 1} / {N}
              </span>
              <button
                type="button"
                onClick={() => open(next)}
                aria-label={`Next slip: @${TEAM[next].handle}`}
              >
                <span className="tz-card-nav-name">@{TEAM[next].handle}</span>
                <span aria-hidden="true">→</span>
              </button>
            </nav>
            <button
              type="button"
              className="tz-card-close"
              onClick={() => close(true)}
              aria-label="Hang the slip back"
            >
              <span aria-hidden="true">×</span>
            </button>
          </article>
        )}
      </div>

      <div className="tz-slips">
        <div ref={slipsBox} className="tz-slips-box" />
        <div ref={stage} className="tz-stage">
          <Canvas
            className="tz-canvas"
            flat
            dpr={[1, 2]}
            gl={{
              antialias: true,
              alpha: true,
              powerPreference: 'high-performance',
            }}
            camera={{ fov: FOV, position: [0, 0, CAM_Z], near: 0.1, far: 50 }}
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
          >
            <Scene
              reduced={reduced}
              area={area}
              focus={focusRef}
              hover={hover}
              pointer={pointer}
              hits={hits}
            />
          </Canvas>
          {TEAM.map((m, i) => (
            <button
              key={m.handle}
              ref={(el) => {
                hits.current[i] = el;
              }}
              type="button"
              className="tz-hit"
              aria-label={`@${m.handle}, ${m.roles}`}
              aria-expanded={focus === i}
              aria-controls={focus === i ? 'tz-card' : undefined}
              onClick={() => (focus === i ? close(true) : open(i))}
              onPointerEnter={() => (hover.current = i)}
              onPointerLeave={() => (hover.current = null)}
              onFocus={() => (hover.current = i)}
              onBlur={() => (hover.current = null)}
            />
          ))}
        </div>
        <p className="tz-hint" aria-hidden="true">
          <span className="on-mouse">
            {reduced
              ? 'Click a slip to read it'
              : 'Brush the slips · Click one to read it'}
          </span>
          <span className="on-touch">Tap a slip to read it</span>
        </p>
      </div>
    </div>
  );
}
