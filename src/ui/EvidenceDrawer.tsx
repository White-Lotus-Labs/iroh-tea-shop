import { useEffect, useRef } from 'react';
import type { EvidenceItem, Finding } from '../shared/contracts';
export function EvidenceDrawer({
  evidence,
  finding,
  onClose,
}: {
  evidence: EvidenceItem;
  finding: Finding;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="evidence-drawer"
      aria-labelledby="evidence-title"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="drawer-content">
        <div className="drawer-top">
          <span className="eyebrow">THE RECEIPT / {evidence.id}</span>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close evidence"
          >
            ×
          </button>
        </div>
        <h2 id="evidence-title">Evidence, with its edges.</h2>
        <span className="badge">DEMO DATA · SYNTHETIC</span>
        <p className="evidence-quote">“{finding.quotedClaim}”</p>
        <p>{finding.reason}</p>
        <dl>
          {[
            ['Provider', evidence.provider],
            ['Source / endpoint', evidence.endpoint],
            ['Symbol', evidence.canonicalSymbol],
            ['Cohort', evidence.cohort],
            [
              'Requested window',
              `${evidence.requestedWindow.hours}h · ${evidence.requestedWindow.from} → ${evidence.requestedWindow.to}`,
            ],
            ['Fixture retrieval time', evidence.retrievedAt],
            ['Latest sample event', evidence.latestEventAt ?? 'Unknown'],
            [
              'Sample size',
              `${evidence.sampleSize ?? 'Unknown'} distinct synthetic wallets`,
            ],
            ['Coverage', evidence.coverage],
            ['Source request ID', evidence.sourceRequestId],
            ['Rule', `${finding.ruleId} · v${finding.ruleVersion}`],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <div className="metrics">
          {evidence.metrics.map((metric) => (
            <div key={metric.metric}>
              <span>{metric.metric}</span>
              <strong>
                {metric.value === null
                  ? 'Unknown'
                  : new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: metric.unit,
                      maximumFractionDigits: 0,
                    }).format(metric.value)}
              </strong>
            </div>
          ))}
        </div>
        <h3>What this cannot tell us</h3>
        <ul>
          {evidence.caveats.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <button className="primary" onClick={onClose}>
          Back to the tea table
        </button>
      </div>
    </dialog>
  );
}
