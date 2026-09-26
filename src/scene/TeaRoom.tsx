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
import { TeaRitual, LanternLight } from './TeaRitual';
import { TeaHost3D, type IrohActivity } from './TeaHost3D';
import { TeaShelf } from './TeaShelf';
import { TeaChamber, WaitingRoom } from './TeaArchitecture';
import { STATIONS } from './stations';
import { Surfaces } from './Surfaces';
import type { SceneMood } from './motion/dynamics';
import type { Station } from '../shared/contracts';

function RoomGeometry({
  mood,
  reduced,
  requestKey,
  irohActivity,
  onShelfSelect,
  shelfRevealed,
}: {
  mood: SceneMood;
  reduced: boolean;
  requestKey: string | null;
  irohActivity: IrohActivity;
  onShelfSelect: () => void;
  shelfRevealed: boolean;
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
        <Suspense fallback={null}>
          <TeaHost3D reduced={reduced} activity={irohActivity} />
        </Suspense>
        <TeaShelf onSelect={onShelfSelect} revealed={shelfRevealed} />
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
      </Canvas>
    </SceneBoundary>
  );
}
