'use client';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  CanvasTexture,
  Color,
  DoubleSide,
  EquirectangularReflectionMapping,
  Group,
  MeshPhysicalMaterial,
  PerspectiveCamera,
  PMREMGenerator,
  PointLight,
  SRGBColorSpace,
  Vector2,
  Vector3,
  type Texture,
} from 'three';
import { PROJECT, TEAM, xUrl } from './content';
import { SakuraPetals } from './SakuraPetals';
import {
  drawBack,
  drawFront,
  ROSTER_ROW,
  SIGN_SLOTS,
  sheetCanvas,
  TH,
  TW,
} from './charterArt';
import './Invitation.css';

// The sheet is a ThreeUI 3D Paper certificate, re-hung: the same arc-length
// bend, but integrated down from a rod, so the doorway breeze lifts the free
// bottom edge while the top stays held.
const SW = 2.2;
const SH = (SW * TH) / TW + 0.06;
const FOV = 24;
const CAM_Z = 8.2;
// The canvas starts 96px above the stage (see .inv-canvas) and keeps the
// sheet centred between the header and the controls below it.
const WIDE_RESERVE = { top: 96, bottom: 16, fill: 0.9 };
const NARROW_RESERVE = { top: 96, bottom: 190, fill: 0.9 };
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

const BEND = /* glsl */ `
uniform float uTime, uAmp, uFreq, uTwist, uFlutter, uPhase;
uniform vec2 uSize;

float sTheta(float s, float u) {
  float a = uAmp * (0.05 + pow(s, 1.3)) * (0.8 + 0.4 * u);
  float ph = uFreq * s + uTwist * u + uTime * 0.55 + uPhase;
  return a * sin(ph) + uFlutter * a * 0.5 * sin(ph * 2.3 + uTime * 1.7) - 0.06 * s;
}
// Paper keeps its length: integrate the bend from the rod instead of pushing z.
vec3 sheetAt(float u, float v) {
  float s = 1.0 - v;
  float y = 0.0, z = 0.0;
  const int NS = 20;
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
  float sway = sin(uTime * 0.7 + uPhase + s * 1.8) * 0.016 * W * s;
  return vec3((u - 0.5) * W + sway, H * 0.5 - y * H, z * H - cup * 0.05 * W * (0.25 + 0.75 * s));
}
void sheetPoint(vec2 q, out vec3 P, out vec3 NN) {
  P = sheetAt(q.x, q.y);
  vec3 pu = sheetAt(q.x + 0.003, q.y);
  vec3 pv = sheetAt(q.x, q.y + 0.003);
  NN = normalize(cross(pu - P, pv - P));
}`;

function envTexture() {
  const w = 1024;
  const h = 512;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d')!;
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#4a3a4c');
  g.addColorStop(0.46, '#1c1418');
  g.addColorStop(1, '#0a0708');
  x.fillStyle = g;
  x.fillRect(0, 0, w, h);
  const blob = (cx: number, cy: number, r: number, col: string) => {
    const rg = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    rg.addColorStop(0, col);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = rg;
    x.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  };
  blob(w * 0.3, h * 0.28, 300, 'rgba(255,214,160,.9)');
  blob(w * 0.72, h * 0.3, 240, 'rgba(255,190,130,.55)');
  blob(w * 0.5, h * 0.2, 300, 'rgba(170,150,210,.35)');
  const t = new CanvasTexture(c);
  t.mapping = EquirectangularReflectionMapping;
  t.colorSpace = SRGBColorSpace;
  return t;
}

function paperTexture(canvas: HTMLCanvasElement) {
  const t = new CanvasTexture(canvas);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function haloTexture() {
  const s = 256;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(0,0,0,.6)');
  g.addColorStop(0.45, 'rgba(0,0,0,.3)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, s, s);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

type Side = 'front' | 'back';

function Hanger() {
  const top = SH / 2 + 0.035;
  const hook = SH / 2 + 2.6;
  const cord = (x: number) => {
    const dx = -x;
    const dy = hook - top;
    const len = Math.hypot(dx, dy);
    return (
      <mesh
        position={[x / 2, (top + hook) / 2, 0]}
        rotation={[0, 0, Math.atan2(dx, dy) * -1]}
      >
        <cylinderGeometry args={[0.005, 0.005, len, 6]} />
        <meshStandardMaterial color="#b89b72" roughness={0.9} />
      </mesh>
    );
  };
  return (
    <group>
      <mesh position={[0, top, 0.005]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.024, 0.024, SW * 1.1, 20]} />
        <meshStandardMaterial
          color="#3a2414"
          roughness={0.55}
          metalness={0.05}
        />
      </mesh>
      {[-1, 1].map((d) => (
        <mesh key={d} position={[(d * SW * 1.1) / 2, top, 0.005]}>
          <sphereGeometry args={[0.036, 16, 12]} />
          <meshStandardMaterial
            color="#6e4a26"
            roughness={0.4}
            metalness={0.2}
          />
        </mesh>
      ))}
      {cord(-SW * 0.48)}
      {cord(SW * 0.48)}
    </group>
  );
}

function Sheet({
  reduced,
  reserve,
  onSide,
  flip,
  focus,
}: {
  focus: RefObject<number | null>;
  reduced: boolean;
  reserve: { top: number; bottom: number; fill: number };
  onSide: (side: Side) => void;
  flip: RefObject<() => void>;
}) {
  const { gl, scene, camera, size } = useThree();
  const place = useRef<Group>(null);
  const hang = useRef<Group>(null);
  const touch = useRef<PointLight>(null);
  const s = useRef({
    dragging: false,
    yaw: 0,
    pitch: 0,
    velYaw: 0,
    velPitch: 0,
    prevYaw: 0,
    prevPitch: 0,
    release: 0,
    lastX: 0,
    lastY: 0,
    hover: 0,
    over: false,
    flipTo: null as number | null,
    intro: reduced ? 1 : 0,
    side: 'front' as Side,
    mouse: { x: 0, y: 0, tx: 0, ty: 0 },
  });

  const { material, uniforms, front, back } = useMemo(() => {
    const front = paperTexture(sheetCanvas(drawFront));
    const back = paperTexture(sheetCanvas((ctx) => drawBack(ctx, [])));
    const uniforms = {
      uTime: { value: 0 },
      uAmp: { value: 0.34 },
      uFreq: { value: 3.1 },
      uTwist: { value: 1.2 },
      uFlutter: { value: 0.35 },
      uPhase: { value: 0 },
      uSize: { value: new Vector2(SW, SH) },
      uBack: { value: back as Texture },
      uRim: { value: 0.12 },
      uGlow: { value: 0.07 },
      uRimCol: { value: new Color('#ffcf98') },
    };
    const material = new MeshPhysicalMaterial({
      map: front,
      side: DoubleSide,
      roughness: 0.86,
      sheen: 0.34,
      sheenRoughness: 0.9,
      sheenColor: new Color(0xffffff),
      envMapIntensity: 0.22,
      specularIntensity: 0.3,
      transparent: true,
      alphaTest: 0.42,
      opacity: 0,
    });
    // One DoubleSide pass: the two-pass path flips frontFace for the back pass,
    // which would make gl_FrontFacing lie to the face-dependent texture below.
    material.forceSinglePass = true;
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
          '#include <common>\nuniform sampler2D uBack;\nuniform float uRim, uGlow;\nuniform vec3 uRimCol;',
        )
        .replace(
          '#include <map_fragment>',
          `vec4 sampledDiffuseColor = gl_FrontFacing
            ? texture2D( map, vMapUv )
            : texture2D( uBack, vec2( 1.0 - vMapUv.x, vMapUv.y ) );
          diffuseColor *= sampledDiffuseColor;`,
        )
        // Judge the cut against the artwork's own alpha, not alpha * opacity.
        .replace(
          '#include <alphatest_fragment>',
          'if ( diffuseColor.a / max( opacity, 1e-4 ) < alphaTest ) discard;',
        )
        .replace(
          '#include <opaque_fragment>',
          `float fres = pow( 1.0 - clamp( abs( dot( geometryNormal, geometryViewDir ) ), 0.0, 1.0 ), 3.2 );
          outgoingLight += fres * uRim * uRimCol;
          // Lantern light from the room behind comes through the paper.
          outgoingLight += diffuseColor.rgb * uGlow * uRimCol;
          gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,
        );
    };
    return { material, uniforms, front, back };
  }, []);
  const halo = useMemo(haloTexture, []);

  // The roster side waits for its five sketches.
  useEffect(() => {
    let alive = true;
    const images = TEAM.map((m) => {
      const img = new Image();
      img.src = m.portrait;
      return img;
    });
    Promise.all(images.map((img) => img.decode().catch(() => undefined))).then(
      () => {
        if (!alive) return;
        const canvas = back.image as HTMLCanvasElement;
        const ctx = canvas.getContext('2d')!;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        const fresh = sheetCanvas((c) => drawBack(c, images));
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(fresh, 0, 0);
        back.needsUpdate = true;
      },
    );
    return () => {
      alive = false;
    };
  }, [back]);

  useEffect(() => {
    const pmrem = new PMREMGenerator(gl);
    const source = envTexture();
    const env = pmrem.fromEquirectangular(source).texture;
    scene.environment = env;
    return () => {
      scene.environment = null;
      env.dispose();
      source.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);

  useEffect(
    () => () => {
      material.dispose();
      front.dispose();
      back.dispose();
      halo.dispose();
      gl.domElement.style.cursor = '';
    },
    [material, front, back, halo, gl],
  );

  useEffect(() => {
    flip.current = () => {
      const st = s.current;
      const base = Math.round(st.yaw / Math.PI) * Math.PI;
      const to = base + (Math.cos(st.yaw) >= 0 ? Math.PI : -Math.PI);
      if (reduced) st.yaw = to;
      else st.flipTo = to;
      st.velYaw = 0;
    };
  }, [flip, reduced]);

  useEffect(() => {
    const el = gl.domElement;
    const move = (e: PointerEvent) => {
      const st = s.current;
      const r = el.getBoundingClientRect();
      st.mouse.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      st.mouse.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
      if (!st.dragging) return;
      const dx = e.clientX - st.lastX;
      const dy = e.clientY - st.lastY;
      st.lastX = e.clientX;
      st.lastY = e.clientY;
      st.yaw += dx * 0.0068;
      st.pitch = clamp(st.pitch - dy * 0.004, -0.45, 0.45);
    };
    const up = () => {
      const st = s.current;
      if (!st.dragging) return;
      st.dragging = false;
      st.release = 0.6;
    };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [gl]);

  const lightPos = useMemo(() => new Vector3(), []);
  const lightAim = useMemo(() => new Vector3(), []);
  useFrame((state, delta) => {
    const g = hang.current;
    const p = place.current;
    if (!g || !p) return;
    const st = s.current;
    const dt = Math.min(delta, 0.05);
    const t = state.clock.elapsedTime;
    uniforms.uTime.value = reduced ? 2.4 : t;

    st.intro += (1 - st.intro) * Math.min(1, dt * 1.7);
    material.opacity = st.intro;

    if (st.dragging) {
      const k = Math.min(1, dt * 14);
      st.velYaw += ((st.yaw - st.prevYaw) / Math.max(dt, 1e-3) - st.velYaw) * k;
      st.velPitch +=
        ((st.pitch - st.prevPitch) / Math.max(dt, 1e-3) - st.velPitch) * k;
      st.velYaw = clamp(st.velYaw, -7, 7);
      st.velPitch = clamp(st.velPitch, -4, 4);
    } else if (st.flipTo !== null) {
      st.yaw += (st.flipTo - st.yaw) * Math.min(1, dt * 3.2);
      st.pitch -= st.pitch * Math.min(1, dt * 3);
      if (Math.abs(st.flipTo - st.yaw) < 0.002) {
        st.yaw = st.flipTo;
        st.flipTo = null;
      }
    } else {
      st.yaw += st.velYaw * dt;
      st.pitch = clamp(st.pitch + st.velPitch * dt, -0.45, 0.45);
      const decay = Math.pow(0.018, dt);
      st.velYaw *= decay;
      st.velPitch *= decay;
      st.release = Math.max(0, st.release - dt);
      if (st.release <= 0) {
        // Settle on whichever face is nearer, rather than unwinding the spin.
        const home = Math.round(st.yaw / Math.PI) * Math.PI;
        const k = Math.min(1, dt * 0.9);
        st.yaw += (home - st.yaw) * k;
        st.pitch -= st.pitch * k;
      }
    }
    st.prevYaw = st.yaw;
    st.prevPitch = st.pitch;
    const side: Side = Math.cos(st.yaw) >= 0 ? 'front' : 'back';
    if (side !== st.side) {
      st.side = side;
      onSide(side);
    }

    st.mouse.x += (st.mouse.tx - st.mouse.x) * Math.min(1, dt * 3);
    st.mouse.y += (st.mouse.ty - st.mouse.y) * Math.min(1, dt * 3);
    const idle = reduced ? 0 : 1;
    const rise = 1 - st.intro;
    const visH =
      2 * CAM_Z * Math.tan(((camera as PerspectiveCamera).fov * Math.PI) / 360);
    const visW = visH * (size.width / size.height);
    const top = reserve.top / size.height;
    const bottom = reserve.bottom / size.height;
    const scale = Math.min(
      (visH * (1 - top - bottom) * reserve.fill) / SH,
      (visW * 0.84) / SW,
    );
    p.scale.setScalar(scale);
    g.rotation.y =
      st.yaw + st.mouse.x * 0.14 + Math.sin(t * 0.23) * 0.05 * idle;
    g.rotation.x =
      st.pitch - st.mouse.y * 0.06 + Math.sin(t * 0.19) * 0.02 * idle;
    g.rotation.z = Math.sin(t * 0.27) * 0.012 * idle;
    p.position.set(
      Math.sin(t * 0.21) * 0.03 * idle + st.mouse.x * 0.06,
      (visH * (bottom - top)) / 2 + rise * 0.5 * scale,
      0,
    );

    const f = focus.current;
    const lit = st.over || st.dragging || f !== null;
    st.hover += ((lit ? 1 : 0) - st.hover) * Math.min(1, dt * 4.5);
    const light = touch.current;
    if (light) {
      // A named signer gets a close, tight pool; the cursor a broad lamp.
      light.intensity = st.hover * (f !== null ? 3.4 : 3.2) * st.intro;
      light.distance = f !== null ? 2.4 : 7.5;
      light.decay = f !== null ? 2 : 1.35;
      if (f !== null) {
        // Light the named signer: their signature, or their roster row.
        const back = st.side === 'back';
        const [x, y] = back ? ROSTER_ROW(f) : SIGN_SLOTS[f];
        const u = x / TW - 0.5;
        lightAim.set(
          (back ? -u : u) * SW,
          (0.5 - y / TH) * SH,
          back ? -0.32 : 0.32,
        );
        g.localToWorld(lightAim);
        light.position.lerp(lightAim, Math.min(1, dt * 7));
      } else if (st.hover > 0.002) {
        lightPos
          .set(st.mouse.tx, -st.mouse.ty, 0.5)
          .unproject(camera)
          .sub(camera.position)
          .normalize();
        lightAim
          .copy(camera.position)
          .addScaledVector(lightPos, (1.75 - camera.position.z) / lightPos.z);
        light.position.lerp(lightAim, Math.min(1, dt * 14));
      }
    }
    const cursor = st.dragging ? 'grabbing' : st.over ? 'grab' : '';
    if (gl.domElement.style.cursor !== cursor)
      gl.domElement.style.cursor = cursor;
  });

  return (
    <>
      <ambientLight color="#b9a6c9" intensity={0.5} />
      <directionalLight
        color="#ffd6a0"
        position={[-3.3, 2.1, 2.0]}
        intensity={2.6}
      />
      <directionalLight
        color="#ffcf9a"
        position={[3.6, 0.6, 1.8]}
        intensity={0.9}
      />
      <directionalLight
        color="#ffb070"
        position={[0.4, 1.2, -2.6]}
        intensity={1.2}
      />
      <pointLight
        ref={touch}
        color="#ffd9a8"
        intensity={0}
        distance={7.5}
        decay={1.35}
      />
      <group ref={place}>
        <mesh position={[0, 0, -0.6]}>
          <planeGeometry args={[SW * 1.7, SH * 1.7]} />
          <meshBasicMaterial
            map={halo}
            transparent
            depthWrite={false}
            opacity={0.5}
          />
        </mesh>
        <group ref={hang}>
          <Hanger />
          <mesh
            material={material}
            onPointerOver={() => (s.current.over = true)}
            onPointerOut={() => (s.current.over = false)}
            onPointerDown={(e) => {
              const st = s.current;
              e.stopPropagation();
              st.dragging = true;
              st.flipTo = null;
              st.lastX = e.nativeEvent.clientX;
              st.lastY = e.nativeEvent.clientY;
              st.velYaw = st.velPitch = 0;
              st.prevYaw = st.yaw;
              st.prevPitch = st.pitch;
            }}
          >
            <planeGeometry args={[SW, SH, 72, 96]} />
          </mesh>
        </group>
      </group>
    </>
  );
}

export function Invitation({ reduced }: { reduced: boolean }) {
  const [side, setSide] = useState<Side>('front');
  const [wide, setWide] = useState(true);
  const flip = useRef<() => void>(() => {});
  const focus = useRef<number | null>(null);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1000px)');
    const apply = () => setWide(media.matches);
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);
  return (
    <div className="inv" data-side={side}>
      <Canvas
        className="inv-canvas"
        flat
        dpr={[1, 2]}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
        }}
        camera={{ fov: FOV, position: [0, 0, CAM_Z], near: 0.1, far: 100 }}
      >
        <Sheet
          reduced={reduced}
          reserve={wide ? WIDE_RESERVE : NARROW_RESERVE}
          onSide={setSide}
          flip={flip}
          focus={focus}
        />
        <group scale={0.3} position={[0, 0, 0.4]}>
          <SakuraPetals count={34} size={1.8} seed={0x3d29} reduced={reduced} />
        </group>
      </Canvas>

      <aside className="inv-signers" aria-label="The team on X">
        <p className="inv-label">Signed at the door</p>
        <ul>
          {TEAM.map((member, i) => (
            <li
              key={member.handle}
              onPointerEnter={() => (focus.current = i)}
              onPointerLeave={() => (focus.current = null)}
              onFocus={() => (focus.current = i)}
              onBlur={() => (focus.current = null)}
            >
              <a href={xUrl(member.handle)} target="_blank" rel="noreferrer">
                <span>@{member.handle}</span>
                <small>{member.roles}</small>
              </a>
            </li>
          ))}
        </ul>
      </aside>

      <div className="inv-turn">
        <button
          type="button"
          className="inv-flip"
          onClick={() => flip.current()}
          aria-pressed={side === 'back'}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 12a8 8 0 0 1 13.7-5.6M20 12a8 8 0 0 1-13.7 5.6" />
            <path d="M17.7 2.8v3.6h-3.6M6.3 21.2v-3.6h3.6" />
          </svg>
          {side === 'front' ? 'Turn it over' : 'Back to the charter'}
        </button>
        <p className="inv-hint" aria-hidden="true">
          <span className="on-mouse">Drag to turn · Hover to light</span>
          <span className="on-touch">Drag the sheet to turn it</span>
        </p>
        <p className="inv-honesty">{PROJECT.honesty}</p>
      </div>

      <div className="sr-only" aria-live="polite">
        {side === 'front' ? (
          <>
            <h1>{PROJECT.name}</h1>
            <p>{PROJECT.tagline}</p>
            <p>{PROJECT.summary}</p>
            <p>{PROJECT.honesty}</p>
          </>
        ) : (
          <>
            <h2>The team</h2>
            <ul>
              {TEAM.map((m) => (
                <li key={m.handle}>
                  {m.handle}, {m.roles}. {m.bio}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
