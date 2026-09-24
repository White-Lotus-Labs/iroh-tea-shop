import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import {
  CameraTravel,
  travelDuration,
  pourPose,
} from '../src/scene/motion/dynamics';
import { STATIONS } from '../src/scene/stations';
describe('camera travel', () => {
  it('adapts travel time and settles without a position or velocity discontinuity', () => {
    expect(travelDuration(0.1)).toBeLessThan(travelDuration(5));
    expect(travelDuration(5)).toBeLessThanOrEqual(1.5);
    const move = new CameraTravel(new Vector3(0, 2, 4), new Vector3(0, 1, 0));
    move.retarget(new Vector3(3, 1.8, 0), new Vector3(2, 1, -2));
    move.step(0.24);
    const position = move.position.clone(),
      velocity = move.velocity.clone();
    move.retarget(new Vector3(-0.5, 2, 4), new Vector3(-0.4, 1, -1));
    expect(move.position.distanceTo(position)).toBe(0);
    expect(move.velocity.distanceTo(velocity)).toBe(0);
    move.step(0.00001);
    expect(move.velocity.distanceTo(velocity)).toBeLessThan(0.002);
    for (let i = 0; i < 180; i++) move.step(1 / 60);
    expect(move.position.distanceTo(new Vector3(-0.5, 2, 4))).toBeLessThan(
      1e-8,
    );
    expect(move.velocity.length()).toBe(0);
    expect(move.active).toBe(false);
  });
  it('keeps every station path inside the two rooms and through the doorway', () => {
    for (const a of STATIONS)
      for (const b of STATIONS) {
        const move = new CameraTravel(
          new Vector3(...a.position),
          new Vector3(...a.target),
        );
        move.retarget(new Vector3(...b.position), new Vector3(...b.target));
        for (let i = 0; i < 100; i++) {
          move.step(1 / 60);
          const p = move.position;
          expect(Math.abs(p.x)).toBeLessThan(3.8);
          expect(p.z).toBeGreaterThan(-0.3);
          expect(p.z).toBeLessThan(10.3);
          expect(p.y).toBeGreaterThan(1.4); // Above the counter and tea table.
          if (p.z > 3.28 && p.z < 3.52) {
            expect(Math.abs(p.x)).toBeLessThan(1.12); // Inside the opening.
          }
        }
      }
  });
  it('reduced motion arrives exactly with no remaining motion', () => {
    const move = new CameraTravel(new Vector3(), new Vector3());
    move.retarget(new Vector3(1, 2, 3), new Vector3(0, 1, 0));
    move.finish();
    expect(move.position.toArray()).toEqual([1, 2, 3]);
    expect(move.active).toBe(false);
    expect(move.velocity.length()).toBe(0);
  });
});
describe('restrained procedural gestures', () => {
  it('stages the pour before the stream and fully returns to rest', () => {
    expect(pourPose(0)).toEqual({ tilt: 0, stream: 0 });
    expect(pourPose(0.08).tilt).toBe(0);
    expect(pourPose(0.5).tilt).toBeGreaterThan(0.2);
    expect(pourPose(0.5).stream).toBeGreaterThan(0);
    expect(pourPose(1.4)).toEqual({ tilt: 0, stream: 0 });
  });
});
it('brakes inherited momentum before an interrupted return overshoots the entrance', () => {
  const shelf = STATIONS.find((s) => s.id === 'Shelf')!,
    entrance = STATIONS[0],
    counter = STATIONS[1];
  const move = new CameraTravel(
    new Vector3(...shelf.position),
    new Vector3(...shelf.target),
  );
  move.retarget(
    new Vector3(...entrance.position),
    new Vector3(...entrance.target),
  );
  move.step(1.05);
  move.retarget(
    new Vector3(...counter.position),
    new Vector3(...counter.target),
  );
  for (let i = 0; i < 120; i++) {
    move.step(1 / 60);
    expect(move.position.z).toBeLessThan(entrance.position[2] + 0.1);
  }
});
