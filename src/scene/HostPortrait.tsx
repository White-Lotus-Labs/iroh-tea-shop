import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import { Group, SRGBColorSpace } from 'three';

/** The reference-matched host occupies a plane in the 3D room; subtle body
 * movement keeps the greeting alive without pulling attention from reading. */
export function HostPortrait({ reduced }: { reduced: boolean }) {
  const image = useTexture('/images/tea-host.png');
  image.colorSpace = SRGBColorSpace;
  const portrait = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!portrait.current) return;
    portrait.current.position.y = reduced
      ? 0
      : Math.sin(clock.elapsedTime * 0.8) * 0.003;
  });
  return (
    <group position={[2.22, 0.17, -3.52]} name="tea-host">
      <group ref={portrait}>
        <mesh position={[0, 0.85, 0]} renderOrder={1}>
          <planeGeometry args={[1.91, 2]} />
          <meshBasicMaterial
            map={image}
            transparent
            alphaTest={0.08}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  );
}
