import { useEffect, useMemo } from 'react';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { SurfaceMaterial } from '../Surfaces';
import type { Point } from '../stations';

function Vase({ position }: { position: Point }) {
  return (
    <group position={position}>
      <mesh castShadow>
        <sphereGeometry args={[0.17, 20, 16]} />
        <meshPhysicalMaterial
          color="#394638"
          roughness={0.35}
          clearcoat={0.25}
        />
      </mesh>
      <mesh position={[0, 0.14, 0]} castShadow>
        <cylinderGeometry args={[0.075, 0.11, 0.16, 18]} />
        <meshPhysicalMaterial
          color="#394638"
          roughness={0.35}
          clearcoat={0.25}
        />
      </mesh>
      {[
        [-0.2, 0.33],
        [0.08, 0.44],
        [0.24, 0.26],
      ].map(([x, y], index) => (
        <group key={index}>
          <mesh position={[x / 2, y / 2 + 0.16, 0]} rotation={[0, 0, -x * 0.7]}>
            <cylinderGeometry args={[0.008, 0.012, y, 5]} />
            <meshStandardMaterial color="#48583a" />
          </mesh>
          <mesh position={[x, y + 0.12, 0]} scale={[0.45, 1, 0.32]}>
            <sphereGeometry args={[0.11, 8, 6]} />
            <meshStandardMaterial color="#506346" roughness={1} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Cushion({ position }: { position: Point }) {
  const geometry = useMemo(
    () => new RoundedBoxGeometry(0.74, 0.11, 0.8, 4, 0.045),
    [],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh
      geometry={geometry}
      position={position}
      rotation={[0, 0.18, 0]}
      castShadow
      receiveShadow
    >
      <SurfaceMaterial surface="cloth" color="#3f4a37" />
    </mesh>
  );
}

/** Loose props in the tea chamber: cushions, plants and small objects. */
export function ChamberDressing() {
  return (
    <group>
      <Cushion position={[-0.76, 0.105, -0.93]} />
    </group>
  );
}

/** Loose props in the waiting room. */
export function WaitingDressing() {
  return (
    <group>
      <Vase position={[2.55, 0.17, 4.46]} />
    </group>
  );
}
