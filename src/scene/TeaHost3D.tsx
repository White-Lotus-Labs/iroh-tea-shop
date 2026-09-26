import { createContext, useContext, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import {
  CatmullRomCurve3,
  Group,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  Vector3,
} from 'three';
import { SurfaceMaterial } from './Surfaces';
import { HostFace } from './HostFace';
import { HostBeard } from './HostBeard';
import { HostRobe } from './HostRobe';

type Point = [number, number, number];
const FabricContext = createContext<Texture | null>(null);

function Form({
  position,
  scale,
  color,
  surface,
  rotation,
}: {
  position: Point;
  scale: Point;
  color: string;
  surface?: 'cloth' | 'wood';
  rotation?: Point;
}) {
  const fabric = useContext(FabricContext);
  return (
    <mesh
      position={position}
      scale={scale}
      rotation={rotation}
      castShadow
      receiveShadow
    >
      <sphereGeometry args={[1, 24, 16]} />
      {surface === 'cloth' && fabric ? (
        <meshStandardMaterial
          color={color}
          map={fabric}
          bumpMap={fabric}
          bumpScale={0.003}
          roughness={0.93}
        />
      ) : surface ? (
        <SurfaceMaterial color={color} surface={surface} />
      ) : (
        <meshStandardMaterial color={color} roughness={0.86} />
      )}
    </mesh>
  );
}

function Stroke({
  points,
  color,
  radius = 0.012,
}: {
  points: Point[];
  color: string;
  radius?: number;
}) {
  return (
    <mesh castShadow>
      <tubeGeometry
        args={[
          new CatmullRomCurve3(points.map((point) => new Vector3(...point))),
          24,
          radius,
          6,
          false,
        ]}
      />
      <meshStandardMaterial color={color} roughness={0.96} />
    </mesh>
  );
}

function Hand({ left = false }: { left?: boolean }) {
  const side = left ? -1 : 1;
  return (
    <group
      position={left ? [-0.81, 0.82, 0.36] : [0.51, 0.47, 0.43]}
      rotation={left ? [0.13, 0.31, 0.18] : [-0.15, -0.25, -0.42]}
    >
      <Form position={[0, 0, 0]} scale={[0.104, 0.05, 0.11]} color="#b98764" />
      {[-0.078, -0.027, 0.027, 0.078].map((x, index) => (
        <Form
          key={x}
          position={[
            x * 0.84,
            0.012,
            0.12 + (index === 1 || index === 2 ? 0.012 : 0),
          ]}
          scale={[0.015, 0.017, 0.075 - Math.abs(index - 1.5) * 0.008]}
          color="#bb8a67"
        />
      ))}
      <Form
        position={[side * 0.09, 0.005, 0.045]}
        scale={[0.024, 0.025, 0.06]}
        rotation={[0, side * 0.68, 0]}
        color="#b98764"
      />
    </group>
  );
}

function Head() {
  return (
    <group position={[0, 1.53, 0.06]}>
      <Form
        position={[0, 0.055, -0.04]}
        scale={[0.265, 0.31, 0.25]}
        color="#bd8769"
      />
      <HostFace />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Form
            position={[side * 0.263, 0.012, -0.005]}
            scale={[0.044, 0.073, 0.047]}
            color="#b78062"
          />
          <Form
            position={[side * 0.224, 0.17, -0.065]}
            scale={[0.07, 0.16, 0.13]}
            color="#c6c3b7"
          />
          {[0, 1, 2, 3].map((strand) => (
            <Stroke
              key={strand}
              points={[
                [side * (0.16 + strand * 0.023), 0.278, 0.045],
                [side * (0.19 + strand * 0.018), 0.14, 0.069],
                [side * (0.211 + strand * 0.009), 0.045, 0.035],
              ]}
              color={strand % 2 === 0 ? '#e2ded1' : '#aca99e'}
              radius={0.004}
            />
          ))}
        </group>
      ))}
      <Form
        position={[0, 0.29, -0.075]}
        scale={[0.257, 0.081, 0.216]}
        color="#cfcbbf"
      />
      <Form
        position={[0, 0.408, -0.124]}
        scale={[0.11, 0.073, 0.107]}
        color="#d9d5c8"
      />
      <HostBeard />
    </group>
  );
}

/** A sculpted, seated tea host. All silhouettes are volumetric geometry, never a billboard. */
export type IrohActivity = 'idle' | 'researching' | 'responding' | 'error';

export function TeaHost3D({
  reduced,
  activity = 'idle',
}: {
  reduced: boolean;
  activity?: IrohActivity;
}) {
  const fabric = useTexture('/images/kimono-weave.jpg');
  fabric.colorSpace = SRGBColorSpace;
  fabric.wrapS = fabric.wrapT = RepeatWrapping;
  fabric.repeat.set(1.6, 1.6);
  const head = useRef<Group>(null);
  const body = useRef<Group>(null);
  useFrame(({ clock }, delta) => {
    if (!head.current || !body.current) return;
    const breath = reduced ? 0 : Math.sin(clock.elapsedTime * 0.74);
    body.current.scale.y = 1 + breath * 0.0025;
    head.current.rotation.z = reduced
      ? 0
      : Math.sin(clock.elapsedTime * 0.38) * 0.012;
    const thoughtfulTilt = reduced
      ? 0
      : activity === 'researching'
        ? -0.035
        : activity === 'responding'
          ? 0.018
          : 0;
    head.current.rotation.x +=
      (thoughtfulTilt - head.current.rotation.x) * Math.min(1, delta * 2.5);
  });
  return (
    <FabricContext.Provider value={fabric}>
      <group
        position={[2.16, 0, -3.62]}
        rotation={[0, -0.13, 0]}
        name="tea-host-3d"
      >
        <Form
          position={[0, 0.085, 0.02]}
          scale={[0.75, 0.105, 0.5]}
          color="#51583a"
          surface="cloth"
        />
        <Form
          position={[0, 0.18, 0.02]}
          scale={[0.68, 0.08, 0.45]}
          color="#777650"
          surface="cloth"
        />
        <group ref={body}>
          {/* Heavy seated folds and a raised torso give the kimono a believable center of mass. */}
          <Form
            position={[-0.34, 0.36, 0.17]}
            scale={[0.47, 0.23, 0.38]}
            color="#40362b"
            surface="cloth"
          />
          <Form
            position={[0.35, 0.36, 0.18]}
            scale={[0.46, 0.23, 0.38]}
            color="#42372a"
            surface="cloth"
          />
          <Form
            position={[0, 0.66, -0.02]}
            scale={[0.57, 0.53, 0.36]}
            color="#725133"
            surface="cloth"
          />
          <Form
            position={[0, 0.97, -0.04]}
            scale={[0.5, 0.46, 0.3]}
            color="#775635"
            surface="cloth"
          />
          <Form
            position={[-0.48, 1.035, -0.055]}
            scale={[0.24, 0.28, 0.25]}
            color="#3a3d2e"
            surface="cloth"
          />
          <Form
            position={[0.46, 1.03, -0.06]}
            scale={[0.23, 0.27, 0.25]}
            color="#3a3d2e"
            surface="cloth"
          />
          <Form
            position={[-0.62, 0.895, 0.13]}
            scale={[0.22, 0.17, 0.24]}
            rotation={[0, 0, 0.34]}
            color="#414333"
            surface="cloth"
          />
          <Form
            position={[0.52, 0.69, 0.16]}
            scale={[0.21, 0.18, 0.24]}
            rotation={[0, 0, 0.22]}
            color="#414333"
            surface="cloth"
          />
          <Hand left />
          <Hand />
          <HostRobe />
          <group ref={head}>
            <Head />
          </group>
        </group>
      </group>
    </FabricContext.Provider>
  );
}
