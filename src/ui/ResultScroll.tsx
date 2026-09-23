import type { InterrogationResult, ReviewCard } from '../shared/contracts';
export function ThreeThoughts({ card }: { card: ReviewCard }) {
  return (
    <div className="thoughts">
      {(
        [
          ['NOTICED', card.noticed],
          ['CUT', card.cut],
          ['ONE BREATH', card.oneBreath],
        ] as const
      ).map(([label, text], i) => (
        <section key={label} className={`thought thought-${i}`}>
          <h3>
            <span aria-hidden="true">{['↗', '—', '◌'][i]}</span>
            {label}
          </h3>
          <p>{text}</p>
        </section>
      ))}
    </div>
  );
}
export function ResultScroll({
  result,
  onEvidence,
  onReflect,
  onCard,
}: {
  result: InterrogationResult;
  onEvidence: () => void;
  onReflect: () => void;
  onCard: () => void;
}) {
  return (
    <>
      <div className="eyebrow">02 / TEA TABLE · THE REVIEW</div>
      <h1>
        A little clarity,
        <br /> with your tea.
      </h1>
      <div className="context-line">
        {result.canonicalSymbol} <span> / </span> Recent{' '}
        {result.card.lookbackHours}h <span> / </span>
        <strong>DEMO DATA</strong>
      </div>
      <ThreeThoughts card={result.card} />
      {result.evidence.length > 0 ? (
        <button className="evidence-link" onClick={onEvidence}>
          Inspect evidence · DEMO-E-01 <span aria-hidden="true">↗</span>
        </button>
      ) : (
        <p className="notice">
          No matching evidence. Load the ETH sample at the counter to explore
          the evidence drawer.
        </p>
      )}
      <p className="field-note">{result.warnings[0]}</p>
      <div className="actions">
        <button className="primary" onClick={onReflect}>
          Take one breath <span aria-hidden="true">→</span>
        </button>
        <button className="secondary" onClick={onCard}>
          Preview card
        </button>
      </div>
    </>
  );
}
