import {
  Component,
  Suspense,
  type ReactNode,
  useEffect,
  useState,
} from 'react';
import dynamic from 'next/dynamic';
import { Canvas, type RootState } from '@react-three/fiber';
import { ContactShadows, useProgress } from '@react-three/drei';
import { WebGLRenderTarget } from 'three';
import { CameraRig } from './CameraRig';
import { StationHalos } from './StationHalos';
import { TeaRitual, LanternLight } from './TeaRitual';
import {
  MechanicalPlanetarySystem,
  OrreryLight,
} from './MechanicalPlanetarySystem';
import { TeaHost3D, type IrohActivity } from './TeaHost3D';
import { ShelfLanternLight, TeaShelf } from './TeaShelf';
import {
  ChamberDetail,
  TeaChamber,
  WaitingDetail,
  WaitingRoom,
} from './TeaArchitecture';
import { STATIONS } from './stations';
import { Surfaces } from './Surfaces';
import { DevShotCamera } from './DevShotCamera';
import { SceneLighting, Staged } from './SceneEffects';
import { lightExperience } from './lightExperience';
import { ThesisCards } from './props/ThesisCards';
import type { SceneMood } from './motion/dynamics';
import type { Station } from '../shared/contracts';
import type { ThesisId } from '../thesis/types';

// AO, bloom, and the room environment stay out of the entrance download.
const ScenePolish = dynamic(
  () => import('./ScenePolish').then((mod) => ({ default: mod.ScenePolish })),
  { ssr: false, loading: () => null },
);

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
  polish,
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
  polish: boolean;
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
        // About one texel of normal bias: more lifts contact shadows and props look afloat.
        shadow-bias={-0.0003}
        shadow-normalBias={0.011}
        shadow-mapSize={lightExperience() ? [1024, 1024] : [2048, 2048]}
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
      <OrreryLight />
      <ShelfLanternLight />
      <SceneLighting reduced={reduced} />
      <WaitingRoom />
      {/* Later group: no lights, so the shell's programs stay valid when it arrives. */}
      <Staged reduced={reduced} precompile={compileRoom}>
        <WaitingDetail />
        <ChamberDetail reduced={reduced} />
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
        <MechanicalPlanetarySystem reduced={reduced} />
        <TeaShelf
          onSelect={onShelfSelect}
          revealed={shelfRevealed}
          reduced={reduced}
          posters={station !== 'Entrance'}
        />
        <ThesisCards
          halos={station === 'Counter' && menuClosed}
          reduced={reduced}
          onPick={onThesisPick}
        />
        <StationHalos
          station={station}
          menuClosed={menuClosed}
          reduced={reduced}
          onNavigate={onNavigate}
          onMenuOpen={onMenuOpen}
          onShelfSelect={onShelfSelect}
        />
        {polish && <ScenePolish reduced={reduced} />}
      </Staged>
      <TeaChamber>
        <LanternLight mood={mood} reduced={reduced} />
        <TeaRitual mood={mood} reduced={reduced} requestKey={requestKey} />
        <Suspense fallback={null}>
          <TeaHost3D reduced={reduced} activity={irohActivity} />
        </Suspense>
      </TeaChamber>
    </>
  );
}

/**
 * Builds every program in the room while the loader is up, so the first drag never
 * compiles a shader. Any offscreen target selects the variants the composer renders with.
 */
function compileRoom({ gl, scene, camera }: RootState) {
  const target = new WebGLRenderTarget(1, 1),
    previous = gl.getRenderTarget();
  gl.setRenderTarget(target);
  const done = gl.compileAsync(scene, camera);
  gl.setRenderTarget(previous);
  return done.finally(() => target.dispose());
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
  polish,
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
  polish: boolean;
}) {
  const [lost, setLost] = useState(false);
  // Textures load through three's default manager, which useProgress observes.
  const { active, progress } = useProgress();
  useEffect(() => {
    onLoadProgress?.(active, progress);
  }, [active, progress, onLoadProgress]);
  const light = lightExperience();
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
        dpr={light ? [1, 1] : [1, 1.25]}
        camera={{
          position: light ? [0.05, 1.66, 7.82] : counterPosition,
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
            polish={polish}
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
