import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { temaeLayout } from '../src/scene/props/Temae';

function segmentDistance(point: Vector3, a: Vector3, b: Vector3) {
  const ab = b.clone().sub(a),
    t = Math.min(1, Math.max(0, point.clone().sub(a).dot(ab) / ab.lengthSq()));
  return point.distanceTo(a.clone().addScaledVector(ab, t));
}

describe('temae tools', () => {
  const layout = temaeLayout();

  it('seats the bowl, jar and lid rest on the boards', () => {
    for (const at of [layout.bowlAt, layout.jarAt, layout.restAt]) {
      expect(at[1]).toBe(layout.seat);
      expect(at[1]).toBeGreaterThan(layout.floorTop);
      expect(at[1]).toBeLessThan(0.02);
    }
  });

  it('lays the ladle handle on the kensui lip', () => {
    const gap = segmentDistance(layout.lip, layout.joint, layout.tip);
    expect(gap).toBeLessThanOrEqual(layout.cordRadius);
    expect(gap).toBeGreaterThan(layout.cordRadius - 0.003);
    const low = Math.min(layout.joint.y, layout.tip.y) - layout.cordRadius;
    expect(low).toBeGreaterThan(layout.floorTop);
  });

  it('sinks the fukusa into the tatami and shades the mat around it', () => {
    const clothBottom = layout.cloth[1] - layout.clothSize[1] / 2,
      clothTop = layout.cloth[1] + layout.clothSize[1] / 2,
      foldBottom = layout.fold[1] - layout.foldSize[1] / 2,
      corner = Math.hypot(layout.clothSize[0] / 2, layout.clothSize[2] / 2);
    expect(clothBottom).toBeCloseTo(layout.clothBottom);
    expect(clothBottom).toBeLessThanOrEqual(layout.tatami);
    expect(clothBottom).toBeGreaterThan(layout.tatami - 0.004);
    expect(foldBottom).toBeLessThanOrEqual(clothTop);
    expect(foldBottom).toBeGreaterThan(clothBottom);
    expect(layout.shadow[1]).toBeGreaterThan(layout.tatami);
    expect(layout.shadow[1]).toBeLessThan(layout.tatami + 0.004);
    expect(layout.shadowInner).toBeGreaterThanOrEqual(corner);
    expect(layout.shadowOuter).toBeGreaterThan(layout.shadowInner);
  });
});
