import {
  Component,
  Suspense,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Billboard, ContactShadows, useProgress } from '@react-three/drei';
import type { Group } from 'three';
import { CameraRig } from './CameraRig';
import { TeaRitual, LanternLight } from './TeaRitual';
import { MechanicalPlanetarySystem } from './MechanicalPlanetarySystem';
import { TeaHost3D, type IrohActivity } from './TeaHost3D';
import { TeaShelf } from './TeaShelf';
import { TeaChamber, WaitingRoom } from './TeaArchitecture';
import { STATIONS } from './stations';
import { Surfaces } from './Surfaces';
import { DevShotCamera } from './DevShotCamera';
import type { SceneMood } from './motion/dynamics';
import type { Station } from '../shared/contracts';

function StationMenuHalo({
  station,
  reduced,
  onOpen,
}: {
  station: Station;
  reduced: boolean;
  onOpen: () => void;
}) {
  const halo = useRef<Group>(null);
  const anchor = STATIONS.find((place) => place.id === station)!;
  useFrame(({ clock }) => {
    if (!halo.current) return;
    const pulse = reduced ? 1 : 1 + Math.sin(clock.elapsedTime * 2.4) * 0.09;
    halo.current.scale.setScalar(pulse);
  });
  return (
    <group position={anchor.hotspot} name={`${station}-menu-halo`}>
      <pointLight
        color="#f3c579"
        intensity={reduced ? 0.55 : 0.9}
        distance={2.5}
      />
      <Billboard follow>
        <group
          ref={halo}
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
          onPointerOver={(event) => {
            event.stopPropagation();
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => {
            document.body.style.cursor = '';
          }}
        >
          <mesh>
            <ringGeometry args={[0.11, 0.15, 32]} />
            <meshBasicMaterial
              color="#f3c579"
              transparent
              opacity={0.9}
              depthTest={false}
              depthWrite={false}
            />
          </mesh>
          <mesh scale={1.48}>
            <ringGeometry args={[0.11, 0.12, 32]} />
            <meshBasicMaterial
              color="#fff0ca"
              transparent
              opacity={0.7}
              depthTest={false}
              depthWrite={false}
            />
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
}) {
  return (
    <>
      <color attach="background" args={['#2f2119']} />
      <hemisphereLight args={['#b6bfcb', '#604a36', 0.9]} />
      <ambientLight intensity={0.58} color="#ffe8ce" />
      <directionalLight
        position={[-5, 6, -4]}
        color="#ffce8d"
        intensity={2.25}
        castShadow
        shadow-bias={-0.00035}
        shadow-normalBias={0.025}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
      />
      <directionalLight
        position={[3, 3.8, 2.5]}
        color="#e8d6be"
        intensity={0.88}
      />
      <pointLight
        position={[1.1, 1.75, -0.7]}
        color="#e8d7bf"
        intensity={2.2}
        distance={5.3}
      />
      <WaitingRoom />
      <TeaChamber>
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
        <TeaShelf onSelect={onShelfSelect} revealed={shelfRevealed} />
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
      </Canvas>
    </SceneBoundary>
  );
}
