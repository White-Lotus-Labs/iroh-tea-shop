import { formatMoney } from '../leaderboard/model';
import type {
  Conviction,
  ConvictionLevel,
  DeckSnapshot,
  Thesis,
  ThesisId,
  ThesisSummary,
  TickerSignal,
} from '../thesis/types';

export type DeckState =
  | { status: 'loading' }
  | { status: 'offline'; reason: string }
  | { status: 'ready'; snapshot: DeckSnapshot };

export const LEVEL_LABEL: Record<ConvictionLevel, string> = {
  weak: 'Weak',
  steeping: 'Steeping',
  strong: 'Strong',
  unknown: 'Unread',
};

/** Tea strength glyphs for the conviction seal: light, steeping, strong. */
export const LEVEL_GLYPH: Record<ConvictionLevel, string> = {
  weak: '淡',
  steeping: '沏',
  strong: '濃',
  unknown: '未',
};

export function formatRelative(iso: string | null, now = Date.now()): string {
  if (!iso) return 'time unknown';
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return 'time unknown';
  const minutes = Math.max(0, Math.round((now - then) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

export function accumulatingLine(
  conviction: Conviction,
  total: number,
): string {
  return `${conviction.accumulating} of ${total} accumulating`;
}

/** One line that explains the meter in plain words. */
export function convictionSentence(
  conviction: Conviction,
  total: number,
): string {
  const leaves = total === 1 ? 'leaf' : 'leaves';
  const gap =
    conviction.measured < total ? ` (${conviction.measured} with data)` : '';
  return `Nansen smart money is accumulating ${conviction.accumulating} of ${total} ${leaves} this week${gap}`;
}

export function measuredSignals(tickers: TickerSignal[]) {
  return tickers.filter(
    (t): t is TickerSignal & { smartMoneyNetFlowUsd: number } =>
      t.status === 'ok' && t.smartMoneyNetFlowUsd !== null,
  );
}

export function strongestAndWeakest(tickers: TickerSignal[]) {
  const measured = measuredSignals(tickers);
  if (!measured.length) return null;
  const sorted = [...measured].sort(
    (a, b) => b.smartMoneyNetFlowUsd - a.smartMoneyNetFlowUsd,
  );
  return { strongest: sorted[0], weakest: sorted[sorted.length - 1] };
}

export function buildUncleDraft(
  thesis: Thesis,
  summary: ThesisSummary | null,
): string {
  const leaves = thesis.tickers
    .map((t) => `${t.symbol} (${t.name})`)
    .join(', ');
  const lines = [
    'Uncle, I want to test a thesis against smart money data.',
    '',
    `Thesis: ${thesis.title} — ${thesis.subtitle}.`,
    thesis.body,
    '',
    `Leaves: ${leaves}.`,
  ];
  if (summary) {
    const { conviction } = summary;
    lines.push(
      `Conviction: ${LEVEL_LABEL[conviction.level]}. ${convictionSentence(conviction, thesis.tickers.length)}, net 7-day flow ${formatMoney(conviction.netFlowUsd, true)}.`,
    );
    const ends = strongestAndWeakest(summary.tickers);
    if (ends) {
      lines.push(
        `Strongest signal: ${ends.strongest.symbol} ${formatMoney(ends.strongest.smartMoneyNetFlowUsd, true)} 7-day smart money flow.`,
        `Weakest signal: ${ends.weakest.symbol} ${formatMoney(ends.weakest.smartMoneyNetFlowUsd, true)} 7-day smart money flow.`,
      );
    }
  } else {
    lines.push('Conviction: not available right now (Nansen is offline).');
  }
  lines.push(
    '',
    'What would change your mind about this thesis, and which leaf should I watch first?',
  );
  return lines.join('\n');
}

export function thesisLink(origin: string, id: ThesisId): string {
  return `${origin}/?thesis=${id}`;
}

export function shareText(
  thesis: Thesis,
  summary: ThesisSummary | null,
): string {
  const line = summary
    ? `${convictionSentence(summary.conviction, thesis.tickers.length)}.`
    : 'Reading the smart money flows.';
  return `Thesis: ${thesis.title}. ${line} Data by @nansen_ai`;
}

export function xIntentUrl(
  thesis: Thesis,
  summary: ThesisSummary | null,
  origin: string,
): string {
  const params = new URLSearchParams({
    text: shareText(thesis, summary),
    url: thesisLink(origin, thesis.id),
  });
  return `https://x.com/intent/post?${params.toString()}`;
}

export const FOLLOW_KEY = 'tea.followedTheses';

// ponytail: follows live in localStorage, so they do not sync across devices
// or accounts. Upgrade path: a Prisma FollowedThesis(userId, thesisId) table.
export function readFollowed(storage: Pick<Storage, 'getItem'>): ThesisId[] {
  try {
    const raw: unknown = JSON.parse(storage.getItem(FOLLOW_KEY) ?? '[]');
    return Array.isArray(raw)
      ? raw.filter((v): v is ThesisId =>
          ['robinhood', 'bullrun', 'ai'].includes(v),
        )
      : [];
  } catch {
    return [];
  }
}

export function toggleFollowed(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  id: ThesisId,
): ThesisId[] {
  const current = readFollowed(storage);
  const next = current.includes(id)
    ? current.filter((v) => v !== id)
    : [...current, id];
  storage.setItem(FOLLOW_KEY, JSON.stringify(next));
  return next;
}
