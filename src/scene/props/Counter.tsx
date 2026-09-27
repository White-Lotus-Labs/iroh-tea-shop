import { Suspense } from 'react';
import { useTexture } from '@react-three/drei';
import { SRGBColorSpace } from 'three';
import { Cup } from '../Ceramics';
import { Solid } from '../Surfaces';

function CounterBackdrop() {
  const texture = useTexture('/images/counter-wall.jpg');
  texture.colorSpace = SRGBColorSpace;
  return (
    <mesh position={[-3.99, 1.85, 7.35]} rotation={[0, Math.PI / 2, 0]}>
      <planeGeometry args={[7.1, 4]} />
      <meshBasicMaterial map={texture} color="#e4d3bf" />
    </mesh>
  );
}

/** The waiting-room serving counter, its back wall and what sits on it. */
export function Counter() {
  return (
    <group>
      <Suspense fallback={null}>
        <CounterBackdrop />
      </Suspense>
      <Solid
        position={[-2.2, 0.62, 6.07]}
        size={[3.3, 1.24, 0.96]}
        color="#3d2517"
      />
      <Solid
        position={[-2.2, 1.26, 6.07]}
        size={[3.55, 0.14, 1.11]}
        color="#6a3f25"
        clearcoat={0.35}
      />
      {Array.from({ length: 17 }, (_, index) => (
        <Solid
          key={index}
          position={[-3.72 + index * 0.19, 0.62, 6.565]}
          size={[0.05, 1.1, 0.035]}
          color="#2a1a10"
        />
      ))}
      <Cup position={[-2.86, 1.4, 5.93]} color="#a5a077" />
      <Cup position={[-2.4, 1.4, 5.93]} color="#b98755" />
    </group>
  );
}
