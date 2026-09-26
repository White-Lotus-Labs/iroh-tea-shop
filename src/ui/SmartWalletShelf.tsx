'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  formatMoney,
  formatRoi,
  type SmartWalletLeaderboardEntry,
  type SmartWalletLeaderboardSnapshot,
} from '../leaderboard/model';

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
  return (
    <article
      className={`wallet-rank${featured ? ' wallet-rank-featured' : ''}`}
      data-rank={entry.rank}
      data-testid={featured ? 'top-wallet' : undefined}
      aria-label={`Rank ${entry.rank}, ${entry.displayName}, wallet ${entry.address}`}
    >
      <div className="wallet-identity">
        <span className="wallet-place">#{entry.rank}</span>
        <h2 title={entry.address}>{entry.displayName}</h2>
      </div>
      <dl className="wallet-metrics">
        <div>
          <dt>PnL</dt>
          <dd>{formatMoney(entry.pnl, true)}</dd>
        </div>
        <div>
          <dt>ROI</dt>
          <dd>{formatRoi(entry.roi)}</dd>
        </div>
        <div>
          <dt>Account Value</dt>
          <dd>{formatMoney(entry.accountValue)}</dd>
        </div>
      </dl>
    </article>
  );
}

export function SmartWalletShelf() {
  const [snapshot, setSnapshot] =
    useState<SmartWalletLeaderboardSnapshot | null>(lastSnapshot);
  const [loading, setLoading] = useState(!lastSnapshot);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
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
          <p className="leaderboard-kicker">THE SHELF · HYPERLIQUID</p>
          <h1>Top 10 Smart Wallets</h1>
          <p>Nansen · Smart HL Perps Traders · 30D</p>
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
            No Smart Wallets were returned for this period.
          </p>
        )}
        <footer className="leaderboard-foot">
          <span>Server snapshot · refreshes every 30 min</span>
          {snapshot && <span>Updated {age} min ago</span>}
          {snapshot?.stale && (
            <button type="button" onClick={() => void load()}>
              Retry leaderboard
            </button>
          )}
        </footer>
      </div>
      <div className="parchment-rod parchment-rod-bottom" aria-hidden="true" />
    </div>
  );
}
