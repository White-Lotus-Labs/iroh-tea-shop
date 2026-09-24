import { CatmullRomCurve3, Vector3 } from 'three';
import { Cup } from './Ceramics';
import { Solid, SurfaceMaterial } from './Surfaces';

function TeaJar({
  position,
  color,
  lid = '#342b21',
}: {
  position: [number, number, number];
  color: string;
  lid?: string;
}) {
  return (
    <group position={position}>
      <mesh position={[0, 0.15, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.145, 0.13, 0.28, 20]} />
        <meshPhysicalMaterial color={color} roughness={0.46} clearcoat={0.28} />
      </mesh>
      <mesh position={[0, 0.306, 0]} castShadow>
        <cylinderGeometry args={[0.153, 0.15, 0.045, 20]} />
        <meshStandardMaterial color={lid} roughness={0.6} metalness={0.15} />
      </mesh>
      <mesh position={[-0.145, 0.175, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[0.09, 0.12]} />
        <meshStandardMaterial color="#d2bb8d" roughness={1} />
      </mesh>
    </group>
  );
}

function TeaTin({
  position,
  color,
}: {
  position: [number, number, number];
  color: string;
}) {
  return (
    <group position={position}>
      <mesh position={[0, 0.17, 0]} castShadow>
        <cylinderGeometry args={[0.11, 0.11, 0.32, 24]} />
        <meshStandardMaterial color={color} metalness={0.42} roughness={0.43} />
      </mesh>
      <mesh position={[0, 0.339, 0]} castShadow>
        <cylinderGeometry args={[0.116, 0.116, 0.027, 24]} />
        <meshStandardMaterial
          color="#ac8654"
          metalness={0.6}
          roughness={0.35}
        />
      </mesh>
      <mesh position={[-0.112, 0.19, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[0.105, 0.145]} />
        <meshStandardMaterial color="#dfcfaa" roughness={0.91} />
      </mesh>
    </group>
  );
}

function TeaBox({
  position,
  color,
}: {
  position: [number, number, number];
  color: string;
}) {
  return (
    <group position={position}>
      <Solid position={[0, 0.11, 0]} size={[0.21, 0.22, 0.28]} color={color} />
      <Solid
        position={[0, 0.235, 0]}
        size={[0.225, 0.025, 0.3]}
        color="#b48d57"
      />
      <Solid
        position={[-0.111, 0.13, 0]}
        size={[0.009, 0.105, 0.13]}
        color="#d5bd89"
        surface="paper"
      />
    </group>
  );
}

function Branch({ position }: { position: [number, number, number] }) {
  const stems: [number, number, number][][] = [
    [
      [0, 0.23, 0],
      [-0.04, 0.48, 0.06],
      [-0.12, 0.68, 0.1],
    ],
    [
      [0, 0.23, 0],
      [0.02, 0.51, 0.03],
      [0.12, 0.74, -0.05],
    ],
    [
      [0, 0.27, 0],
      [0.07, 0.42, -0.06],
      [0.19, 0.55, -0.1],
    ],
  ];
  return (
    <group position={position}>
      <mesh position={[0, 0.12, 0]} castShadow>
        <sphereGeometry args={[0.15, 20, 14]} />
        <meshPhysicalMaterial
          color="#2d4841"
          roughness={0.55}
          clearcoat={0.3}
        />
      </mesh>
      <mesh position={[0, 0.23, 0]} castShadow>
        <cylinderGeometry args={[0.075, 0.09, 0.12, 18]} />
        <meshPhysicalMaterial
          color="#2d4841"
          roughness={0.55}
          clearcoat={0.3}
        />
      </mesh>
      {stems.map((points, index) => (
        <group key={index}>
          <mesh castShadow>
            <tubeGeometry
              args={[
                new CatmullRomCurve3(points.map((p) => new Vector3(...p))),
                12,
                0.008,
                5,
                false,
              ]}
            />
            <meshStandardMaterial color="#6d6544" roughness={1} />
          </mesh>
          <mesh
            position={points[2]}
            rotation={[0.3, index * 0.75, 0.45]}
            castShadow
          >
            <sphereGeometry args={[0.12, 10, 7]} />
            <meshStandardMaterial
              color={index === 1 ? '#758457' : '#566b46'}
              roughness={0.9}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function DisplayPot({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.16, 0]} scale={[0.2, 0.13, 0.18]} castShadow>
        <sphereGeometry args={[1, 24, 16]} />
        <meshPhysicalMaterial
          color="#536354"
          roughness={0.4}
          clearcoat={0.35}
        />
      </mesh>
      <mesh position={[0, 0.295, 0]} castShadow>
        <cylinderGeometry args={[0.075, 0.095, 0.035, 18]} />
        <meshPhysicalMaterial
          color="#455a50"
          roughness={0.42}
          clearcoat={0.35}
        />
      </mesh>
      <mesh position={[-0.21, 0.22, 0]} rotation={[0, 0, -0.67]} castShadow>
        <cylinderGeometry args={[0.045, 0.022, 0.22, 12]} />
        <meshPhysicalMaterial
          color="#536354"
          roughness={0.4}
          clearcoat={0.35}
        />
      </mesh>
      <mesh
        position={[0.2, 0.275, 0]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
      >
        <torusGeometry args={[0.12, 0.027, 8, 20]} />
        <meshPhysicalMaterial
          color="#536354"
          roughness={0.4}
          clearcoat={0.35}
        />
      </mesh>
    </group>
  );
}

/** Joinery and tea objects mounted to the chamber's actual right wall. */
export function TeaShelf() {
  return (
    <group position={[3.65, 0, -3.72]} name="right-wall-tea-shelf">
      <Solid
        position={[0.3, 1.83, 0]}
        size={[0.08, 3.25, 4.25]}
        color="#3a261b"
      />
      <Solid
        position={[0.26, 1.83, 0]}
        size={[0.018, 2.98, 3.9]}
        color="#6a4630"
      />
      {[-1.99, 0, 1.99].map((z) => (
        <group key={z}>
          <Solid
            position={[-0.05, 1.84, z]}
            size={[0.57, 3.2, 0.115]}
            color="#432b1d"
          />
          <Solid
            position={[-0.35, 1.84, z]}
            size={[0.018, 2.85, 0.022]}
            color="#aa8050"
          />
        </group>
      ))}
      {[0.5, 1.25, 2.03, 2.83].map((y) => (
        <group key={y}>
          <Solid
            position={[-0.17, y, 0]}
            size={[0.88, 0.09, 4.12]}
            color="#835938"
          />
          <Solid
            position={[-0.62, y + 0.012, 0]}
            size={[0.018, 0.025, 4.08]}
            color="#c69a5d"
          />
          {[-1.55, -0.5, 0.55, 1.55].map((z) => (
            <Solid
              key={z}
              position={[-0.21, y - 0.19, z]}
              size={[0.09, 0.32, 0.095]}
              color="#432b1d"
            />
          ))}
        </group>
      ))}
      <TeaJar position={[-0.28, 0.55, -1.55]} color="#6b735a" />
      <TeaJar position={[-0.28, 0.55, -1.08]} color="#8b6c49" />
      <TeaBox position={[-0.25, 0.55, -0.46]} color="#75563a" />
      <TeaBox position={[-0.25, 0.55, -0.14]} color="#424b40" />
      <Cup position={[-0.28, 0.62, 0.42]} color="#b9ae8b" />
      <Cup position={[-0.28, 0.62, 0.69]} color="#73877b" />
      <TeaJar position={[-0.28, 0.55, 1.08]} color="#414e42" />
      <TeaJar position={[-0.28, 0.55, 1.54]} color="#9b7656" />
      <TeaTin position={[-0.28, 1.3, -1.45]} color="#414f43" />
      <TeaTin position={[-0.28, 1.3, -1.12]} color="#6b553e" />
      <Cup position={[-0.28, 1.37, 0.25]} color="#b8a77f" />
      <Cup position={[-0.28, 1.37, 0.49]} color="#627469" />
      <TeaBox position={[-0.25, 1.3, 0.65]} color="#5b4935" />
      <TeaBox position={[-0.25, 1.3, 0.96]} color="#786143" />
      <TeaBox position={[-0.25, 1.3, 1.27]} color="#4b4939" />
      <TeaJar position={[-0.25, 2.08, -1.35]} color="#465c58" lid="#b38a55" />
      <TeaJar position={[-0.25, 2.08, -0.85]} color="#b18b62" />
      <DisplayPot position={[-0.23, 2.08, -0.15]} />
      <TeaTin position={[-0.25, 2.08, 0.45]} color="#3e4944" />
      <TeaTin position={[-0.25, 2.08, 0.78]} color="#7c5b3a" />
      <Cup position={[-0.28, 2.15, 1.3]} color="#d4be99" />
      <Cup position={[-0.28, 2.15, 1.56]} color="#71876d" />
      <Branch position={[-0.28, 2.87, -1.24]} />
      <TeaJar position={[-0.25, 2.87, -0.4]} color="#6f664d" />
      <TeaBox position={[-0.25, 2.87, 0.5]} color="#5a4831" />
      <TeaBox position={[-0.25, 2.87, 0.86]} color="#76583a" />
      <mesh position={[-0.27, 3.16, 1.53]} castShadow>
        <cylinderGeometry args={[0.11, 0.11, 0.38, 4]} />
        <SurfaceMaterial surface="paper" color="#f5d7a0" />
      </mesh>
      <pointLight
        position={[-0.4, 3.04, 1.53]}
        color="#ffbe71"
        intensity={4.5}
        distance={3.5}
      />
      <Solid
        position={[-0.37, 3.38, 1.53]}
        size={[0.27, 0.025, 0.27]}
        color="#48311f"
      />
      <Solid
        position={[-0.37, 2.96, 1.53]}
        size={[0.27, 0.025, 0.27]}
        color="#48311f"
      />
    </group>
  );
}
