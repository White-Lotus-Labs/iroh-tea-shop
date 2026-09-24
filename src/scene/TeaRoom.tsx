import { Component, Suspense, type ReactNode, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import { CameraRig } from './CameraRig';
import { TeaRitual, LanternLight, ShelfPlacement } from './TeaRitual';
import { TeaHost3D } from './TeaHost3D';
import { TeaShelf } from './TeaShelf';
import { TeaChamber, WaitingRoom } from './TeaArchitecture';
import { STATIONS } from './stations';
import { Surfaces, Solid } from './Surfaces';
import type { SceneMood } from './motion/dynamics';
import type { Station } from '../shared/contracts';

function RoomGeometry({
  mood,
  reduced,
  requestKey,
}: {
  mood: SceneMood;
  reduced: boolean;
  requestKey: string | null;
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
          <TeaHost3D reduced={reduced} />
        </Suspense>
        <TeaShelf />
        <ShelfPlacement active={mood === 'card'} reduced={reduced}>
          <Solid
            position={[0, 0, 0]}
            size={[0.43, 0.46, 0.04]}
            color="#f3e9d5"
            surface="paper"
          />
          <Solid
            position={[0, 0.06, 0.03]}
            size={[0.27, 0.015, 0.01]}
            color="#697558"
          />
          <Solid
            position={[0, -0.04, 0.03]}
            size={[0.27, 0.015, 0.01]}
            color="#b86c4f"
          />
        </ShelfPlacement>
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
  mood,
  requestKey,
  onArrive,
  onAvailabilityChange,
}: {
  station: Station;
  reduced: boolean;
  resetKey: number;
  typing: boolean;
  reading: boolean;
  mood: SceneMood;
  requestKey: string | null;
  onArrive: (station: Station) => void;
  onAvailabilityChange: (available: boolean) => void;
}) {
  const [lost, setLost] = useState(false);
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
          <RoomGeometry mood={mood} reduced={reduced} requestKey={requestKey} />
        </Surfaces>
        <CameraRig
          station={station}
          reduced={reduced}
          resetKey={resetKey}
          typing={typing}
          reading={reading}
          onArrive={onArrive}
        />
      </Canvas>
    </SceneBoundary>
  );
}
