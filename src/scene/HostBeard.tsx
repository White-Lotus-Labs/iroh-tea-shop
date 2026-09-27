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

/** The facial beard is now sculpted and textured seamlessly within HostFace. */
export function HostBeard() {
  return null;
}
