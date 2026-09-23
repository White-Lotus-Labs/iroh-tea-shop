import { useEffect, useMemo } from 'react';
import { CanvasTexture, SRGBColorSpace } from 'three';
import type { Station } from '../shared/contracts';
import { STATIONS, type Point } from './stations';
function StationSign({
  label,
  position,
  onClick,
  disabled,
}: {
  label: string;
  position: Point;
  onClick: () => void;
  disabled: boolean;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#f3e9d5';
    context.beginPath();
    context.roundRect(4, 4, 504, 120, 60);
    context.fill();
    context.strokeStyle = '#9b8f73';
    context.lineWidth = 4;
    context.stroke();
    context.fillStyle = '#25352d';
    context.font = '32px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(`${label}  ↗`, 256, 66);
    const result = new CanvasTexture(canvas);
    result.colorSpace = SRGBColorSpace;
    return result;
  }, [label]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <sprite
      position={position}
      scale={[0.17, 0.0425, 1]}
      onClick={(event) => {
        event.stopPropagation();
        if (!disabled) onClick();
      }}
    >
      <spriteMaterial
        map={texture}
        sizeAttenuation={false}
        transparent
        depthTest={false}
        toneMapped={false}
      />
    </sprite>
  );
}
export function Hotspots({
  station,
  onNavigate,
  typing,
}: {
  station: Station;
  onNavigate: (s: Station) => void;
  typing: boolean;
}) {
  return (
    <>
      {STATIONS.filter((s) => s.id !== station).map((s) => (
        <StationSign
          key={s.id}
          label={s.label}
          position={s.hotspot}
          disabled={typing}
          onClick={() => onNavigate(s.id)}
        />
      ))}
    </>
  );
}
