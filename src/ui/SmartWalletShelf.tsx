'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  formatMoney,
  formatRoi,
  shortenAddress,
  type SmartWalletLeaderboardEntry,
  type SmartWalletLeaderboardSnapshot,
} from '../leaderboard/model';
import type { NansenAvailability } from '../nansen/availability';
import {
  SHELF_CAST_NAME,
  SHELF_GUEST_NAME,
  shelfIdentityForRank,
} from './shelfIdentities';
import { shelfLabel } from './shelfLabels';

let lastSnapshot: SmartWalletLeaderboardSnapshot | null = null;

function isSnapshot(value: unknown): value is SmartWalletLeaderboardSnapshot {
  return (
    !!value &&
    typeof value === 'object' &&
    'source' in value &&
    value.source === 'nansen' &&
    'entries' in value &&
    Array.isArray(value.entries) &&
    'fetchedAt' in value &&
    typeof value.fetchedAt === 'string' &&
    'expiresAt' in value &&
    typeof value.expiresAt === 'string' &&
    'stale' in value &&
    typeof value.stale === 'boolean'
  );
}

function nansenProfilerUrl(address: string) {
  return `https://app.nansen.ai/profiler?address=${encodeURIComponent(address)}&chain=hyperliquid`;
}

function tone(value: number | null) {
  return value === null || value === 0 ? 'flat' : value > 0 ? 'up' : 'down';
}

function Portrait({ rank }: { rank: number }) {
  const identity = shelfIdentityForRank(rank);
  const index = identity?.portraitIndex ?? 9;
  return (
    <div className="wallet-portrait-frame">
      <div
        className="wallet-portrait"
        role="img"
        aria-label={identity?.name ?? SHELF_GUEST_NAME}
        style={{
          backgroundPosition: `${(index % 5) * 25}% ${index < 5 ? 0 : 100}%`,
        }}
      />
    </div>
  );
}

function RoiChip({ roi }: { roi: number | null }) {
  return (
    <span className={`wallet-roi wallet-roi-${tone(roi)}`}>
      <span className="sr-only">ROI </span>
      {formatRoi(roi)}
    </span>
  );
}

function WalletActions({
  address,
  labelled = false,
}: {
  address: string;
  labelled?: boolean;
}) {
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle');
  useEffect(() => {
    if (copy === 'idle') return;
    const timer = window.setTimeout(() => setCopy('idle'), 1600);
    return () => window.clearTimeout(timer);
  }, [copy]);
  return (
    <div className="wallet-actions">
      <button
        type="button"
        className="wallet-action"
        aria-label={`Copy wallet address ${address}`}
        title="Copy wallet address"
        onClick={() => {
          if (!navigator.clipboard) return setCopy('failed');
          navigator.clipboard.writeText(address).then(
            () => setCopy('copied'),
            () => setCopy('failed'),
          );
        }}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
          <path d="M10.5 3.5v-.5A1.5 1.5 0 0 0 9 1.5H3A1.5 1.5 0 0 0 1.5 3v6A1.5 1.5 0 0 0 3 10.5h.5" />
        </svg>
      </button>
      <a
        className={`wallet-action${labelled ? ' wallet-action-text' : ''}`}
        href={nansenProfilerUrl(address)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Research this wallet in Nansen (new tab)"
        title="Research this wallet in Nansen"
      >
        {labelled && <span aria-hidden="true">Research in Nansen</span>}
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M9 2.5h4.5V7M13.5 2.5 7 9M11.5 9.5v3a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3" />
        </svg>
      </a>
      <span className="wallet-copied" role="status" data-state={copy}>
        {copy === 'copied' ? 'Copied' : copy === 'failed' ? 'Copy failed' : ''}
      </span>
    </div>
  );
}

function SpiritWindow({ rank }: { rank: number }) {
  const identity = shelfIdentityForRank(rank);
  const name = identity?.name ?? SHELF_GUEST_NAME;
  const poster =
    rank >= 1 && rank <= 3 ? `/images/shelf/spirit-${rank}.webp` : null;
  const index = identity?.portraitIndex ?? 9;
  return (
    <figure className="shelf-mini-scroll">
      <span className="shelf-mini-rod" aria-hidden="true" />
      <div className="shelf-mini-window">
        {poster ? (
          <img src={poster} alt="" />
        ) : (
          <div
            className="wallet-portrait shelf-mini-portrait"
            role="img"
            aria-label={name}
            style={{
              backgroundPosition: `${(index % 5) * 25}% ${index < 5 ? 0 : 100}%`,
            }}
          />
        )}
      </div>
      <figcaption>{name}</figcaption>
      <span className="shelf-mini-rod" aria-hidden="true" />
    </figure>
  );
}

function Leader({
  entry,
  selected,
  onSelect,
}: {
  entry: SmartWalletLeaderboardEntry;
  selected: boolean;
  onSelect: () => void;
}) {
  const name = shelfIdentityForRank(entry.rank)?.name ?? SHELF_GUEST_NAME;
  const label = shelfLabel(entry.displayName, entry.address);
  return (
    <article
      className="wallet-hero"
      data-rank={entry.rank}
      data-selected={selected || undefined}
      data-testid="top-wallet"
      aria-label={`Rank ${entry.rank}, ${name}${label ? `, ${label}` : ''}`}
      onClick={onSelect}
    >
      <div className="wallet-hero-portrait">
        <Portrait rank={entry.rank} />
        <span className="wallet-seal" aria-hidden="true">
          {entry.rank}
        </span>
      </div>
      <div className="wallet-hero-body">
        <p className="wallet-hero-eyebrow">#1 by 30-day PnL</p>
        <h2>{name}</h2>
        {label && <p className="wallet-label">{label}</p>}
        <dl className="wallet-hero-metrics">
          <div>
            <dt>30-day PnL</dt>
            <dd className={`wallet-tone-${tone(entry.pnl)}`}>
              {formatMoney(entry.pnl, true)}
            </dd>
          </div>
          <div>
            <dt>ROI</dt>
            <dd>
              <RoiChip roi={entry.roi} />
            </dd>
          </div>
          <div>
            <dt>Account value</dt>
            <dd>{formatMoney(entry.accountValue)}</dd>
          </div>
        </dl>
        <div className="wallet-hero-address">
          <code title={entry.address}>{shortenAddress(entry.address)}</code>
          <WalletActions address={entry.address} labelled />
        </div>
      </div>
    </article>
  );
}

function WalletRow({
  entry,
  leaderPnl,
  selected,
  onSelect,
}: {
  entry: SmartWalletLeaderboardEntry;
  leaderPnl: number | null;
  selected: boolean;
  onSelect: () => void;
}) {
  const name = shelfIdentityForRank(entry.rank)?.name ?? SHELF_GUEST_NAME;
  const label = shelfLabel(entry.displayName, entry.address);
  const share =
    entry.pnl !== null && leaderPnl
      ? Math.min(1, Math.abs(entry.pnl) / Math.abs(leaderPnl))
      : 0;
  return (
    <li
      className="wallet-row"
      data-rank={entry.rank}
      data-selected={selected || undefined}
      onClick={onSelect}
    >
      <span className="wallet-seal">
        <span className="sr-only">Rank </span>
        {entry.rank}
      </span>
      <Portrait rank={entry.rank} />
      <div className="wallet-who">
        <h3>{name}</h3>
        {label ? (
          <p className="wallet-label">{label}</p>
        ) : (
          <p className="wallet-address" title={entry.address}>
            {shortenAddress(entry.address)}
          </p>
        )}
      </div>
      <div className="wallet-pnl">
        <span className={`wallet-pnl-value wallet-tone-${tone(entry.pnl)}`}>
          <span className="sr-only">PnL </span>
          {formatMoney(entry.pnl, true)}
        </span>
        <span className="wallet-bar" aria-hidden="true">
          <span
            className={`wallet-tone-${tone(entry.pnl)}`}
            style={{ width: `${(share * 100).toFixed(1)}%` }}
          />
        </span>
      </div>
      <RoiChip roi={entry.roi} />
      <span className="wallet-value">
        <span className="sr-only">Account value </span>
        {formatMoney(entry.accountValue)}
      </span>
      <WalletActions address={entry.address} />
    </li>
  );
}

function FreshnessPopover({
  snapshot,
  age,
  onClose,
}: {
  snapshot: SmartWalletLeaderboardSnapshot | null;
  age: number;
  onClose: () => void;
}) {
  return (
    <div
      className="leaderboard-freshness-popover"
      role="region"
      aria-label="Data freshness explanation"
    >
      <div className="leaderboard-freshness-head">
        <strong>Data Freshness &amp; Source</strong>
        <button
          type="button"
          className="leaderboard-freshness-close"
          onClick={onClose}
          aria-label="Close freshness info"
        >
          ✕
        </button>
      </div>
      <p>
        Rankings use Nansen&apos;s 30-day Hyperliquid perpetuals leaderboard for
        Smart HL Perps Traders. Illustrated names are visual aliases—not claims
        about wallet owners.
      </p>
      <p>Server snapshot refreshes every 30 minutes.</p>
      <p className="leaderboard-freshness-age">
        {snapshot
          ? `Snapshot updated ${age === 0 ? 'just now' : `${age} min ago`}.`
          : 'Fetching snapshot…'}
      </p>
    </div>
  );
}

export function SmartWalletShelf({ nansen }: { nansen: NansenAvailability }) {
  const [snapshot, setSnapshot] =
    useState<SmartWalletLeaderboardSnapshot | null>(lastSnapshot);
  const [loading, setLoading] = useState(!lastSnapshot);
  const [error, setError] = useState<string | null>(null);
  const [freshnessAnchor, setFreshnessAnchor] = useState<
    'header' | 'footer' | null
  >(null);
  const [selectedRank, setSelectedRank] = useState(1);
  const pending = useRef(false);

  const toggleFreshness = useCallback((anchor: 'header' | 'footer') => {
    setFreshnessAnchor((prev) => (prev === anchor ? null : anchor));
  }, []);

  useEffect(() => {
    if (!freshnessAnchor) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFreshnessAnchor(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [freshnessAnchor]);

  const load = useCallback(async () => {
    if (pending.current) return;
    pending.current = true;
    setLoading(true);
    setError(null);
    let safeError = 'Smart Wallet leaderboard is temporarily unavailable.';
    try {
      const response = await fetch('/api/smart-wallet-leaderboard', {
        cache: 'no-store',
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        if (
          body &&
          typeof body === 'object' &&
          'error' in body &&
          typeof body.error === 'string'
        )
          safeError = body.error;
        throw new Error('Request failed');
      }
      if (!isSnapshot(body)) throw new Error('Invalid snapshot');
      const next = body;
      lastSnapshot = next;
      setSnapshot(next);
    } catch {
      setError(safeError);
      if (lastSnapshot && Date.now() >= Date.parse(lastSnapshot.expiresAt)) {
        lastSnapshot = {
          ...lastSnapshot,
          stale: true,
          refreshError: safeError,
        };
        setSnapshot(lastSnapshot);
      }
    } finally {
      pending.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!snapshot || snapshot.stale) return;
    const remaining = Date.parse(snapshot.expiresAt) - Date.now();
    if (remaining <= 0) return;
    const timer = window.setTimeout(
      () => void load(),
      Math.min(remaining, 2_147_483_647),
    );
    return () => window.clearTimeout(timer);
  }, [snapshot, load]);

  const leader = snapshot?.entries[0];
  const others = snapshot?.entries.slice(1, 10) ?? [];
  const unconfigured = nansen === 'unavailable' && !snapshot;
  const age = snapshot
    ? Math.max(
        0,
        Math.floor((Date.now() - Date.parse(snapshot.fetchedAt)) / 60_000),
      )
    : 0;
  return (
    <div className="parchment-hanger" data-testid="leaderboard-parchment">
      <div className="parchment-rod" aria-hidden="true" />
      <div className="leaderboard-parchment">
        <header className="leaderboard-head">
          <span className="leaderboard-mark" aria-hidden="true">
            茶
          </span>
          {!unconfigured && (
            <>
              <p className="leaderboard-eyebrow">{SHELF_CAST_NAME}</p>
              <h1>
                Top Hyperliquid Traders by <em>30-Day PnL</em>
              </h1>
              <p className="leaderboard-intro">
                The ten Smart HL Perps Traders leading by 30-day PnL. Each
                spirit is a visual alias—not a claim about the wallet owner.
              </p>
              <div className="leaderboard-meta">
                <span>30-day performance · Live Nansen data</span>
                <span className="leaderboard-attribution">
                  <span>
                    Powered by <strong>Nansen</strong>
                  </span>
                  <button
                    type="button"
                    className="leaderboard-info-btn"
                    onClick={() => toggleFreshness('header')}
                    aria-label="Explain data freshness"
                    aria-expanded={freshnessAnchor === 'header'}
                    title="Data freshness info"
                  >
                    <span aria-hidden="true">i</span>
                  </button>
                </span>
              </div>
              {freshnessAnchor === 'header' && (
                <FreshnessPopover
                  snapshot={snapshot}
                  age={age}
                  onClose={() => setFreshnessAnchor(null)}
                />
              )}
            </>
          )}
        </header>
        {snapshot?.stale && (
          <p className="leaderboard-stale" role="status">
            Last updated {age} min ago · live refresh temporarily unavailable.
          </p>
        )}
        {leader ? (
          <div className="leaderboard-content" aria-busy={loading}>
            <SpiritWindow rank={selectedRank} />
            <Leader
              entry={leader}
              selected={selectedRank === leader.rank}
              onSelect={() => setSelectedRank(leader.rank)}
            />
            {others.length > 0 && (
              <>
                <div className="wallet-list-head" aria-hidden="true">
                  <span>Spirit</span>
                  <span>30-day PnL</span>
                  <span>ROI</span>
                  <span>Account value</span>
                </div>
                <ol
                  className="wallet-list"
                  start={2}
                  aria-label="Ranks 2 to 10"
                  data-testid="rank-grid"
                >
                  {others.map((entry) => (
                    <WalletRow
                      key={entry.address}
                      entry={entry}
                      leaderPnl={leader.pnl}
                      selected={selectedRank === entry.rank}
                      onSelect={() => setSelectedRank(entry.rank)}
                    />
                  ))}
                </ol>
              </>
            )}
            {snapshot!.entries.length < 10 && (
              <p className="leaderboard-note">
                Nansen returned {snapshot!.entries.length} ranked wallets for
                this period.
              </p>
            )}
          </div>
        ) : unconfigured ? (
          <div className="leaderboard-message">
            <p>Nansen research is offline.</p>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
            >
              Retry
            </button>
          </div>
        ) : loading ? (
          <p className="leaderboard-message" role="status">
            Reading the Nansen leaderboard…
          </p>
        ) : error ? (
          <div className="leaderboard-message" role="alert">
            <p>{error}</p>
            <button type="button" onClick={() => void load()}>
              Retry leaderboard
            </button>
          </div>
        ) : (
          <p className="leaderboard-message">
            No Hyperliquid traders were returned for this period.
          </p>
        )}
        {!unconfigured && (
          <>
            {freshnessAnchor === 'footer' && (
              <FreshnessPopover
                snapshot={snapshot}
                age={age}
                onClose={() => setFreshnessAnchor(null)}
              />
            )}
            <footer className="leaderboard-foot">
              <div className="leaderboard-foot-brand">
                <span>
                  Illustrated ranks by White Lotus Labs · Wallet intelligence by
                  Nansen
                </span>
                <button
                  type="button"
                  className="leaderboard-info-btn"
                  onClick={() => toggleFreshness('footer')}
                  aria-label="Explain data freshness"
                  aria-expanded={freshnessAnchor === 'footer'}
                  title="Data freshness info"
                >
                  <span aria-hidden="true">i</span>
                </button>
              </div>
              {snapshot && (
                <span>Updated {age === 0 ? 'just now' : `${age} min ago`}</span>
              )}
              {snapshot?.stale && (
                <button type="button" onClick={() => void load()}>
                  Retry leaderboard
                </button>
              )}
            </footer>
          </>
        )}
      </div>
      <div className="parchment-rod parchment-rod-bottom" aria-hidden="true" />
    </div>
  );
}
