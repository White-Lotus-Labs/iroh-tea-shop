import { Fragment, type CSSProperties } from 'react';
import type { Station } from '../shared/contracts';

export const STATION_TEASERS: Partial<
  Record<Station, { glyph: string; text: string }>
> = {
  Counter: {
    glyph: '签',
    text: 'Draw a thesis. Smart money signals are inside.',
  },
  AvatarSeat: {
    glyph: '师',
    text: 'Sit with Uncle. Ask Nansen’s research agent.',
  },
  Shelf: {
    glyph: '卷',
    text: 'Unroll the top 10 smart perp traders.',
  },
  TeaTable: { glyph: '星', text: 'Wind the orrery.' },
};

/** Decorative ink-typed line. Always pair it with a readable copy for assistive tech. */
export function InkLine({
  text,
  className = '',
}: {
  text: string;
  className?: string;
}) {
  let index = 0;
  return (
    <span className={`ink-line ${className}`} aria-hidden="true">
      {text.split(' ').map((word, w) => (
        <Fragment key={w}>
          {w > 0 && ' '}
          <span className="ink-word">
            {Array.from(word).map((char, c) => (
              <span key={c} style={{ '--i': index++ } as CSSProperties}>
                {char}
              </span>
            ))}
          </span>
        </Fragment>
      ))}
    </span>
  );
}
