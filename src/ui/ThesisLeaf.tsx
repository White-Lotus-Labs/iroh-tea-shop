'use client';
import { useId, useState, type ReactNode } from 'react';
import { formatMoney, shortenAddress } from '../leaderboard/model';
import type {
  Section,
  ThesisId,
  Ticker,
  TickerDetail,
  TickerSignal,
} from '../thesis/types';
import { formatRelative } from './deckModel';

// ponytail: per-page-session cache; a reload refetches. The route has its own
// server TTL, so this only saves repeat round trips while the scroll is open.
const detailCache = new Map<string, Promise<TickerDetail>>();

function loadDetail(thesisId: ThesisId, symbol: string) {
  const key = `${thesisId}/${symbol}`;
  let pending = detailCache.get(key);
  if (!pending) {
    pending = fetch(`/api/theses/${thesisId}/${encodeURIComponent(symbol)}`, {
      cache: 'no-store',
    }).then(async (response) => {
      if (response.ok) return (await response.json()) as TickerDetail;
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(
        response.status === 503
          ? 'Nansen is not configured.'
          : (body?.error ?? 'Nansen is unavailable right now.'),
      );
    });
    detailCache.set(key, pending);
    pending.catch(() => detailCache.delete(key));
  }
  return pending;
}

const ASSET_CLASS: Record<Ticker['assetClass'], string> = {
  crypto: 'Crypto',
  stock: 'Stock token',
  native: 'Native',
};

function Figure({
  signal,
  offline,
}: {
  signal: TickerSignal | undefined;
  offline: boolean;
}) {
  if (offline || !signal)
    return (
      <span className="leaf-figure" data-dir="none">
        <span className="leaf-amount">Offline</span>
        <span className="leaf-unit">no live reading</span>
      </span>
    );
  if (signal.status !== 'ok' || signal.smartMoneyNetFlowUsd === null)
    return (
      <span className="leaf-figure" data-dir="none">
        <span className="leaf-amount">
          {signal.status === 'error' ? 'No reading' : 'Quiet'}
        </span>
        <span className="leaf-unit">
          {signal.status === 'error'
            ? 'Nansen did not answer'
            : 'no smart money flow'}
        </span>
      </span>
    );
  const value = signal.smartMoneyNetFlowUsd;
  const dir = value > 0 ? 'up' : value < 0 ? 'down' : 'flat';
  return (
    <span className="leaf-figure" data-dir={dir}>
      <span className="leaf-amount">
        <span className="leaf-glyph" aria-hidden="true">
          {dir === 'up' ? '▲' : dir === 'down' ? '▼' : '•'}
        </span>
        {formatMoney(value, true)}
      </span>
      <span className="leaf-unit">
        {signal.source === 'position-intelligence'
          ? '7d smart net long'
          : '7d smart money flow'}
      </span>
    </span>
  );
}

function who(address: string, label: string | null) {
  return label?.trim() || shortenAddress(address);
}

function DetailSection<T>({
  title,
  section,
  okOnly = false,
  wide = false,
  children,
}: {
  title: string;
  section: Section<T>;
  okOnly?: boolean;
  wide?: boolean;
  children: (data: T) => ReactNode;
}) {
  if (section.status === 'not-applicable') return null;
  if (okOnly && section.status !== 'ok') return null;
  return (
    <section
      className="leaf-section"
      data-status={section.status}
      data-wide={wide ? 'true' : undefined}
    >
      <h5 className="leaf-section-title">{title}</h5>
      {section.status === 'ok' ? (
        children(section.data)
      ) : section.status === 'empty' ? (
        <p className="leaf-quiet">
          Smart money is quiet on this leaf this week.
        </p>
      ) : (
        <p className="leaf-unavailable">Unavailable · {section.reason}</p>
      )}
    </section>
  );
}

function Money({
  value,
  signed = false,
}: {
  value: number | null;
  signed?: boolean;
}) {
  return <span className="leaf-money">{formatMoney(value, signed)}</span>;
}

function Detail({ detail, now }: { detail: TickerDetail; now: number }) {
  return (
    <>
      <p className="leaf-live">
        <span className="leaf-live-dot" aria-hidden="true" />
        Live · Nansen · updated {formatRelative(detail.fetchedAt, now)}
        {detail.stale && <span className="deck-stale">Stale</span>}
      </p>
      <div className="leaf-sections">
        <DetailSection
          title="Smart money moves"
          section={detail.movements}
          wide
        >
          {({ buyers, sellers, recent }) =>
            !buyers.length && !sellers.length && !recent.length ? (
              <p className="leaf-quiet">
                Smart money is quiet on this leaf this week.
              </p>
            ) : (
              <>
                <div className="leaf-columns">
                  <div>
                    <p className="leaf-sub">Top buyers</p>
                    {buyers.length ? (
                      <ul className="leaf-list">
                        {buyers.map((b) => (
                          <li key={`b-${b.address}`}>
                            <span className="leaf-who">
                              {who(b.address, b.label)}
                            </span>
                            <span className="leaf-pos">
                              <Money value={b.boughtUsd} />
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="leaf-none">No smart buyers.</p>
                    )}
                  </div>
                  <div>
                    <p className="leaf-sub">Top sellers</p>
                    {sellers.length ? (
                      <ul className="leaf-list">
                        {sellers.map((s) => (
                          <li key={`s-${s.address}`}>
                            <span className="leaf-who">
                              {who(s.address, s.label)}
                            </span>
                            <span className="leaf-neg">
                              <Money value={s.soldUsd} />
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="leaf-none">No smart sellers.</p>
                    )}
                  </div>
                </div>
                {recent.length > 0 && (
                  <>
                    <p className="leaf-sub">Recent smart trades</p>
                    <ul className="leaf-list leaf-trades">
                      {recent.map((t, i) => (
                        <li key={`${t.txHash ?? t.trader}-${i}`}>
                          <span className="leaf-action" data-action={t.action}>
                            {t.action === 'buy' ? 'Buy' : 'Sell'}
                          </span>
                          <span className="leaf-who">
                            {who(t.trader, t.label)}
                          </span>
                          <Money value={t.valueUsd} />
                          <span className="leaf-time">
                            {formatRelative(t.at, now)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )
          }
        </DetailSection>

        <DetailSection title="Holders" section={detail.holders}>
          {({ totalHolders, smartMoney }) => (
            <>
              <p className="leaf-stat">
                <strong>
                  {totalHolders === null
                    ? '—'
                    : totalHolders.toLocaleString('en-US')}
                </strong>{' '}
                holders
              </p>
              {smartMoney.length ? (
                <>
                  <p className="leaf-sub">Top smart money holders</p>
                  <ul className="leaf-list">
                    {smartMoney.map((h) => (
                      <li key={h.address}>
                        <span className="leaf-who">
                          {who(h.address, h.label)}
                        </span>
                        <Money value={h.valueUsd} />
                        <span
                          className={
                            (h.change7dPct ?? 0) >= 0 ? 'leaf-pos' : 'leaf-neg'
                          }
                        >
                          {h.change7dPct === null
                            ? '—'
                            : `${h.change7dPct > 0 ? '+' : ''}${h.change7dPct.toFixed(1)}% 7d`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="leaf-none">No smart money holders on record.</p>
              )}
            </>
          )}
        </DetailSection>

        <DetailSection
          title="Supply not yet circulating"
          section={detail.supply}
          okOnly
        >
          {({ notCirculatingPct }) =>
            notCirculatingPct === null ? (
              <p className="leaf-none">Supply split not reported.</p>
            ) : (
              <>
                <div
                  className="leaf-bar"
                  role="img"
                  aria-label={`${notCirculatingPct.toFixed(1)}% of supply is not yet circulating`}
                >
                  <span
                    style={{
                      width: `${Math.min(100, Math.max(0, notCirculatingPct))}%`,
                    }}
                  />
                </div>
                <p className="leaf-stat">
                  <strong>{notCirculatingPct.toFixed(1)}%</strong> of total
                  supply is still locked or unissued
                </p>
              </>
            )
          }
        </DetailSection>

        <DetailSection title="Perps positioning" section={detail.perps}>
          {({ smartLongUsd, smartShortUsd, recent }) => {
            const long = Math.max(0, smartLongUsd ?? 0);
            const short = Math.max(0, smartShortUsd ?? 0);
            const longPct =
              long + short > 0 ? (long / (long + short)) * 100 : 50;
            return (
              <>
                <div
                  className="leaf-perp-bar"
                  role="img"
                  aria-label={`Smart money long ${formatMoney(smartLongUsd)}, short ${formatMoney(smartShortUsd)}`}
                >
                  <span
                    className="leaf-perp-long"
                    style={{ width: `${longPct}%` }}
                  />
                  <span className="leaf-perp-short" />
                </div>
                <p className="leaf-perp-legend">
                  <span className="leaf-pos">
                    Long {formatMoney(smartLongUsd)}
                  </span>
                  <span className="leaf-neg">
                    Short {formatMoney(smartShortUsd)}
                  </span>
                </p>
                {recent.length > 0 && (
                  <>
                    <p className="leaf-sub">Recent perp trades</p>
                    <ul className="leaf-list leaf-trades">
                      {recent.map((t, i) => (
                        <li key={`${t.trader}-${i}`}>
                          <span
                            className="leaf-action"
                            data-action={t.side === 'long' ? 'buy' : 'sell'}
                          >
                            {t.side === 'long' ? 'Long' : 'Short'}
                          </span>
                          <span className="leaf-who">
                            {who(t.trader, t.label)} · {t.action}
                          </span>
                          <Money value={t.valueUsd} />
                          <span className="leaf-time">
                            {formatRelative(t.at, now)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            );
          }}
        </DetailSection>
      </div>
    </>
  );
}

type DetailState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; detail: TickerDetail }
  | { status: 'error'; reason: string };

export function ThesisLeaf({
  thesisId,
  ticker,
  signal,
  offline,
  now,
}: {
  thesisId: ThesisId;
  ticker: Ticker;
  signal: TickerSignal | undefined;
  offline: boolean;
  now: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [state, setState] = useState<DetailState>({ status: 'idle' });
  const panelId = useId();

  const fetchDetail = () => {
    setState({ status: 'loading' });
    loadDetail(thesisId, ticker.symbol).then(
      (detail) => setState({ status: 'ok', detail }),
      (error: unknown) =>
        setState({
          status: 'error',
          reason:
            error instanceof Error
              ? error.message
              : 'Nansen is unavailable right now.',
        }),
    );
  };

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && (state.status === 'idle' || state.status === 'error'))
      fetchDetail();
  };

  return (
    <li className="leaf" data-expanded={expanded ? 'true' : 'false'}>
      <h4 className="leaf-heading">
        <button
          type="button"
          className="leaf-toggle"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={toggle}
        >
          <span className="leaf-symbol">{ticker.symbol}</span>
          <span className="leaf-name">
            {ticker.name}
            <span className="leaf-class">{ASSET_CLASS[ticker.assetClass]}</span>
          </span>
          <Figure signal={signal} offline={offline} />
          <span className="leaf-chevron" aria-hidden="true" />
        </button>
      </h4>
      <div id={panelId} className="leaf-detail" hidden={!expanded}>
        {state.status === 'loading' || state.status === 'idle' ? (
          <div className="leaf-loading" role="status">
            <span className="plaque-shimmer" />
            <span className="plaque-shimmer plaque-shimmer--short" />
            <span className="sr-only">
              Reading {ticker.symbol} from Nansen…
            </span>
          </div>
        ) : state.status === 'error' ? (
          <p className="leaf-unavailable" role="status">
            Unavailable · {state.reason}{' '}
            <button type="button" className="leaf-retry" onClick={fetchDetail}>
              Try again
            </button>
          </p>
        ) : (
          <Detail detail={state.detail} now={now} />
        )}
      </div>
    </li>
  );
}
