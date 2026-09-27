import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import {
  AdditiveBlending,
  BackSide,
  Box3,
  Color,
  MathUtils,
  Mesh,
  Quaternion,
  ShaderMaterial,
  Vector2,
  Vector3,
  type Group,
  type InstancedMesh,
  type MeshStandardMaterial,
  type PerspectiveCamera,
  type Texture,
} from 'three';
import type { Station } from '../shared/contracts';
import { InkLine, STATION_TEASERS } from '../ui/stationTeasers';
import { LOOK, STATIONS, wallBetween, type Point } from './stations';

/** The ember quad and its hit disc, in CSS pixels; the lit core itself reads about 20 px. */
const QUAD_PX = 56,
  HIT_PX = 34;
const WARM = new Color('#ffb45e');

const QUAD_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
// Pixel-space ember: a crisp hot core, a thin ring that opens on hover, a slow pulse and three sparks.
const EMBER_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uHover;
uniform float uActive;
uniform float uOpacity;
uniform float uMotion;
varying vec2 vUv;
float disc(float d, float radius) { return 1.0 - smoothstep(radius - 0.75, radius + 0.75, d); }
float band(float d, float radius, float width) {
  return 1.0 - smoothstep(width * 0.5 - 0.5, width * 0.5 + 0.5, abs(d - radius));
}
void main() {
  vec2 p = (vUv - 0.5) * ${QUAD_PX.toFixed(1)};
  float r = length(p);
  float breath = 0.5 + 0.5 * sin(uTime * 2.1) * uMotion;
  float core = disc(r, 3.3 + 0.7 * uActive);
  float glow = exp(-r * r / 50.0) * (0.5 + 0.25 * breath);
  float ring = band(r, mix(8.5, 11.0, uHover), 1.2) * (0.22 + 0.3 * uActive + 0.45 * uHover);
  float t = fract(uTime * 0.4);
  float pulse = band(r, 8.0 + t * 13.0, 1.4) * (1.0 - t) * (1.0 - t) * 0.4 * uMotion;
  float sparks = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float cycle = uTime * (0.23 + fi * 0.06) + fi * 0.41;
    float life = fract(cycle);
    float angle = fi * 2.09 + floor(cycle) * 2.4;
    vec2 at = vec2(cos(angle), sin(angle)) * (6.0 + life * 9.0) + vec2(0.0, life * 6.0);
    sparks += disc(length(p - at), 0.85) * sin(life * 3.14159) * 0.5;
  }
  vec3 hot = vec3(1.0, 0.92, 0.74), ember = vec3(1.0, 0.6, 0.24);
  vec3 color = hot * core + ember * (glow + ring + pulse) + mix(ember, hot, 0.4) * sparks * uMotion;
  gl_FragColor = vec4(color, uOpacity);
}`;
// Inverted hull pushed out a fixed number of pixels, so the warm line is crisp at any distance.
const HULL_VERTEX = /* glsl */ `
uniform vec2 uSize;
uniform float uThickness;
void main() {
  vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vec2 dir = (projectionMatrix * vec4(normalMatrix * normal, 0.0)).xy;
  clip.xy += normalize(dir + vec2(1e-5)) * uThickness / uSize * clip.w * 2.0;
  gl_Position = clip;
}`;
const FLAT_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
void main() { gl_FragColor = vec4(uColor, uOpacity); }`;
// Cut-out art (the host diorama) has no closed hull: dilate its alpha instead.
const CUTOUT_FRAGMENT = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 uColor;
uniform float uOpacity;
varying vec2 vUv;
void main() {
  float a = 0.0;
  for (int i = 0; i < 12; i++) {
    float angle = float(i) * 0.5236;
    a = max(a, texture2D(uMap, vUv + vec2(cos(angle), sin(angle)) * 0.005).a);
  }
  gl_FragColor = vec4(uColor, a * uOpacity);
}`;

const world = new Vector3(),
  lifted = new Vector3(),
  view = new Vector3(),
  worldScale = new Vector3(),
  facing = new Quaternion();

/** A small ember that marks something to open or inspect. Keep these props stable for other lanes. */
export function HaloMarker({
  position,
  label,
  active,
  reduced,
  onClick,
  detail,
  onHover,
}: {
  position: Point;
  label: string;
  active: boolean;
  reduced: boolean;
  onClick?: () => void;
  /** Longer line shown beside the active marker, with its seal glyph. */
  detail?: { glyph: string; text: string };
  onHover?: (hovered: boolean) => void;
}) {
  const root = useRef<Group>(null),
    face = useRef<Group>(null);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: QUAD_VERTEX,
        fragmentShader: EMBER_FRAGMENT,
        uniforms: {
          uTime: { value: 0 },
          uHover: { value: 0 },
          uActive: { value: 0 },
          uOpacity: { value: 0 },
          uMotion: { value: 1 },
        },
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: AdditiveBlending,
        toneMapped: false,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);
  const [hovered, setHovered] = useState(false);
  const [hidden, setHidden] = useState(false);
  const live = useRef({ hidden: false, opacity: 0, hover: 0 });
  const hoverRef = useRef({ on: false, notify: onHover });
  useEffect(() => {
    hoverRef.current.notify = onHover;
  });
  const hover = (on: boolean) => {
    if (hoverRef.current.on === on) return;
    hoverRef.current.on = on;
    setHovered(on);
    hoverRef.current.notify?.(on);
    if (onClick || !on) document.body.style.cursor = on ? 'pointer' : '';
  };
  useEffect(
    () => () => {
      if (!hoverRef.current.on) return;
      hoverRef.current.notify?.(false);
      document.body.style.cursor = '';
    },
    [],
  );
  useFrame(({ camera, size, clock }, delta) => {
    const g = root.current,
      f = face.current,
      s = live.current;
    if (!g || !f) return;
    g.getWorldPosition(world);
    const distance = world.distanceTo(camera.position);
    // Hide inside the marker, and behind the partition wall (a segment test against the room box).
    const blocked = distance < 0.35 || wallBetween(world, camera.position);
    if (blocked !== s.hidden) {
      s.hidden = blocked;
      setHidden(blocked);
      if (blocked) hover(false);
    }
    // Slide the ember toward the camera on its own sight line: same pixel, but it now wins
    // R3F's nearest-first raycast over the prop it marks.
    lifted
      .copy(camera.position)
      .sub(world)
      .setLength(Math.min(0.35, distance * 0.3))
      .add(world);
    // Constant screen size: world units per CSS pixel at this depth.
    const depth = Math.max(
      0.05,
      -view.copy(lifted).applyMatrix4(camera.matrixWorldInverse).z,
    );
    f.position.copy(g.worldToLocal(lifted));
    const fov = MathUtils.degToRad((camera as PerspectiveCamera).fov ?? 50);
    g.getWorldScale(worldScale);
    f.scale.setScalar(
      (2 * depth * Math.tan(fov / 2)) / size.height / worldScale.x,
    );
    f.quaternion.copy(
      g.getWorldQuaternion(facing).invert().multiply(camera.quaternion),
    );
    const fade = blocked ? 0 : 1 - MathUtils.smoothstep(distance, 4, 12) * 0.65;
    s.opacity += (fade - s.opacity) * (reduced ? 1 : Math.min(1, delta * 6));
    s.hover +=
      ((hovered ? 1 : 0) - s.hover) * (reduced ? 1 : Math.min(1, delta * 10));
    f.visible = s.opacity > 0.01;
    const u = material.uniforms;
    u.uOpacity.value = s.opacity;
    u.uHover.value = s.hover;
    u.uActive.value = active ? 1 : 0;
    u.uMotion.value = reduced ? 0 : 1;
    if (!reduced) u.uTime.value = clock.elapsedTime;
  });
  const showDetail = active && detail;
  return (
    <group ref={root} position={position}>
      <group ref={face}>
        <mesh material={material} renderOrder={20} raycast={() => null}>
          <planeGeometry args={[QUAD_PX, QUAD_PX]} />
        </mesh>
        <mesh
          userData={{ halo: true }}
          onPointerOver={(event) => {
            if (live.current.hidden) return;
            event.stopPropagation();
            hover(true);
          }}
          onPointerOut={() => hover(false)}
          onClick={(event) => {
            if (live.current.hidden || !onClick || event.delta > LOOK.dragPx)
              return;
            event.stopPropagation();
            hover(false);
            onClick();
          }}
        >
          <circleGeometry args={[HIT_PX / 2, 24]} />
          <meshBasicMaterial
            transparent
            opacity={0}
            depthTest={false}
            depthWrite={false}
            colorWrite={false}
          />
        </mesh>
      </group>
      {!hidden && (hovered || showDetail) && (
        <Html
          zIndexRange={[6, 0]}
          wrapperClass={showDetail ? 'halo-label-wrap' : 'halo-tag-wrap'}
          pointerEvents="none"
        >
          {showDetail ? (
            <div className="halo-label" aria-hidden="true">
              <span className="halo-label-seal">{detail.glyph}</span>
              <InkLine text={detail.text} className="halo-label-text" />
            </div>
          ) : (
            <div className="halo-tag" aria-hidden="true">
              <InkLine text={label} className="halo-tag-text" />
            </div>
          )}
        </Html>
      )}
    </group>
  );
}

type OutlineTarget = { name: string; within?: [Point, Point] };

/** Warm line around a prop while its marker is hovered. Attaches shells to the prop's largest meshes. */
function WarmOutline({
  name,
  within,
  reduced,
}: OutlineTarget & { reduced: boolean }) {
  const scene = useThree((state) => state.scene),
    gl = useThree((state) => state.gl);
  const shells = useRef<ShaderMaterial[]>([]);
  useEffect(() => {
    const root = scene.getObjectByName(name);
    if (!root) return;
    root.updateWorldMatrix(true, true);
    const box =
      within && new Box3(new Vector3(...within[0]), new Vector3(...within[1]));
    const bounds = new Box3(),
      extent = new Vector3();
    const picked: { mesh: Mesh; size: number; cutout: Texture | null }[] = [];
    root.traverse((object) => {
      const mesh = object as Mesh;
      if (
        !mesh.isMesh ||
        !mesh.visible ||
        (mesh as InstancedMesh).isInstancedMesh
      )
        return;
      const material = (
        Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
      ) as MeshStandardMaterial;
      const cutout =
        material.map && material.alphaTest > 0 ? material.map : null;
      if (material.transparent && !cutout) return;
      bounds.setFromObject(mesh);
      if (box && !box.containsBox(bounds)) return;
      bounds.getSize(extent);
      if (!cutout && Math.min(extent.x, extent.y, extent.z) < 0.004) return;
      picked.push({ mesh, size: extent.length(), cutout });
    });
    // ponytail: the 48 largest meshes carry the silhouette; raise it if small parts go unlined.
    picked.sort((a, b) => b.size - a.size);
    const hull = new ShaderMaterial({
      vertexShader: HULL_VERTEX,
      fragmentShader: FLAT_FRAGMENT,
      uniforms: {
        uColor: { value: WARM },
        uOpacity: { value: 0 },
        uSize: { value: new Vector2(1, 1) },
        uThickness: { value: 2 },
      },
      side: BackSide,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    const materials = [hull];
    const added = picked.slice(0, 48).map(({ mesh, cutout }) => {
      let shell: Mesh;
      if (cutout) {
        const glow = new ShaderMaterial({
          vertexShader: QUAD_VERTEX,
          fragmentShader: CUTOUT_FRAGMENT,
          uniforms: {
            uMap: { value: cutout },
            uColor: { value: WARM },
            uOpacity: { value: 0 },
          },
          transparent: true,
          depthWrite: false,
          toneMapped: false,
        });
        materials.push(glow);
        shell = new Mesh(mesh.geometry, glow);
        shell.position.z = -0.012;
        shell.scale.setScalar(1.025);
      } else shell = new Mesh(mesh.geometry, hull);
      shell.raycast = () => null;
      mesh.add(shell);
      return shell;
    });
    shells.current = materials;
    return () => {
      added.forEach((shell) => shell.removeFromParent());
      materials.forEach((material) => material.dispose());
      shells.current = [];
    };
  }, [scene, name, within]);
  const drawing = useMemo(() => new Vector2(), []);
  useFrame((_, delta) => {
    gl.getDrawingBufferSize(drawing);
    for (const material of shells.current) {
      const u = material.uniforms;
      u.uOpacity.value +=
        (0.85 - u.uOpacity.value) * (reduced ? 1 : Math.min(1, delta * 8));
      u.uSize?.value.copy(drawing);
      if (u.uThickness) u.uThickness.value = 2 * gl.getPixelRatio();
    }
  });
  return null;
}

const HALO_STATIONS = ['Counter', 'AvatarSeat', 'TeaTable', 'Shelf'] as const;
type HaloStation = (typeof HALO_STATIONS)[number];
const OUTLINES: Record<HaloStation, OutlineTarget> = {
  Counter: {
    name: 'waiting-counter-room',
    within: [
      [-4.0, 0, 5.4],
      [-0.4, 1.95, 6.8],
    ],
  },
  AvatarSeat: { name: 'tea-host-3d' },
  TeaTable: { name: 'mechanical-planetary-system' },
  Shelf: { name: 'right-wall-tea-shelf' },
};

/** True once the camera has rested at `station`; real travel clears it, a small drag does not. */
function useSettled(station: Station) {
  const [settledAt, setSettledAt] = useState<Station | null>(null);
  const motion = useRef({
    last: new Vector3(),
    still: 0,
    station,
    settled: false,
  });
  useFrame(({ camera }, delta) => {
    const m = motion.current,
      dt = Math.max(delta, 1e-3),
      speed = camera.position.distanceTo(m.last) / dt;
    m.last.copy(camera.position);
    if (m.station !== station) {
      m.station = station;
      m.still = 0;
      m.settled = false;
      setSettledAt(null);
    }
    if (m.settled && speed > 2) {
      m.settled = false;
      m.still = 0;
      setSettledAt(null);
    } else if (!m.settled) {
      m.still = speed < 0.08 ? m.still + dt : 0;
      if (m.still > 0.3) {
        m.settled = true;
        setSettledAt(station);
      }
    }
  });
  return settledAt === station;
}

/** One ember per place worth opening. Another station's ember flies there; the current one opens it. */
export function StationHalos({
  station,
  menuClosed,
  reduced,
  onNavigate,
  onMenuOpen,
  onShelfSelect,
}: {
  station: Station;
  menuClosed: boolean;
  reduced: boolean;
  onNavigate: (station: Station) => void;
  onMenuOpen: () => void;
  onShelfSelect: () => void;
}) {
  const settled = useSettled(station);
  const [hovered, setHovered] = useState<HaloStation | null>(null);
  if (station === 'Entrance') return null;
  return (
    <>
      {HALO_STATIONS.map((id) => {
        const current = id === station;
        if (current && !menuClosed) return null;
        const anchor = STATIONS.find((place) => place.id === id)!;
        // The Observatorium has no panel: its ember points at the orrery's own click-to-wind.
        const open = !current
          ? () => onNavigate(id)
          : id === 'Shelf'
            ? onShelfSelect
            : id === 'TeaTable'
              ? undefined
              : onMenuOpen;
        return (
          <HaloMarker
            key={id}
            position={anchor.hotspot}
            label={anchor.label}
            active={current}
            reduced={reduced}
            onClick={open}
            detail={current && settled ? STATION_TEASERS[id] : undefined}
            onHover={(on) =>
              setHovered((was) => (on ? id : was === id ? null : was))
            }
          />
        );
      })}
      {hovered && (
        <WarmOutline key={hovered} {...OUTLINES[hovered]} reduced={reduced} />
      )}
    </>
  );
}
