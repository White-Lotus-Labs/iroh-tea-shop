/** "just now", "12 min ago", "3 h ago", "2 d ago". Its own module so the first-paint shell can use it. */
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
