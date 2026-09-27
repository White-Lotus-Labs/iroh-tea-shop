'use client';
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import type { Station } from '../shared/contracts';
import { createDockSpring } from './dockSpring';
import './StationDock.css';

type DockEntry = {
  id: Station;
  label: string;
  caption: string;
  seal: string;
  glyph: ReactNode;
};

const DOCK: DockEntry[] = [
  {
    id: 'Entrance',
    label: 'Waiting room',
    caption: 'About Tea Shop',
    seal: '茶',
    // Pavilion with upturned eaves.
    glyph: (
      <>
        <path d="M8 1.2v1.4M1.2 5.8Q4.4 5.5 5.6 2.6h4.8q1.2 2.9 4.4 3.2M2.6 6.3h10.8" />
        <path d="M4.3 6.3v6.5M11.7 6.3v6.5M4.3 8.4h7.4M2.4 12.8h11.2M3.4 14.4h9.2" />
      </>
    ),
  },
  {
    id: 'Counter',
    label: 'Counter',
    caption: 'Thesis Desk',
    seal: '论',
    // Brush resting over a written line.
    glyph: (
      <>
        <path d="M13.2 1.6 8.4 6.4" />
        <path d="M8.4 6.4c-1 1-1.9 2.6-2.1 4 1.4-.2 3-1.1 4-2.1Z" />
        <path d="M1.8 13.8h12.4M2.6 11.4h1.8" />
      </>
    ),
  },
  {
    id: 'AvatarSeat',
    label: 'Host',
    caption: 'Talk to Uncle',
    seal: '谈',
    // Yixing teapot.
    glyph: (
      <>
        <path d="M3.7 8.4a4.3 3.9 0 0 0 8.6 0Z" />
        <path d="M5.8 8.4c.3-1.1 1.1-1.7 2.2-1.7s1.9.6 2.2 1.7" />
        <circle cx="8" cy="5.9" r=".7" />
        <path d="M4 9.6C2.8 9.4 2.1 8.4 1.5 7.1M12 8.9c1.9-.6 2.8.5 2.4 1.6-.3.9-1.3 1.4-2.8 1.3M6 12.9h4" />
      </>
    ),
  },
  {
    id: 'Shelf',
    label: 'Shelf',
    caption: 'Leaderboard',
    seal: '榜',
    // Hanging scroll with ranked rows.
    glyph: (
      <>
        <path d="M2.6 2.2h10.8M2.6 13.8h10.8" />
        <rect x="4.2" y="2.2" width="7.6" height="11.6" />
        <path d="M6 5.4h.01M6 8h.01M6 10.6h.01M7.6 5.4h2.6M7.6 8h2.6M7.6 10.6h2.6" />
      </>
    ),
  },
  {
    // The TeaTable station frames the orrery.
    id: 'TeaTable',
    label: 'Observatorium',
    caption: 'The flows of chains',
    seal: '星',
    // Armillary sphere on a stand.
    glyph: (
      <>
        <circle cx="8" cy="7" r="5" />
        <ellipse cx="8" cy="7" rx="5" ry="1.8" transform="rotate(-24 8 7)" />
        <circle cx="8" cy="7" r="1.1" />
        <circle cx="12.3" cy="4.9" r=".7" />
        <path d="M8 12v1.6M5.4 14.4h5.2" />
      </>
    ),
  },
];

export function StationDock({
  station,
  reduced,
  onNavigate,
}: {
  station: Station;
  reduced: boolean;
  onNavigate: (station: Station) => void;
}) {
  const navRef = useRef<HTMLElement>(null);
  const dock = useRef<ReturnType<typeof createDockSpring>>(null);
  useLayoutEffect(() => {
    const controller = createDockSpring(navRef.current!, reduced);
    dock.current = controller;
    return controller.destroy;
  }, [reduced]);
  useLayoutEffect(() => dock.current?.update(), [station]);
  const active = DOCK.find((entry) => entry.id === station);

  return (
    <nav ref={navRef} className="station-dock" aria-label="Tea room stations">
      <span className="station-dock__roller" aria-hidden="true" />
      <div className="station-dock__paper">
        {DOCK.map((entry) => {
          const isActive = entry === active;
          return (
            <button
              key={entry.id}
              type="button"
              className="station-dock__item"
              data-dock-item
              aria-current={isActive ? 'step' : undefined}
              onClick={() => onNavigate(entry.id)}
            >
              <span className="station-dock__glyph" aria-hidden="true">
                <svg viewBox="0 0 16 16">{entry.glyph}</svg>
                {isActive && (
                  <span className="station-dock__steam">
                    <i />
                    <i />
                    <i />
                  </span>
                )}
              </span>
              <span className="station-dock__label">{entry.label}</span>
              <small className="station-dock__caption">{entry.caption}</small>
            </button>
          );
        })}
        {active && (
          <span
            className="station-dock__seal"
            data-dock-seal
            aria-hidden="true"
          >
            <i key={active.id}>{active.seal}</i>
          </span>
        )}
      </div>
      <span className="station-dock__roller" aria-hidden="true" />
    </nav>
  );
}
