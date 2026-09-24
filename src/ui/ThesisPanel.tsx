import type { FormEvent } from 'react';
export function ThesisPanel({
  thesis,
  symbol,
  hours,
  onThesis,
  onSymbol,
  onHours,
  onPour,
  onSample,
  busy,
  error,
}: {
  thesis: string;
  symbol: string;
  hours: 6 | 24 | 168;
  onThesis: (s: string) => void;
  onSymbol: (s: string) => void;
  onHours: (h: 6 | 24 | 168) => void;
  onPour: () => void;
  onSample: () => void;
  busy: boolean;
  error: string | null;
}) {
  return (
    <>
      <div className="eyebrow">01 / COUNTER · YOUR THESIS</div>
      <h1>
        Pour what you have
        <br /> already written.
      </h1>
      <p className="intro">
        A finished thought deserves a second look.
        <br />
        Let the evidence question the inference.
      </p>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          onPour();
        }}
        noValidate
      >
        <div className="label-row">
          <label htmlFor="thesis">Your finished thesis</label>
          <span>{thesis.trim().length.toLocaleString()} / 6,000</span>
        </div>
        <textarea
          id="thesis"
          value={thesis}
          onChange={(e) => onThesis(e.target.value)}
          placeholder="What do you believe, and what led you there?"
          rows={6}
          maxLength={6000}
          disabled={busy}
          aria-describedby="thesis-help form-error"
          aria-invalid={!!error}
        />
        <p id="thesis-help" className="field-note">
          80–6,000 characters. Your writing stays in this tab.
        </p>
        <div className="form-row">
          <div>
            <label htmlFor="symbol">Confirm symbol</label>
            <input
              id="symbol"
              value={symbol}
              onChange={(e) => onSymbol(e.target.value)}
              placeholder="e.g. ETH"
              maxLength={20}
              disabled={busy}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <div>
            <label htmlFor="window">Review window</label>
            <select
              id="window"
              value={hours}
              onChange={(e) => onHours(Number(e.target.value) as 6 | 24 | 168)}
              disabled={busy}
            >
              <option value={6}>Recent 6 hours</option>
              <option value={24}>Recent 24 hours</option>
              <option value={168}>Recent 7 days</option>
            </select>
          </div>
        </div>
        {error && (
          <p id="form-error" role="alert" className="error">
            {error}
          </p>
        )}
        <div className="actions">
          <button className="primary" type="submit" disabled={busy}>
            {busy ? 'Pouring…' : error ? 'Retry Pour' : 'Pour'}
            <span aria-hidden="true">↗</span>
          </button>
          <button
            className="secondary"
            type="button"
            onClick={onSample}
            disabled={busy}
          >
            Load sample
          </button>
        </div>
      </form>
      <div className="quiet-note">
        <span aria-hidden="true">◌</span>
        <p>
          <strong>A rehearsal, with honest limits.</strong> The prepared ETH
          thesis reveals synthetic evidence. Other writing is kept unassessed.
          No live data or AI analysis.
        </p>
      </div>
    </>
  );
}
