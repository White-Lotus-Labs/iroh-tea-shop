import type { Station } from '../shared/contracts';
export type Point = [number,number,number];
export const STATIONS: {id:Station;label:string;purpose:string;position:Point;target:Point;hotspot:Point}[] = [
  {id:'Entrance',label:'Entrance',purpose:'Arrive',position:[0,2.2,4.2],target:[0,1,-1],hotspot:[0,0.2,3.1]},
  {id:'Counter',label:'Counter',purpose:'Pour',position:[-1.8,1.9,2.2],target:[-2,1,-1.4],hotspot:[-2.3,1.5,-1.4]},
  {id:'TeaTable',label:'Tea table',purpose:'Notice',position:[0,1.8,2.7],target:[0,0.6,-0.2],hotspot:[0,0.85,-0.3]},
  {id:'AvatarSeat',label:'Host',purpose:'Reflect',position:[0.6,1.65,2],target:[2,1,-0.8],hotspot:[2,1.95,-0.8]},
  {id:'Shelf',label:'Shelf',purpose:'Keep',position:[1.2,1.8,0.7],target:[2.6,1.5,-2.5],hotspot:[2.65,2.1,-2.5]},
];
