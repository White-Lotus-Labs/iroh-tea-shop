'use client';
import { Sketchbook } from './Sketchbook';

// Sketchbook is the only waiting room. Invitation / Tanzaku stay on disk, unmounted.
export function WaitingVersions({ reduced }: { reduced: boolean }) {
  return <Sketchbook reduced={reduced} />;
}
