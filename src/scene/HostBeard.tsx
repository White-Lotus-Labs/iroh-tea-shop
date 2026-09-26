import { useEffect, useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import { DoubleSide, PlaneGeometry, SRGBColorSpace } from 'three';

function curvedBeardGeometry() {
  const geometry = new PlaneGeometry(0.53, 0.55, 32, 24);
  const position = geometry.attributes.position;
  for (let index = 0; index < position.count; index++) {
    const x = position.getX(index);
    const y = position.getY(index);
    const curl =
      0.053 - 0.14 * (x / 0.265) ** 2 + 0.12 * Math.max(0, -y / 0.275);
    position.setZ(index, curl);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** Thin textured hair wraps a sculpted chin rather than sitting on a flat billboard. */
export function HostBeard() {
  const beard = useTexture('/images/tea-host-beard.png');
  beard.colorSpace = SRGBColorSpace;
  const geometry = useMemo(curvedBeardGeometry, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <group>
      <mesh position={[0, -0.34, 0.1]} scale={[0.17, 0.15, 0.095]} castShadow>
        <sphereGeometry args={[1, 24, 16]} />
        <meshStandardMaterial color="#ccc8bc" roughness={0.96} />
      </mesh>
      <mesh geometry={geometry} position={[0, -0.11, 0.235]}>
        <meshStandardMaterial
          map={beard}
          transparent
          alphaTest={0.08}
          depthWrite
          roughness={0.96}
          metalness={0}
          side={DoubleSide}
        />
      </mesh>
    </group>
  );
}
