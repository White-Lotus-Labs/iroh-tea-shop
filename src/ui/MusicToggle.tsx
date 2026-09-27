'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BACKGROUND_MUSIC_SRC,
  readBackgroundMusic,
  writeBackgroundMusic,
} from './backgroundMusic';
import './MusicToggle.css';

export function MusicToggle({ floating = false }: { floating?: boolean }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const want = useRef(false);
  const missing = useRef(false);
  const attached = useRef(false);
  const [on, setOn] = useState(false);

  const ensure = useCallback(() => {
    if (audio.current) return audio.current;
    const element = new Audio();
    element.loop = true;
    element.preload = 'none';
    element.addEventListener('error', () => {
      // One failure is enough: clearing src would resolve to the page URL and
      // fire another error.
      if (missing.current) return;
      missing.current = true;
      element.pause();
    });
    audio.current = element;
    return element;
  }, []);

  const play = useCallback(() => {
    if (!want.current || missing.current) return;
    const element = ensure();
    if (!attached.current) {
      attached.current = true;
      element.src = BACKGROUND_MUSIC_SRC;
    }
    void element.play().catch(() => {
      /* Autoplay can reject until a gesture. A later gesture retries once. */
    });
  }, [ensure]);

  const setEnabled = useCallback(
    (next: boolean) => {
      want.current = next;
      setOn(next);
      writeBackgroundMusic(window.localStorage, next);
      const element = ensure();
      if (!next) {
        element.pause();
        return;
      }
      play();
    },
    [ensure, play],
  );

  useEffect(() => {
    const saved = readBackgroundMusic(window.localStorage);
    if (!saved) return;
    want.current = true;
    setOn(true);
  }, []);

  useEffect(() => {
    if (!on) return;
    play();
    const onGesture = () => play();
    window.addEventListener('pointerdown', onGesture);
    window.addEventListener('keydown', onGesture);
    return () => {
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
    };
  }, [on, play]);

  useEffect(() => {
    const onVisibility = () => {
      const element = audio.current;
      if (!element) return;
      if (document.hidden) {
        element.pause();
        return;
      }
      if (want.current) play();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [play]);

  useEffect(
    () => () => {
      audio.current?.pause();
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
