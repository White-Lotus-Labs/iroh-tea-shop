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
    label: 'Tea table',
    purpose: 'Notice',
    position: [0.1, 1.58, 1.1],
    target: [2.6, 0.9, -3.23],
    hotspot: [1.1, 0.9, -2.35],
  },
  {
    id: 'AvatarSeat',
    label: 'Host',
    purpose: 'Reflect',
    position: [0.5, 1.48, 0.38],
    target: [3.45, 1.05, -3.52],
    hotspot: [2.2, 1.95, -3.52],
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
  position: [0.65, 1.58, -5.1] as Point,
  target: [2.7, 1.43, -4.55] as Point,
};

export const SHELF_FOCUS = {
  position: [0.95, 1.55, -5.1] as Point,
  target: [3.25, 1.43, -4.55] as Point,
};
