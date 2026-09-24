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
    position: [0.9, 1.67, 9.42],
    target: [-3.05, 1.22, 6.67],
    hotspot: [-2.3, 1.5, 6.1],
  },
  {
    id: 'TeaTable',
    label: 'Tea table',
    purpose: 'Notice',
    position: [0.1, 1.56, 0.66],
    target: [0.12, 0.9, -3.23],
    hotspot: [0, 0.84, -2.2],
  },
  {
    id: 'AvatarSeat',
    label: 'Host',
    purpose: 'Reflect',
    position: [0.8, 1.48, -0.1],
    target: [2.2, 1.05, -3.52],
    hotspot: [2.2, 1.95, -3.52],
  },
  {
    id: 'Shelf',
    label: 'Shelf',
    purpose: 'Keep',
    position: [1.03, 1.59, -0.1],
    target: [2.95, 1.65, -5.8],
    hotspot: [2.9, 2.1, -5.8],
  },
];
