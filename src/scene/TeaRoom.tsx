import {
  Component,
  Suspense,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import {
  Billboard,
  ContactShadows,
  Html,
  useProgress,
} from '@react-three/drei';
import { AdditiveBlending, Color, ShaderMaterial, Vector3 } from 'three';
import { InkLine, STATION_TEASERS } from '../ui/stationTeasers';
import { CameraRig } from './CameraRig';
import { TeaRitual, LanternLight } from './TeaRitual';
import { MechanicalPlanetarySystem } from './MechanicalPlanetarySystem';
import { TeaHost3D, type IrohActivity } from './TeaHost3D';
import { TeaShelf } from './TeaShelf';
import { TeaChamber, WaitingRoom } from './TeaArchitecture';
import { STATIONS } from './stations';
import { Surfaces } from './Surfaces';
import { DevShotCamera } from './DevShotCamera';
import { SceneEffects } from './SceneEffects';
import { ThesisCards } from './props/ThesisCards';
import type { SceneMood } from './motion/dynamics';
import type { Station } from '../shared/contracts';
import type { ThesisId } from '../thesis/types';

const HALO_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
// A golden ring of incense smoke: a noisy ring, soft glow, drifting wisps, and an inviting ripple.
const HALO_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
uniform float uRipple;
uniform vec3 uColor;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
void main() {
  vec2 p = vUv - 0.5;
  float r = length(p) * 2.0;
  float a = atan(p.y, p.x) / 6.2831853 + 0.5;
  float n = noise(vec2(a * 9.0 + uTime * 0.35, uTime * 0.22));
  float n2 = noise(vec2(a * 17.0 - uTime * 0.6, r * 5.0 - uTime * 0.5));
  float ringR = 0.42 + (n - 0.5) * 0.07;
  float ring = exp(-pow((r - ringR) / (0.03 + n2 * 0.035), 2.0));
  float halo = exp(-pow((r - ringR) / 0.17, 2.0)) * 0.32;
  float core = exp(-r * r * 9.0) * 0.22;
  float wisps = smoothstep(0.58, 0.95, n2) * exp(-pow((r - ringR - 0.14) / 0.12, 2.0)) * 0.55;
  float t = fract(uTime * 0.42);
  float ripple = exp(-pow((r - (0.42 + t * 0.5)) / 0.025, 2.0)) * (1.0 - t) * 0.6 * uRipple;
  float alpha = (ring + halo + core + wisps + ripple) * smoothstep(1.0, 0.8, r) * uOpacity;
  gl_FragColor = vec4(uColor * (0.6 + ring * 0.5), clamp(alpha * 0.85, 0.0, 1.0));
}`;

function StationMenuHalo({
  station,
  reduced,
  onOpen,
}: {
  station: Station;
  reduced: boolean;
  onOpen: () => void;
}) {
  const anchor = STATIONS.find((place) => place.id === station)!;
  const teaser = STATION_TEASERS[station];
  // The Observatorium has no panel: its halo only points at the orrery's own click-to-wind.
  const clickable = station !== 'TeaTable';
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: HALO_VERTEX,
        fragmentShader: HALO_FRAGMENT,
        uniforms: {
          uTime: { value: 0 },
          uOpacity: { value: 0 },
          uRipple: { value: reduced ? 0 : 1 },
          uColor: { value: new Color('#f3c579') },
        },
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [reduced],
  );
  useEffect(() => () => material.dispose(), [material]);
  // Show the label only once the camera rests at this station, never mid-travel.
  const [settledAt, setSettledAt] = useState<Station | null>(null);
  const [shownFor, setShownFor] = useState(station);
  if (shownFor !== station) {
    setShownFor(station);
    setSettledAt(null);
  }
  const motion = useRef({
    last: new Vector3(),
    still: 0,
    station,
    settled: false,
  });
  const settled = settledAt === station;
  useFrame(({ camera, clock }, delta) => {
    const m = motion.current;
    const dt = Math.max(delta, 1e-3);
    const speed = camera.position.distanceTo(m.last) / dt;
    m.last.copy(camera.position);
    if (m.station !== station) {
      m.station = station;
      m.still = 0;
      m.settled = false;
    }
    // Hysteresis: small orbit drags keep the label; real travel hides it.
    if (m.settled && speed > 0.8) {
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
    const u = material.uniforms;
    if (!reduced) u.uTime.value = clock.elapsedTime;
    const goal = m.settled ? 1 : 0;
    u.uOpacity.value = reduced
      ? goal
      : u.uOpacity.value + (goal - u.uOpacity.value) * Math.min(1, dt * 5);
  });
  const handlers = clickable
    ? {
        onClick: (event: ThreeEvent<MouseEvent>) => {
          event.stopPropagation();
          onOpen();
        },
        onPointerOver: (event: ThreeEvent<PointerEvent>) => {
          event.stopPropagation();
          document.body.style.cursor = 'pointer';
        },
        onPointerOut: () => {
          document.body.style.cursor = '';
        },
      }
    : {};
  return (
    <group position={anchor.hotspot} name={`${station}-menu-halo`}>
      <pointLight
        color="#f3c579"
        intensity={settled ? (reduced ? 0.55 : 0.9) : 0}
        distance={2.5}
      />
      <Billboard follow>
        <group {...handlers}>
          <mesh material={material} renderOrder={10}>
            <planeGeometry args={[0.72, 0.72]} />
          </mesh>
          <mesh>
            <circleGeometry args={[0.24, 32]} />
            <meshBasicMaterial
              transparent
              opacity={0}
              depthTest={false}
              depthWrite={false}
            />
          </mesh>
        </group>
      </Billboard>
      {settled && teaser && (
        <Html
          // Shelf: sit above the top bay so the three hanging papers stay clear.
          position={station === 'Shelf' ? [-0.15, 1.72, 0] : [0, 0.3, 0]}
          center
          zIndexRange={[6, 0]}
          wrapperClass="halo-label-wrap"
          pointerEvents={clickable ? 'auto' : 'none'}
        >
          <div
            className="halo-label"
            aria-hidden="true"
            tabIndex={-1}
            data-clickable={clickable}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              if (clickable) onOpen();
            }}
          >
            <span className="halo-label-seal">{teaser.glyph}</span>
            <InkLine text={teaser.text} className="halo-label-text" />
          </div>
        </Html>
      )}
    </group>
  );
}

function RoomGeometry({
  mood,
  reduced,
  requestKey,
  irohActivity,
  onShelfSelect,
  shelfRevealed,
  station,
  menuClosed,
  onMenuOpen,
  onThesisPick,
}: {
  mood: SceneMood;
  reduced: boolean;
  requestKey: string | null;
  irohActivity: IrohActivity;
  onShelfSelect: () => void;
  shelfRevealed: boolean;
  station: Station;
  menuClosed: boolean;
  onMenuOpen: () => void;
  onThesisPick?: (id: ThesisId) => void;
}) {
  return (
    <>
      <color attach="background" args={['#2f2119']} />
      <hemisphereLight args={['#c9c0b6', '#5a3b25', 0.3]} />
      <directionalLight
        position={[-5, 6, -4]}
        color="#ffb877"
        intensity={2.1}
        castShadow
        shadow-bias={-0.00035}
        shadow-normalBias={0.025}
        shadow-mapSize={[2048, 2048]}
        shadow-radius={3}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
      />
      <directionalLight
        position={[3, 3.8, 2.5]}
        color="#b8c2d6"
        intensity={0.32}
      />
      <pointLight
        position={[1.1, 1.75, -0.7]}
        color="#f5dcc0"
        intensity={1}
        distance={5.3}
      />
      <pointLight
        position={[0.55, 2.3, -4.75]}
        color="#ffc27a"
        intensity={2.4}
        distance={3.2}
      />
      <WaitingRoom />
      <ThesisCards
        halos={station === 'Counter' && menuClosed}
        reduced={reduced}
        onPick={onThesisPick}
      />
      <TeaChamber reduced={reduced}>
        <ContactShadows
          position={[0, 0.016, -2.55]}
          opacity={0.3}
          scale={5.7}
          blur={2.4}
          far={1.6}
          resolution={256}
          frames={1}
          color="#25180f"
        />
        <LanternLight mood={mood} reduced={reduced} />
        <TeaRitual mood={mood} reduced={reduced} requestKey={requestKey} />
        <MechanicalPlanetarySystem reduced={reduced} />
        <Suspense fallback={null}>
          <TeaHost3D reduced={reduced} activity={irohActivity} />
        </Suspense>
        <TeaShelf
          onSelect={onShelfSelect}
          revealed={shelfRevealed}
          reduced={reduced}
        />
        {menuClosed && (
          <StationMenuHalo
            station={station}
            reduced={reduced}
            onOpen={onMenuOpen}
          />
        )}
      </TeaChamber>
    </>
  );
}

class SceneBoundary extends Component<
  { children: ReactNode; fallback: ReactNode; onUnavailable: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onUnavailable();
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export default function TeaRoom({
  station,
  reduced,
  resetKey,
  typing,
  reading,
  allowTravelWhileTyping,
  mood,
  requestKey,
  irohActivity,
  onArrive,
  onAvailabilityChange,
  onLoadProgress,
  onShelfSelect,
  shelfFocused,
  shelfRevealed,
  menuClosed,
  onMenuOpen,
  onThesisPick,
}: {
  station: Station;
  reduced: boolean;
  resetKey: number;
  typing: boolean;
  reading: boolean;
  allowTravelWhileTyping: boolean;
  mood: SceneMood;
  requestKey: string | null;
  irohActivity: IrohActivity;
  onArrive: (station: Station) => void;
  onAvailabilityChange: (available: boolean) => void;
  onLoadProgress?: (active: boolean, progress: number) => void;
  onShelfSelect: () => void;
  shelfFocused: boolean;
  shelfRevealed: boolean;
  menuClosed: boolean;
  onMenuOpen: () => void;
  onThesisPick?: (id: ThesisId) => void;
}) {
  const [lost, setLost] = useState(false);
  // Textures load through three's default manager, which useProgress observes.
  const { active, progress } = useProgress();
  useEffect(() => {
    onLoadProgress?.(active, progress);
  }, [active, progress, onLoadProgress]);
  const initialMobile =
    typeof window !== 'undefined' && window.innerWidth < 760;
  const counterPosition = STATIONS.find(
    (place) => place.id === 'Counter',
  )!.position;
  const fallback = (
    <div className="scene-fallback">
      <span className="fallback-cup">♧</span>
      <p>The room is resting.</p>
      <small>The full ritual is available through the station controls.</small>
    </div>
  );
  if (lost) return fallback;
  return (
    <SceneBoundary
      fallback={fallback}
      onUnavailable={() => onAvailabilityChange(false)}
    >
      <Canvas
        shadows="percentage"
        dpr={[1, 1.5]}
        camera={{
          position: initialMobile ? [0.05, 1.66, 7.82] : counterPosition,
          fov: 58,
          near: 0.08,
          far: 45,
        }}
        gl={{ antialias: true, toneMappingExposure: 1.0 }}
        fallback={fallback}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener(
            'webglcontextlost',
            (event) => {
              event.preventDefault();
              setLost(true);
              onAvailabilityChange(false);
            },
            { once: true },
          );
          onAvailabilityChange(true);
        }}
      >
        <Surfaces>
          <RoomGeometry
            mood={mood}
            reduced={reduced}
            requestKey={requestKey}
            irohActivity={irohActivity}
            onShelfSelect={onShelfSelect}
            shelfRevealed={shelfRevealed}
            station={station}
            menuClosed={menuClosed}
            onMenuOpen={onMenuOpen}
            onThesisPick={onThesisPick}
          />
        </Surfaces>
        <CameraRig
          station={station}
          shelfFocused={shelfFocused}
          reduced={reduced}
          resetKey={resetKey}
          typing={typing}
          reading={reading}
          allowTravelWhileTyping={allowTravelWhileTyping}
          onArrive={onArrive}
        />
        <DevShotCamera />
        <SceneEffects reduced={reduced} />
      </Canvas>
    </SceneBoundary>
  );
}
