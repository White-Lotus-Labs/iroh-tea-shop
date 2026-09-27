'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  backgroundMusicSources,
  loopBounds,
  readBackgroundMusic,
  writeBackgroundMusic,
} from './backgroundMusic';
import './MusicToggle.css';

const VOLUME = 0.7;
// Time constant for gain changes; a hard cut clicks.
const FADE = 0.35;

type Player = { context: AudioContext; gain: GainNode };

/**
 * Web Audio, not <audio loop>: a buffer source loops sample-exact, where a
 * media element seeks back and leaves a gap. The file is fetched on the first
 * gesture that can start sound, never before.
 */
export function MusicToggle({ floating = false }: { floating?: boolean }) {
  const player = useRef<Player | null>(null);
  const loading = useRef(false);
  const want = useRef(false);
  const [on, setOn] = useState(false);

  const fade = useCallback(() => {
    const current = player.current;
    if (!current) return;
    const { context, gain } = current;
    if (want.current && !document.hidden) void context.resume();
    gain.gain.setTargetAtTime(
      want.current ? VOLUME : 0,
      context.currentTime,
      FADE,
    );
    if (want.current) return;
    window.setTimeout(() => {
      if (!want.current) void context.suspend();
    }, FADE * 4000);
  }, []);

  // Must run inside a user gesture: that is what lets the context start.
  const start = useCallback(() => {
    if (!want.current) return;
    if (player.current) return fade();
    if (loading.current) return;
    loading.current = true;
    const context = new AudioContext();
    const gain = context.createGain();
    gain.gain.value = 0;
    gain.connect(context.destination);
    const probe = document.createElement('audio');
    void (async () => {
      for (const src of backgroundMusicSources((type) =>
        probe.canPlayType(type),
      )) {
        try {
          const response = await fetch(src);
          if (!response.ok) continue;
          const buffer = await context.decodeAudioData(
            await response.arrayBuffer(),
          );
          const source = context.createBufferSource();
          const bounds = loopBounds(
            buffer.getChannelData(0),
            buffer.sampleRate,
          );
          source.buffer = buffer;
          source.loop = true;
          source.loopStart = bounds.start;
          source.loopEnd = bounds.end;
          source.connect(gain);
          source.start(0, bounds.start);
          player.current = { context, gain };
          loading.current = false;
          return fade();
        } catch {
          /* Try the next format. */
        }
      }
      // Nothing decoded: show the toggle as off rather than silently on.
      loading.current = false;
      want.current = false;
      setOn(false);
      void context.close();
    })();
  }, [fade]);

  const setEnabled = useCallback(
    (next: boolean) => {
      want.current = next;
      setOn(next);
      writeBackgroundMusic(window.localStorage, next);
      if (next) start();
      else fade();
    },
    [fade, start],
  );

  useEffect(() => {
    if (!readBackgroundMusic(window.localStorage)) return;
    want.current = true;
    setOn(true);
  }, []);

  // A saved "on" waits for the guest's first gesture anywhere on the page.
  useEffect(() => {
    if (!on || player.current) return;
    const onGesture = () => start();
    window.addEventListener('click', onGesture);
    window.addEventListener('keydown', onGesture);
    return () => {
      window.removeEventListener('click', onGesture);
      window.removeEventListener('keydown', onGesture);
    };
  }, [on, start]);

  useEffect(() => {
    const onVisibility = () => {
      const current = player.current;
      if (!current) return;
      if (document.hidden) void current.context.suspend();
      else fade();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [fade]);

  useEffect(
    () => () => {
      void player.current?.context.close();
    },
    [],
  );

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const button = (
    <button
      type="button"
      className={floating ? 'music-toggle is-floating' : 'music-toggle'}
      aria-pressed={on}
      aria-label="Background music"
      onClick={() => setEnabled(!on)}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M6.2 3.2v6.1a2.1 2.1 0 1 1-1.2-1.9V4.4l6-1.3v5.1a2.1 2.1 0 1 1-1.2-1.9V3.2L6.2 4.5V3.2Z" />
        {!on && <path fill="none" d="M2.2 2.2 13.8 13.8" />}
      </svg>
    </button>
  );

  // The top bar's backdrop-filter traps a fixed descendant under the waiting
  // room. Portal only after mount so the server and first client render match.
  if (floating && mounted) return createPortal(button, document.body);
  return button;
}
