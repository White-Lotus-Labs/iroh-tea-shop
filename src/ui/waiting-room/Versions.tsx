'use client';
import { useEffect, useState } from 'react';
import { Invitation } from './Invitation';
import { Sketchbook } from './Sketchbook';
import './Versions.css';

const VERSIONS = [
  { id: 'sketchbook', letter: 'A', name: 'Sketchbook' },
  { id: 'invitation', letter: 'B', name: 'Invitation' },
] as const;
type Id = (typeof VERSIONS)[number]['id'];

// Compare branch only: choose a waiting room here or with ?waiting=<id>.
export function WaitingVersions({ reduced }: { reduced: boolean }) {
  const [id, setId] = useState<Id>('sketchbook');
  useEffect(() => {
    const asked = new URLSearchParams(location.search).get('waiting');
    const match = VERSIONS.find((v) => v.id === asked);
    if (match) setId(match.id);
  }, []);
  const pick = (next: Id) => {
    setId(next);
    const url = new URL(location.href);
    url.searchParams.set('waiting', next);
    history.replaceState(history.state, '', url);
  };
  return (
    <>
      <nav className="waiting-versions" aria-label="Waiting room versions">
        {VERSIONS.map((v) => (
          <button
            key={v.id}
            type="button"
            aria-pressed={id === v.id}
            onClick={() => pick(v.id)}
          >
            <b>{v.letter}</b>
            <span>{v.name}</span>
          </button>
        ))}
      </nav>
      {id === 'sketchbook' ? (
        <Sketchbook reduced={reduced} />
      ) : (
        <Invitation reduced={reduced} />
      )}
    </>
  );
}
