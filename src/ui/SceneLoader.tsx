'use client';
import { useEffect, useRef, useState } from 'react';

const LEAVE_MS = 900;
// Higher is snappier; the displayed value eases toward its goal each frame.
const EASE_RATE = 2.4;

function lineFor(progress: number) {
  if (progress < 30) return 'Warming the water…';
  if (progress < 60) return 'Lighting the lanterns…';
  if (progress < 90) return 'Setting out the cups…';
  return 'The room is almost ready.';
}

export function SceneLoader({
  ready,
  progress,
  reduced,
  onReveal,
}: {
  ready: boolean;
  progress: number;
  reduced: boolean;
  onReveal: () => void;
}) {
  const goal = ready ? 100 : Math.min(progress, 99);
  const target = useRef(goal);
  const [shown, setShown] = useState(0);
  const [finished, setFinished] = useState(false);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    target.current = goal;
  }, [goal]);
  useEffect(() => {
    if (reduced) return;
    let last = performance.now();
    let value = 0;
    let frame = 0;
    const tick = (now: number) => {
      const dt = Math.min(now - last, 64) / 1000;
      last = now;
      value += (target.current - value) * (1 - Math.exp(-dt * EASE_RATE));
      if (target.current - value < 0.15) value = target.current;
      setShown(value);
      if (value >= 100) {
        setFinished(true);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reduced]);
  const leaving = reduced ? ready : finished;
  useEffect(() => {
    if (!leaving) return;
    onReveal();
    const timer = window.setTimeout(
      () => setGone(true),
      reduced ? 0 : LEAVE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [leaving, reduced, onReveal]);
  if (gone) return null;
  const value = reduced ? goal : shown;
  const percent = Math.round(value);
  return (
    <div
      className={`scene-loader${leaving ? ' is-leaving' : ''}`}
      aria-hidden={leaving || undefined}
    >
      <div className="scene-loader-content">
        <span className="scene-loader-mark" aria-hidden="true">
          <span className="scene-loader-ring" />◒
        </span>
        <div className="eyebrow">TEA AFTER POUR</div>
        <p className="scene-loader-line" role="status" aria-live="polite">
          {lineFor(percent)}
        </p>
        <div
          className="scene-loader-bar"
          role="progressbar"
          aria-label="Preparing the tea room"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <span style={{ transform: `scaleX(${value / 100})` }} />
        </div>
        <small className="scene-loader-percent">{percent}%</small>
      </div>
    </div>
  );
}
