import { useEffect, useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import { DoubleSide, PlaneGeometry, SRGBColorSpace } from 'three';

function curvedHairGeometry() {
  const geometry = new PlaneGeometry(0.69, 0.74, 40, 32);
  const position = geometry.attributes.position;
  for (let index = 0; index < position.count; index++) {
    const x = position.getX(index);
    const y = position.getY(index);
    const crown = Math.sqrt(Math.max(0.04, 1 - (x / 0.39) ** 2));
    const sideWrap = 0.022 * Math.max(0, Math.abs(x) / 0.345 - 0.55);
    const topLift = 0.026 * Math.max(0, y / 0.37);
    position.setZ(index, crown * 0.072 + topLift - sideWrap);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** Textured silver hair wraps the sculpted cranium, with the portrait visible through its alpha opening. */
export function HostHair() {
  const hair = useTexture('/images/tea-host-hair.png');
  hair.colorSpace = SRGBColorSpace;
  const geometry = useMemo(curvedHairGeometry, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} position={[0, 0.095, 0.198]} castShadow>
      <meshStandardMaterial
        map={hair}
        transparent
        alphaTest={0.08}
        depthWrite
        roughness={0.91}
        metalness={0}
        side={DoubleSide}
      />
    </mesh>
  );
}
