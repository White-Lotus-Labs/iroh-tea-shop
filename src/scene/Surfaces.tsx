import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import {
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  RGBAFormat,
  SRGBColorSpace,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Point } from './stations';
import { createRandom } from './motion/dynamics';
type Surface = 'wood' | 'plaster' | 'paper' | 'cloth';
function surfaceTexture(kind: Surface) {
  const size = 256,
    data = new Uint8Array(size * size * 4),
    random = createRandom(715);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const grain = Math.sin(
        y * 0.11 + Math.sin(x * 0.023) * 1.1 + Math.sin(x * 0.071) * 0.3,
      );
      const fine = Math.sin(y * 0.38 + Math.sin(x * 0.013) * 2);
      const noise = random() - 0.5;
      const value =
        kind === 'wood'
          ? 218 + grain * 8 + fine * 3 + noise * 9
          : kind === 'cloth'
            ? 210 + (x % 4 < 2 === y % 4 < 2 ? 3 : -3) + noise * 8
            : kind === 'paper'
              ? 230 + noise * 14
              : 220 + noise * 17;
      const i = (y * size + x) * 4;
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
      data[i + 3] = 255;
    }
  const texture = new DataTexture(data, size, size, RGBAFormat);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.colorSpace = SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  texture.anisotropy = 4;
  return texture;
}
const SurfaceContext = createContext<Record<Surface, DataTexture> | null>(null);
export function Surfaces({ children }: { children: ReactNode }) {
  const textures = useMemo(
    () => ({
      wood: surfaceTexture('wood'),
      plaster: surfaceTexture('plaster'),
      paper: surfaceTexture('paper'),
      cloth: surfaceTexture('cloth'),
    }),
    [],
  );
  useEffect(
    () => () => Object.values(textures).forEach((texture) => texture.dispose()),
    [textures],
  );
  return (
    <SurfaceContext.Provider value={textures}>
      {children}
    </SurfaceContext.Provider>
  );
}
export function SurfaceMaterial({
  surface = 'wood',
  color,
}: {
  surface?: Surface;
  color: string;
}) {
  const maps = useContext(SurfaceContext)!;
  return (
    <meshStandardMaterial
      color={color}
      map={maps[surface]}
      bumpMap={maps[surface]}
      bumpScale={
        surface === 'wood' ? 0.0025 : surface === 'cloth' ? 0.002 : 0.001
      }
      roughness={surface === 'wood' ? 0.76 : surface === 'paper' ? 0.95 : 1}
    />
  );
}
export function Solid({
  position,
  size,
  color,
  surface = 'wood',
}: {
  position: Point;
  size: Point;
  color: string;
  surface?: Surface;
}) {
  const [x, y, z] = size;
  const geometry = useMemo(
    () =>
      new RoundedBoxGeometry(
        x,
        y,
        z,
        2,
        Math.min(0.014, x * 0.12, y * 0.12, z * 0.12),
      ),
    [x, y, z],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} position={position} receiveShadow castShadow>
      <SurfaceMaterial surface={surface} color={color} />
    </mesh>
  );
}
