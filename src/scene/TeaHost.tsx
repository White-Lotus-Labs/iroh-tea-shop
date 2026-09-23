export function TeaHost() {
  return (
    <group position={[2, 0, -0.8]}>
      <mesh position={[0, 0.17, 0]} scale={[0.8, 0.2, 0.65]}>
        <sphereGeometry args={[1, 24, 12]} />
        <meshStandardMaterial color="#697558" roughness={1} />
      </mesh>
      <mesh position={[0, 0.65, 0]}>
        <coneGeometry args={[0.47, 1, 24]} />
        <meshStandardMaterial color="#706346" roughness={1} />
      </mesh>
      <mesh position={[0, 1.29, 0]}>
        <sphereGeometry args={[0.25, 24, 16]} />
        <meshStandardMaterial color="#d8af86" roughness={0.95} />
      </mesh>
      <mesh position={[0, 1.39, -0.06]} scale={[1, 1, 0.9]}>
        <sphereGeometry args={[0.25, 20, 12]} />
        <meshStandardMaterial color="#ded4bd" roughness={1} />
      </mesh>
      <mesh position={[0, 1.3, 0.105]} scale={[1, 0.9, 0.65]}>
        <sphereGeometry args={[0.215, 20, 12]} />
        <meshStandardMaterial color="#d8af86" roughness={1} />
      </mesh>
      <mesh position={[0, 1.1, 0.18]} rotation={[0.12, 0, Math.PI]}>
        <coneGeometry args={[0.16, 0.29, 20]} />
        <meshStandardMaterial color="#ded4bd" roughness={1} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * 0.075, 1.32, 0.24]} scale={[1, 0.3, 0.5]}>
            <sphereGeometry args={[0.023, 12, 8]} />
            <meshStandardMaterial color="#413728" />
          </mesh>
          <mesh
            position={[side * 0.29, 0.76, 0.16]}
            rotation={[0, 0, side * 0.5]}
          >
            <capsuleGeometry args={[0.12, 0.36, 6, 12]} />
            <meshStandardMaterial color="#706346" roughness={1} />
          </mesh>
          <mesh position={[side * 0.22, 0.6, 0.3]}>
            <sphereGeometry args={[0.105, 16, 10]} />
            <meshStandardMaterial color="#d8af86" roughness={1} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
