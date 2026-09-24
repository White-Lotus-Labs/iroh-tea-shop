import { Suspense } from 'react';
import { useTexture } from '@react-three/drei';
import { SRGBColorSpace } from 'three';
import { Cup } from './Ceramics';
import { Solid, SurfaceMaterial } from './Surfaces';

const timber = '#3e271b';
const plaster = '#917354';

function Beam({
  position,
  size,
  color = timber,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color?: string;
}) {
  return <Solid position={position} size={size} color={color} />;
}

function Shoji({
  x,
  z,
  width = 2.3,
}: {
  x: number;
  z: number;
  width?: number;
}) {
  return (
    <group>
      <Solid
        position={[x, 1.79, z]}
        size={[width - 0.08, 2.8, 0.035]}
        color="#e0bd8e"
        surface="paper"
      />
      {[-1, 1].map((side) => (
        <Beam
          key={side}
          position={[x + (width / 2 - 0.035) * side, 1.79, z + 0.04]}
          size={[0.075, 2.88, 0.085]}
        />
      ))}
      {Array.from({ length: 5 }, (_, index) => (
        <Beam
          key={index}
          position={[x, 0.42 + index * 0.68, z + 0.045]}
          size={[width, 0.037, 0.065]}
        />
      ))}
      {[-0.25, 0.25].map((fraction) => (
        <Beam
          key={fraction}
          position={[x + width * fraction, 1.79, z + 0.045]}
          size={[0.035, 2.8, 0.065]}
        />
      ))}
    </group>
  );
}

function Floor({ center, length }: { center: number; length: number }) {
  return (
    <group>
      <Solid
        position={[0, -0.16, center]}
        size={[8.3, 0.31, length]}
        color="#795135"
      />
      {Array.from({ length: 16 }, (_, index) => (
        <Beam
          key={index}
          position={[-3.87 + index * 0.51, 0.007, center]}
          size={[0.014, 0.007, length]}
          color="#352116"
        />
      ))}
    </group>
  );
}

function Vase({ position }: { position: [number, number, number] }) {
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

function TeaBackdrop() {
  const texture = useTexture('/images/tea-back-wall.jpg');
  texture.colorSpace = SRGBColorSpace;
  return (
    <mesh position={[0, 1.85, -6.18]}>
      <planeGeometry args={[8.25, 4.64]} />
      <meshBasicMaterial map={texture} />
    </mesh>
  );
}

function CounterBackdrop() {
  const texture = useTexture('/images/counter-wall.jpg');
  texture.colorSpace = SRGBColorSpace;
  return (
    <mesh position={[-3.99, 1.85, 7.35]} rotation={[0, Math.PI / 2, 0]}>
      <planeGeometry args={[7.1, 4]} />
      <meshBasicMaterial map={texture} />
    </mesh>
  );
}

export function WaitingRoom() {
  return (
    <group name="waiting-counter-room">
      <Floor center={7.3} length={8.1} />
      <Solid
        position={[-4.1, 1.85, 7.3]}
        size={[0.19, 3.7, 8.1]}
        color={plaster}
        surface="plaster"
      />
      <Suspense fallback={null}>
        <CounterBackdrop />
      </Suspense>
      <Solid
        position={[4.1, 1.85, 7.3]}
        size={[0.19, 3.7, 8.1]}
        color={plaster}
        surface="plaster"
      />
      <Solid
        position={[0, 1.85, 11.28]}
        size={[8.2, 3.7, 0.17]}
        color={plaster}
        surface="plaster"
      />
      <Solid
        position={[-3.1, 1.85, 3.32]}
        size={[2, 3.7, 0.19]}
        color={plaster}
        surface="plaster"
      />
      <Solid
        position={[3.1, 1.85, 3.32]}
        size={[2, 3.7, 0.19]}
        color={plaster}
        surface="plaster"
      />
      <Solid
        position={[0, 3.34, 3.32]}
        size={[4.25, 0.72, 0.2]}
        color={plaster}
        surface="plaster"
      />
      <Beam position={[0, 3.06, 3.43]} size={[2.35, 0.19, 0.26]} />
      {[-1.23, 1.23].map((x) => (
        <Beam key={x} position={[x, 1.53, 3.44]} size={[0.18, 3.08, 0.28]} />
      ))}
      {[4.05, 7.4, 10.74].map((z) => (
        <Beam key={z} position={[-3.94, 1.85, z]} size={[0.16, 3.7, 0.16]} />
      ))}
      {[4.1, 7.45, 10.7].map((z) => (
        <Beam key={z} position={[0, 3.48, z]} size={[8.2, 0.22, 0.25]} />
      ))}
      <Shoji x={3.95} z={6.8} width={2.15} />
      <Solid
        position={[-2.2, 0.62, 6.07]}
        size={[3.3, 1.24, 0.96]}
        color="#57351f"
      />
      <Solid
        position={[-2.2, 1.26, 6.07]}
        size={[3.55, 0.14, 1.11]}
        color="#99643c"
      />
      {[-3.55, -2.85, -2.15, -1.45, -0.8].map((x) => (
        <Beam
          key={x}
          position={[x, 0.62, 6.57]}
          size={[0.032, 1.08, 0.03]}
          color="#a77747"
        />
      ))}
      <Cup position={[-2.86, 1.4, 5.93]} color="#a5a077" />
      <Cup position={[-2.4, 1.4, 5.93]} color="#b98755" />
      <Vase position={[2.55, 0.17, 4.46]} />
      <pointLight
        position={[-1.9, 2.7, 7.5]}
        intensity={5}
        color="#ffcf96"
        distance={6}
      />
    </group>
  );
}

export function TeaChamber({ children }: { children: React.ReactNode }) {
  return (
    <group name="tea-chamber">
      <Floor center={-1.5} length={9.7} />
      <Solid
        position={[-4.1, 1.85, -1.48]}
        size={[0.19, 3.7, 9.75]}
        color={plaster}
        surface="plaster"
      />
      <Solid
        position={[4.1, 1.85, -1.48]}
        size={[0.19, 3.7, 9.75]}
        color={plaster}
        surface="plaster"
      />
      {[-3.98, 3.98].map((x) => (
        <Beam key={x} position={[x, 1.85, -1.45]} size={[0.17, 3.7, 9.55]} />
      ))}
      {[-5.7, -3.4, -0.9, 1.7].map((z) => (
        <Beam key={z} position={[0, 3.47, z]} size={[8.1, 0.2, 0.29]} />
      ))}
      <Suspense fallback={null}>
        <TeaBackdrop />
      </Suspense>
      <Solid
        position={[0, 0.028, -2.37]}
        size={[3.58, 0.035, 2.93]}
        color="#b9a171"
        surface="cloth"
      />
      <Solid
        position={[0, 0.07, -2.36]}
        size={[3.07, 0.038, 2.4]}
        color="#95815e"
        surface="cloth"
      />
      <Solid
        position={[0, 0.53, -2.41]}
        size={[2.58, 0.16, 1.37]}
        color="#815132"
      />
      {[-1.04, 1.04].flatMap((x) =>
        [-0.51, 0.51].map((z) => (
          <Beam
            key={`${x}${z}`}
            position={[x, 0.27, -2.41 + z]}
            size={[0.16, 0.47, 0.18]}
          />
        )),
      )}
      {[0.26, -0.37].map((x) => (
        <Beam
          key={x}
          position={[x, 0.625, -2.41]}
          size={[0.014, 0.006, 1.28]}
          color="#a36b3e"
        />
      ))}
      <Cup position={[-0.63, 0.68, -2.2]} color="#828069" />
      <Cup position={[0.58, 0.68, -2.34]} color="#a9a18a" />
      <mesh
        position={[-0.76, 0.13, -0.93]}
        scale={[0.7, 0.13, 0.46]}
        castShadow
        receiveShadow
      >
        <sphereGeometry args={[1, 32, 16]} />
        <SurfaceMaterial surface="cloth" color="#596044" />
      </mesh>
      <pointLight
        position={[-2.3, 2.45, -5.25]}
        intensity={7}
        color="#ffd5a0"
        distance={7}
      />
      {children}
    </group>
  );
}
