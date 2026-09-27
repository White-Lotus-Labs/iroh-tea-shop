import { db } from '../auth/db';
import { refreshSavedNansenData } from './refresh';
import { NANSEN_REFRESH_MS } from './snapshot-store';

const globalForRefresh = globalThis as { nansenHourlyRefresh?: boolean };

function logReport(
  report: Awaited<ReturnType<typeof refreshSavedNansenData>>,
): void {
  if (report.skipped === 'no-key') {
    console.info('Nansen refresh skipped: API key is not set.');
    return;
  }
  console.info(
    `Nansen refresh saved ${report.saved.length}, kept ${report.kept.length}, missing ${report.missing.length}.`,
  );
}

/** Fill SQLite now, then again about once an hour. One loop per process. */
export function startHourlyNansenRefresh(): void {
  if (process.env.NEXT_PHASE === 'phase-production-build') return;
  if (globalForRefresh.nansenHourlyRefresh) return;
  globalForRefresh.nansenHourlyRefresh = true;

  let running = false;
  const run = () => {
    if (running) return;
    running = true;
    void refreshSavedNansenData(db)
      .then(logReport)
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : 'Refresh failed';
        console.error(`Nansen refresh failed: ${message}`);
      })
      .finally(() => {
        running = false;
      });
  };
  run();
  setInterval(run, NANSEN_REFRESH_MS);
}
