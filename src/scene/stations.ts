import type { Station } from '../shared/contracts';
export type Point = [number, number, number];
export const STATIONS: {
  id: Station;
  label: string;
  purpose: string;
  position: Point;
  target: Point;
  hotspot: Point;
}[] = [
  {
    id: 'Entrance',
    label: 'Waiting room',
    purpose: 'Arrive',
    position: [0.7, 1.7, 10.15],
    target: [-2.8, 1.25, 6.7],
    hotspot: [0, 0.2, 10.1],
  },
  {
    id: 'Counter',
    label: 'Counter',
    purpose: 'Pour',
    position: [0.15, 1.67, 7.65],
    target: [-1.43, 1.37, 2.92],
    hotspot: [-0.95, 1.5, 6.07],
  },
  {
    id: 'TeaTable',
    label: 'Observatorium',
    purpose: 'The flows of chains',
    position: [-1.2, 1.45, -1.4],
    target: [-2.85, 0.8, -3.15],
    hotspot: [-2.85, 1.3, -3.15],
  },
  {
    id: 'AvatarSeat',
    label: 'Host',
    purpose: 'Reflect',
    position: [0.35, 1.48, 0.45],
    target: [1.25, 1.05, -3.55],
    hotspot: [0.0, 1.95, -3.56],
  },
  {
    id: 'Shelf',
    label: 'Shelf',
    purpose: 'Observe',
    position: [0.28, 1.68, 0.65],
    target: [2, 1.2, -4],
    hotspot: [3.25, 1.43, -4.55],
  },
];

export const SHELF_APPROACH = {
  position: [1.55, 1.58, -5.1] as Point,
  target: [2.7, 1.43, -4.55] as Point,
};

export const SHELF_FOCUS = {
  position: [0.95, 1.55, -5.1] as Point,
  target: [3.25, 1.43, -4.55] as Point,
};
