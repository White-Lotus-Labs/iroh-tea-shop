import {
  Component,
  Suspense,
  type ReactNode,
  useEffect,
  useState,
} from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, useProgress } from '@react-three/drei';
import { CameraRig } from './CameraRig';
import { StationHalos } from './StationHalos';
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
  onNavigate,
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
  onNavigate: (station: Station) => void;
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
        <StationHalos
          station={station}
          menuClosed={menuClosed}
          reduced={reduced}
          onNavigate={onNavigate}
          onMenuOpen={onMenuOpen}
          onShelfSelect={onShelfSelect}
        />
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
  onNavigate,
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
  onNavigate: (station: Station) => void;
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
            onNavigate={onNavigate}
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
