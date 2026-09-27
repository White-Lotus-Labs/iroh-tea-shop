'use client';
import type { NansenAvailability } from '../nansen/availability';
import { THESES } from '../thesis/deck';
import type { ConvictionLevel, ThesisId } from '../thesis/types';

export interface ThesisDeckProps {
  nansen: NansenAvailability;
  reduced: boolean;
  initialThesis: ThesisId | null;
  onOpenThesis: (id: ThesisId, conviction: ConvictionLevel | null) => void;
  onCloseThesis: () => void;
  onTalkToUncle: (draft: string) => void;
}

/** Placeholder desk. Lane D replaces the internals and keeps this props contract. */
export function ThesisDeck(props: ThesisDeckProps) {
  void props.nansen;
  void props.reduced;
  void props.initialThesis;
  void props.onCloseThesis;
  return (
    <div className="thesis-deck">
      <div className="eyebrow">01 / COUNTER · THESIS DESK</div>
      <h1>Thesis Desk</h1>
      <ul className="thesis-deck-list">
        {THESES.map((thesis) => (
          <li key={thesis.id}>
            <button
              type="button"
              onClick={() => props.onOpenThesis(thesis.id, null)}
            >
              {thesis.title}
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="primary"
        onClick={() =>
          props.onTalkToUncle(
            'Here is my own thesis. Help me test it against smart money data:\n\n',
          )
        }
      >
        Discuss your own thesis with Uncle
      </button>
    </div>
  );
}
