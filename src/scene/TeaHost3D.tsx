import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CatmullRomCurve3, Group, Vector3 } from 'three';
import { SurfaceMaterial } from './Surfaces';

type Point = [number, number, number];

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
  return (
    <mesh
      position={position}
      scale={scale}
      rotation={rotation}
      castShadow
      receiveShadow
    >
      <sphereGeometry args={[1, 24, 16]} />
      {surface ? (
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
      {/* The skull, ears and cheeks have real depth at the host station. */}
      <Form
        position={[0, 0.055, -0.04]}
        scale={[0.265, 0.31, 0.25]}
        color="#ae795a"
      />
      <Form
        position={[-0.266, 0.01, -0.005]}
        scale={[0.045, 0.072, 0.045]}
        color="#a77353"
      />
      <Form
        position={[0.266, 0.01, -0.005]}
        scale={[0.045, 0.072, 0.045]}
        color="#a77353"
      />
      <Form
        position={[-0.106, -0.08, 0.193]}
        scale={[0.116, 0.083, 0.052]}
        color="#b78463"
      />
      <Form
        position={[0.106, -0.08, 0.193]}
        scale={[0.116, 0.083, 0.052]}
        color="#b78463"
      />
      <Form
        position={[0, 0.005, 0.244]}
        scale={[0.052, 0.073, 0.064]}
        color="#ba8764"
      />
      <Form
        position={[0, -0.08, 0.283]}
        scale={[0.055, 0.025, 0.024]}
        color="#ad7451"
      />
      <Stroke
        points={[
          [-0.067, -0.151, 0.252],
          [0, -0.172, 0.266],
          [0.067, -0.151, 0.252],
        ]}
        color="#643d30"
        radius={0.006}
      />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Form
            position={[side * 0.119, 0.062, 0.211]}
            scale={[0.055, 0.017, 0.014]}
            color="#c5ad8a"
          />
          <Form
            position={[side * 0.119, 0.061, 0.224]}
            scale={[0.011, 0.014, 0.008]}
            color="#342a22"
          />
          <Stroke
            points={[
              [side * 0.06, 0.117, 0.222],
              [side * 0.119, 0.131, 0.216],
              [side * 0.19, 0.116, 0.182],
            ]}
            color="#d1cbbd"
            radius={0.015}
          />
          <Stroke
            points={[
              [side * 0.055, 0.055, 0.22],
              [side * 0.12, 0.04, 0.229],
              [side * 0.18, 0.05, 0.187],
            ]}
            color="#a86b4a"
            radius={0.006}
          />
          <Form
            position={[side * 0.22, 0.205, -0.045]}
            scale={[0.058, 0.155, 0.15]}
            color="#c7c3b5"
          />
          <Form
            position={[side * 0.12, -0.196, 0.155]}
            scale={[0.08, 0.14, 0.065]}
            rotation={[0, 0, side * -0.31]}
            color="#cfcbbe"
          />
        </group>
      ))}
      <Form
        position={[0, 0.29, -0.075]}
        scale={[0.26, 0.075, 0.21]}
        color="#cbc6b8"
      />
      <Form
        position={[0, 0.39, -0.13]}
        scale={[0.11, 0.08, 0.11]}
        color="#d6d0c1"
      />
      <Form
        position={[0, -0.235, 0.145]}
        scale={[0.105, 0.15, 0.085]}
        color="#d4cfc1"
      />
      <Form
        position={[0, -0.325, 0.15]}
        scale={[0.073, 0.09, 0.06]}
        color="#d1ccbe"
      />
      <Stroke
        points={[
          [-0.105, -0.085, 0.245],
          [0, -0.117, 0.266],
          [0.105, -0.085, 0.245],
        ]}
        color="#d2cdbf"
        radius={0.019}
      />
      <Stroke
        points={[
          [-0.075, -0.3, 0.205],
          [0, -0.345, 0.205],
          [0.075, -0.3, 0.205],
        ]}
        color="#bfb9ac"
        radius={0.007}
      />
    </group>
  );
}

/** A sculpted, seated tea host. All silhouettes are volumetric geometry, never a billboard. */
export function TeaHost3D({ reduced }: { reduced: boolean }) {
  const head = useRef<Group>(null);
  const body = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!head.current || !body.current) return;
    const breath = reduced ? 0 : Math.sin(clock.elapsedTime * 0.74);
    body.current.scale.y = 1 + breath * 0.0025;
    head.current.rotation.z = reduced
      ? 0
      : Math.sin(clock.elapsedTime * 0.38) * 0.012;
  });
  return (
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
          position={[-0.18, 0.9, 0.275]}
          scale={[0.2, 0.36, 0.052]}
          rotation={[0, 0, -0.24]}
          color="#906d48"
          surface="cloth"
        />
        <Form
          position={[0.18, 0.9, 0.275]}
          scale={[0.2, 0.36, 0.052]}
          rotation={[0, 0, 0.24]}
          color="#806443"
          surface="cloth"
        />
        <Form
          position={[0, 0.66, 0.34]}
          scale={[0.38, 0.075, 0.045]}
          color="#67513a"
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
        <Stroke
          points={[
            [-0.31, 1.2, 0.27],
            [-0.15, 0.99, 0.331],
            [0.02, 0.76, 0.348],
          ]}
          color="#bd9c6b"
          radius={0.009}
        />
        <Stroke
          points={[
            [0.29, 1.18, 0.27],
            [0.13, 0.97, 0.332],
            [-0.015, 0.75, 0.348],
          ]}
          color="#ad875d"
          radius={0.009}
        />
        <Stroke
          points={[
            [-0.5, 0.44, 0.49],
            [-0.25, 0.32, 0.5],
            [0.11, 0.3, 0.5],
          ]}
          color="#66503a"
          radius={0.012}
        />
        <Stroke
          points={[
            [0.15, 0.38, 0.5],
            [0.42, 0.3, 0.46],
            [0.57, 0.27, 0.35],
          ]}
          color="#6b5138"
          radius={0.011}
        />
        <group ref={head}>
          <Head />
        </group>
      </group>
    </group>
  );
}
