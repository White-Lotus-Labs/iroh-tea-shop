import { useEffect, useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import { DoubleSide, PlaneGeometry, SRGBColorSpace } from 'three';

function robeGeometry() {
  const geometry = new PlaneGeometry(1.42, 1.25, 32, 24);
  const position = geometry.attributes.position;
  for (let index = 0; index < position.count; index++) {
    const x = position.getX(index);
    const y = position.getY(index);
    const shoulder = Math.sqrt(Math.max(0.04, 1 - (x / 0.75) ** 2));
    const lap = 0.035 * Math.max(0, -y / 0.625);
    const neckRecess = 0.18 * Math.max(0, Math.min(1, (y - 0.15) / 0.2));
    position.setZ(index, shoulder * 0.115 + lap - neckRecess);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** Detailed cloth follows the rounded 3D torso and its physical sleeve silhouette. */
export function HostRobe() {
  const robe = useTexture('/images/tea-host-robe.png');
  robe.colorSpace = SRGBColorSpace;
  const geometry = useMemo(robeGeometry, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} position={[0, 0.765, 0.335]}>
      <meshStandardMaterial
        map={robe}
        transparent
        alphaTest={0.08}
        depthWrite
        roughness={0.96}
        metalness={0}
        side={DoubleSide}
      />
    </mesh>
  );
}
