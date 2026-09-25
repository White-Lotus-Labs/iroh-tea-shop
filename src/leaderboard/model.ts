export interface SmartWalletLeaderboardEntry {
  rank: number;
  address: string;
  displayName: string;
  pnl: number | null;
  roi: number | null;
  accountValue: number | null;
}

export interface SmartWalletLeaderboardSnapshot {
  entries: SmartWalletLeaderboardEntry[];
  fetchedAt: string;
  expiresAt: string;
  source: 'nansen';
  stale: boolean;
  refreshError?: string;
}

export function shortenAddress(address: string): string {
  return address.length > 13
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : address;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function normalizeLeaderboard(
  payload: unknown,
): SmartWalletLeaderboardEntry[] {
  if (
    !payload ||
    typeof payload !== 'object' ||
    !('data' in payload) ||
    !Array.isArray(payload.data)
  ) {
    throw new Error('Invalid Nansen leaderboard response.');
  }
  return payload.data
    .filter(
      (row: unknown) =>
        row &&
        typeof row === 'object' &&
        'trader_address' in row &&
        typeof row.trader_address === 'string' &&
        row.trader_address.length > 0,
    )
    .slice(0, 10)
    .map((row: Record<string, unknown>, index: number) => {
      const address = row.trader_address as string;
      const label =
        typeof row.trader_address_label === 'string'
          ? row.trader_address_label.trim()
          : '';
      const displayName =
        label &&
        label.toLowerCase() !== address.toLowerCase() &&
        !['smart hl perps trader', 'smart money'].includes(label.toLowerCase())
          ? label
          : shortenAddress(address);
      return {
        rank: index + 1,
        address,
        displayName,
        pnl: numberOrNull(row.total_pnl),
        roi: numberOrNull(row.roi),
        accountValue: numberOrNull(row.account_value),
      };
    });
}

export function formatMoney(value: number | null, signed = false): string {
  if (value === null) return '—';
  const magnitude = Math.abs(value);
  const unit =
    magnitude >= 1_000_000_000
      ? 'B'
      : magnitude >= 1_000_000
        ? 'M'
        : magnitude >= 1_000
          ? 'K'
          : '';
  const divisor =
    unit === 'B'
      ? 1_000_000_000
      : unit === 'M'
        ? 1_000_000
        : unit === 'K'
          ? 1_000
          : 1;
  const scaled = magnitude / divisor;
  const digits = !unit ? 0 : scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
  const amount = scaled.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return `${value < 0 ? '-' : signed && value > 0 ? '+' : ''}$${amount}${unit}`;
}

export function formatRoi(value: number | null): string {
  if (value === null) return '—';
  const percent = value * 100;
  return `${percent > 0 ? '+' : ''}${percent.toFixed(1)}%`;
}
