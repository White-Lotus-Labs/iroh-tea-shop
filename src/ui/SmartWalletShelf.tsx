'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  formatMoney,
  formatRoi,
  type SmartWalletLeaderboardEntry,
  type SmartWalletLeaderboardSnapshot,
} from '../leaderboard/model';
import type { NansenAvailability } from '../nansen/availability';
import { shelfIdentityForRank } from './shelfIdentities';
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

function Wallet({
  entry,
  featured = false,
}: {
  entry: SmartWalletLeaderboardEntry;
  featured?: boolean;
}) {
  const identity = shelfIdentityForRank(entry.rank);
  const portraitIndex = identity?.portraitIndex ?? 9;
  const label = shelfLabel(entry.displayName, entry.address);
  return (
    <article
      className={`wallet-rank${featured ? ' wallet-rank-featured' : ''}`}
      data-rank={entry.rank}
      data-testid={featured ? 'top-wallet' : undefined}
      aria-label={`Rank ${entry.rank}, ${identity?.name ?? 'White Lotus guest'}${label ? `, ${label}` : ''}, wallet ${entry.address}`}
    >
      <div className="wallet-portrait-frame">
        <div
          className="wallet-portrait"
          role="img"
          aria-label={identity?.name ?? 'White Lotus guest'}
          style={{
            backgroundPosition: `${(portraitIndex % 5) * 25}% ${portraitIndex < 5 ? 0 : 100}%`,
          }}
        />
        <span className="wallet-place" aria-hidden="true">
          {entry.rank}
        </span>
      </div>
      <div className="wallet-card-details">
        <div className="wallet-identity">
          <h2>{identity?.name ?? 'White Lotus guest'}</h2>
          {label && <p className="wallet-label">{label}</p>}
        </div>
        <dl className="wallet-metrics">
          <div>
            <dt>PNL</dt>
            <dd>{formatMoney(entry.pnl, true)}</dd>
          </div>
          <div>
            <dt>ROI</dt>
            <dd>{formatRoi(entry.roi)}</dd>
          </div>
          <div>
            <dt>ACCOUNT VALUE</dt>
            <dd>{formatMoney(entry.accountValue)}</dd>
          </div>
        </dl>
      </div>
    </article>
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
        Rankings are powered by Nansen&apos;s 30-day Hyperliquid perpetuals
        leaderboard (Smart HL Perps Traders).
      </p>
      <p>Server snapshot refreshes automatically every 30 minutes.</p>
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
          <svg
            className="leaderboard-lotus"
            viewBox="0 0 48 34"
            fill="none"
            aria-hidden="true"
          >
            <path d="M24 29C15 22 16 13 24 4c8 9 9 18 0 25Z" />
            <path d="M24 29C12 29 7 23 6 13c10 2 16 8 18 16Zm0 0c12 0 17-6 18-16-10 2-16 8-18 16Z" />
            <path d="M24 29C15 33 7 30 2 24c8-2 16-1 22 5Zm0 0c9 4 17 1 22-5-8-2-16-1-22 5Z" />
          </svg>
          {!unconfigured && (
            <>
              <h1>Top 10 Hyperliquid Leaderboard</h1>
              <p className="leaderboard-subhead">The White Lotus Order</p>
              <div className="leaderboard-attribution">
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
                  <span aria-hidden="true">ⓘ</span>
                </button>
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
            <Wallet entry={leader} featured />
            <div className="wallet-grid" data-testid="rank-grid">
              {others.map((entry) => (
                <Wallet key={entry.address} entry={entry} />
              ))}
            </div>
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
                <span>Illustrated ranks · Powered by Nansen</span>
                <button
                  type="button"
                  className="leaderboard-info-btn"
                  onClick={() => toggleFreshness('footer')}
                  aria-label="Explain data freshness"
                  aria-expanded={freshnessAnchor === 'footer'}
                  title="Data freshness info"
                >
                  <span aria-hidden="true">ⓘ</span>
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
