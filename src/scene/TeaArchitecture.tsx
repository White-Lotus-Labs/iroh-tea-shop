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

function RightWallBackdrop() {
  const texture = useTexture('/images/tea-right-wall.jpg');
  texture.colorSpace = SRGBColorSpace;
  return (
    <mesh position={[3.994, 1.85, -3.05]} rotation={[0, -Math.PI / 2, 0]}>
      <planeGeometry args={[9.55, 3.65]} />
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
function TeaHouseDoorway() {
  const doorWidth = 2.6;
  const postThickness = 0.22;
  const postDepth = 0.26;
  const leftPostX = -(doorWidth / 2 + postThickness / 2);
  const rightPostX = doorWidth / 2 + postThickness / 2;
  const z = 3.32;

  const transomSlatPositions = [
    -1.12, -0.9, -0.68, -0.45, -0.23, 0, 0.23, 0.45, 0.68, 0.9, 1.12,
  ];

  return (
    <group name="teahouse-doorway">
      {/* Continuous solid partition walls meeting outer walls with no gaps */}
      <Solid
        position={[-2.785, 1.85, z]}
        size={[2.53, 3.7, 0.18]}
        color={plaster}
        surface="plaster"
      />
      <Solid
        position={[2.785, 1.85, z]}
        size={[2.53, 3.7, 0.18]}
        color={plaster}
        surface="plaster"
      />
      <Solid
        position={[0, 3.56, z]}
        size={[doorWidth, 0.28, 0.18]}
        color={plaster}
        surface="plaster"
      />

      {/* Wall flank timber framing */}
      <Beam position={[-2.785, 0.06, z]} size={[2.53, 0.12, 0.22]} />
      <Beam position={[2.785, 0.06, z]} size={[2.53, 0.12, 0.22]} />
      <Beam position={[-2.785, 0.95, z]} size={[2.53, 0.07, 0.21]} />
      <Beam position={[2.785, 0.95, z]} size={[2.53, 0.07, 0.21]} />
      <Beam position={[-2.785, 2.48, z]} size={[2.53, 0.12, 0.22]} />
      <Beam position={[2.785, 2.48, z]} size={[2.53, 0.12, 0.22]} />
      <Beam position={[-2.785, 1.85, z]} size={[0.12, 3.7, 0.22]} />
      <Beam position={[2.785, 1.85, z]} size={[0.12, 3.7, 0.22]} />
      <Beam position={[-3.98, 1.85, z]} size={[0.14, 3.7, 0.22]} />
      <Beam position={[3.98, 1.85, z]} size={[0.14, 3.7, 0.22]} />
      <Beam position={[0, 3.64, z]} size={[8.2, 0.14, 0.26]} />

      {/* Main doorway jamb posts and base plinths */}
      {[leftPostX, rightPostX].map((x) => (
        <group key={x}>
          <Beam position={[x, 1.85, z]} size={[postThickness, 3.7, postDepth]} />
          <Solid
            position={[x, 0.045, z]}
            size={[postThickness + 0.04, 0.09, postDepth + 0.04]}
            color="#25150e"
          />
        </group>
      ))}

      {/* Doorway threshold with sliding runner tracks */}
      <Solid
        position={[0, 0.02, z]}
        size={[doorWidth + 0.02, 0.04, 0.28]}
        color="#352116"
      />
      <Solid
        position={[0, 0.041, z - 0.04]}
        size={[doorWidth, 0.004, 0.02]}
        color="#1f140d"
      />
      <Solid
        position={[0, 0.041, z + 0.04]}
        size={[doorWidth, 0.004, 0.02]}
        color="#1f140d"
      />

      {/* Main doorway lintel spanning across posts */}
      <Beam
        position={[0, 2.48, z]}
        size={[doorWidth + postThickness * 2 + 0.16, 0.14, 0.28]}
      />
      <Beam position={[-1.61, 2.48, z]} size={[0.04, 0.16, 0.3]} />
      <Beam position={[1.61, 2.48, z]} size={[0.04, 0.16, 0.3]} />

      {/* Transom (Ranma) with wooden lattice and washi paper */}
      <Beam position={[0, 3.38, z]} size={[doorWidth + 0.02, 0.08, 0.24]} />
      <Solid
        position={[0, 2.93, z]}
        size={[doorWidth, 0.78, 0.02]}
        color="#e8d1a7"
        surface="paper"
      />
      {transomSlatPositions.map((slatX) => (
        <Beam
          key={slatX}
          position={[slatX, 2.93, z]}
          size={[0.028, 0.78, 0.06]}
        />
      ))}
      <Beam position={[0, 2.93, z]} size={[doorWidth, 0.03, 0.065]} />

      {/* Open sliding shoji screen panels flanking the jambs */}
      <group position={[-1.46, 1.25, z - 0.04]}>
        <Solid
          position={[0, 0, 0]}
          size={[0.3, 2.38, 0.028]}
          color="#dfbe90"
          surface="paper"
        />
        <Beam position={[-0.135, 0, 0.01]} size={[0.03, 2.38, 0.04]} />
        <Beam position={[0.135, 0, 0.01]} size={[0.03, 2.38, 0.04]} />
        {[-0.8, -0.4, 0, 0.4, 0.8].map((sy) => (
          <Beam key={sy} position={[0, sy, 0.012]} size={[0.3, 0.024, 0.038]} />
        ))}
      </group>
      <group position={[1.46, 1.25, z + 0.04]}>
        <Solid
          position={[0, 0, 0]}
          size={[0.3, 2.38, 0.028]}
          color="#dfbe90"
          surface="paper"
        />
        <Beam position={[-0.135, 0, 0.01]} size={[0.03, 2.38, 0.04]} />
        <Beam position={[0.135, 0, 0.01]} size={[0.03, 2.38, 0.04]} />
        {[-0.8, -0.4, 0, 0.4, 0.8].map((sy) => (
          <Beam key={sy} position={[0, sy, 0.012]} size={[0.3, 0.024, 0.038]} />
        ))}
      </group>

      {/* Traditional Jasmine Dragon split noren curtain */}
      <group position={[0, 0, 0]}>
        <mesh position={[0, 2.38, z + 0.06]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.014, 0.014, doorWidth + 0.02, 12]} />
          <meshStandardMaterial color="#2d1c12" roughness={0.7} />
        </mesh>
        <Beam position={[-1.3, 2.38, z + 0.06]} size={[0.03, 0.04, 0.06]} />
        <Beam position={[1.3, 2.38, z + 0.06]} size={[0.03, 0.04, 0.06]} />

        {[-0.82, 0, 0.82].map((nx, idx) => (
          <group key={idx}>
            <Solid
              position={[nx, 2.38, z + 0.06]}
              size={[0.08, 0.04, 0.032]}
              color="#3c4c34"
              surface="cloth"
            />
            <Solid
              position={[nx, 2.2, z + 0.06]}
              size={[0.74, 0.34, 0.014]}
              color="#425339"
              surface="cloth"
            />
          </group>
        ))}

        {/* Jasmine Dragon Crest on center noren panel */}
        <mesh position={[0, 2.2, z + 0.068]}>
          <circleGeometry args={[0.075, 24]} />
          <meshStandardMaterial color="#eae2cb" roughness={0.9} />
        </mesh>
        <mesh position={[0, 2.2, z + 0.07]} rotation={[0, 0, 0.35]}>
          <ringGeometry args={[0.015, 0.045, 16]} />
          <meshStandardMaterial color="#425339" roughness={0.9} />
        </mesh>
      </group>

      {/* Warm doorway lantern on jamb */}
      <group position={[1.32, 1.94, z + 0.2]}>
        <Beam position={[-0.08, 0.12, -0.07]} size={[0.04, 0.04, 0.14]} />
        <Solid
          position={[0, 0.13, 0]}
          size={[0.18, 0.025, 0.18]}
          color="#25150e"
        />
        <mesh position={[0, 0, 0]} castShadow>
          <boxGeometry args={[0.14, 0.22, 0.14]} />
          <meshStandardMaterial
            color="#ffe5b0"
            emissive="#ffa834"
            emissiveIntensity={0.65}
            roughness={0.9}
          />
        </mesh>
        {[-0.07, 0.07].map((lx) =>
          [-0.07, 0.07].map((lz) => (
            <Beam
              key={`${lx}${lz}`}
              position={[lx, 0, lz]}
              size={[0.014, 0.22, 0.014]}
              color="#25150e"
            />
          )),
        )}
        <Solid
          position={[0, -0.12, 0]}
          size={[0.16, 0.025, 0.16]}
          color="#25150e"
        />
        <pointLight
          position={[0, 0, 0.04]}
          color="#ffcf8e"
          intensity={2.2}
          distance={4.2}
        />
      </group>
    </group>
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
      <TeaHouseDoorway />
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
      <Beam position={[-3.98, 1.85, -1.45]} size={[0.17, 3.7, 9.55]} />
      <Suspense fallback={null}>
        <RightWallBackdrop />
      </Suspense>
      {[-5.94, -1.53, 3.17].map((z) => (
        <Beam key={z} position={[3.91, 1.85, z]} size={[0.17, 3.7, 0.17]} />
      ))}
      {[-5.7, -3.4, -0.9, 1.7].map((z) => (
        <Beam key={z} position={[0, 3.47, z]} size={[8.1, 0.2, 0.29]} />
      ))}
      <Suspense fallback={null}>
        <TeaBackdrop />
      </Suspense>
      <Solid
        position={[0, 0.028, -2.5]}
        size={[3.58, 0.035, 3.7]}
        color="#b9a171"
        surface="cloth"
      />
      <Solid
        position={[0, 0.07, -2.5]}
        size={[3.07, 0.038, 3.2]}
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
      <Cup position={[-0.58, 0.68, -2.18]} color="#828069" />
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
