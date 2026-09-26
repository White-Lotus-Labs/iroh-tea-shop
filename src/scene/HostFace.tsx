import { useEffect, useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import {
  BufferGeometry,
  DataTexture,
  DoubleSide,
  Float32BufferAttribute,
  LinearFilter,
  RGBAFormat,
  SRGBColorSpace,
} from 'three';

/** A curved facial surface follows the sculpted skull and carries a soft-edged skin texture. */
function faceGeometry() {
  const geometry = new BufferGeometry();
  const positions: number[] = [];
  const uv: number[] = [];
  const triangles: number[] = [];
  const rings = 25;
  const sides = 64;

  for (let ring = 0; ring <= rings; ring++) {
    const radius = ring / rings;
    for (let side = 0; side < sides; side++) {
      const angle = (side / sides) * Math.PI * 2;
      const x = Math.cos(angle) * radius * 0.226;
      const y = Math.sin(angle) * radius * 0.264;
      const skull = Math.sqrt(
        Math.max(0.03, 1 - (x / 0.265) ** 2 - (y / 0.31) ** 2),
      );
      const nose =
        0.059 * Math.exp(-((x / 0.052) ** 2 + ((y + 0.035) / 0.086) ** 2));
      const cheeks =
        0.009 *
        Math.exp(
          -(((Math.abs(x) - 0.112) / 0.07) ** 2 + ((y + 0.07) / 0.07) ** 2),
        );
      const brow =
        0.009 *
        Math.exp(
          -(((Math.abs(x) - 0.112) / 0.058) ** 2 + ((y - 0.06) / 0.037) ** 2),
        );
      positions.push(x, y, 0.25 * skull + nose + cheeks + brow + 0.004);
      uv.push(0.5 + x / 0.452, 0.5 + y / 0.528);
    }
  }
  for (let ring = 0; ring < rings; ring++) {
    for (let side = 0; side < sides; side++) {
      const next = (side + 1) % sides;
      const a = ring * sides + side;
      const b = (ring + 1) * sides + side;
      const c = (ring + 1) * sides + next;
      const d = ring * sides + next;
      triangles.push(a, b, c, a, c, d);
    }
  }
  geometry.setIndex(triangles);
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  geometry.computeVertexNormals();
  return geometry;
}

function featherMask() {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5 - size / 2) / (size / 2);
      const dy = (y + 0.5 - size / 2) / (size / 2);
      const radius = Math.sqrt(dx * dx + dy * dy);
      const t = Math.max(0, Math.min(1, (radius - 0.76) / 0.24));
      const shade = Math.round((1 - t * t * (3 - 2 * t)) * 255);
      const offset = (y * size + x) * 4;
      data[offset] = shade;
      data[offset + 1] = shade;
      data[offset + 2] = shade;
      data[offset + 3] = 255;
    }
  }
  const mask = new DataTexture(data, size, size, RGBAFormat);
  mask.minFilter = mask.magFilter = LinearFilter;
  mask.needsUpdate = true;
  return mask;
}

export function HostFace() {
  const face = useTexture('/images/tea-host-face.jpg');
  face.colorSpace = SRGBColorSpace;
  const geometry = useMemo(faceGeometry, []);
  const mask = useMemo(featherMask, []);
  useEffect(
    () => () => {
      geometry.dispose();
      mask.dispose();
    },
    [geometry, mask],
  );
  return (
    <mesh geometry={geometry} position={[0, 0.055, -0.04]} castShadow>
      <meshStandardMaterial
        map={face}
        alphaMap={mask}
        bumpMap={face}
        bumpScale={0.001}
        transparent
        depthWrite={false}
        roughness={0.91}
        metalness={0}
        side={DoubleSide}
      />
    </mesh>
  );
}
