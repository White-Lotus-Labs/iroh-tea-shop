import { ETH_EVIDENCE, SAMPLE_THESIS, SAMPLE_TIME } from '../fixtures/eth-demo';
import {
  validateInput,
  type InterrogationResult,
  type ReviewAdapter,
  type ReviewInput,
} from '../shared/contracts';
const aborted = () => new DOMException('Review cancelled', 'AbortError');
function delay(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(aborted());
    const cancel = () => {
      clearTimeout(timer);
      reject(aborted());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', cancel);
      resolve();
    }, ms);
    signal?.addEventListener('abort', cancel, { once: true });
  });
}
export class MockReviewAdapter implements ReviewAdapter {
  constructor(private readonly delayMs = 2800) {}
  async review(
    raw: ReviewInput,
    signal?: AbortSignal,
  ): Promise<InterrogationResult> {
    const input = validateInput(raw);
    await delay(this.delayMs, signal);
    const isSample =
      input.symbol === 'ETH' &&
      input.lookbackHours === 24 &&
      input.thesis === SAMPLE_THESIS;
    const evidence = isSample ? [structuredClone(ETH_EVIDENCE)] : [];
    const card = {
      noticed: isSample
        ? 'You looked beyond price. The synthetic sample shows participants adding new exposure on both sides.'
        : 'You brought a finished thesis to the table. This demo has no evidence matched to your writing, symbol and window.',
      cut: isSample
        ? 'Cut “broadly aligned.” Twelve wallets in a capped sample cannot establish cohort-wide agreement. Buying alone can include short covering.'
        : 'Leave the conclusion unassessed. The prepared ETH example cannot support or contradict this thesis; matching evidence is still needed.',
      oneBreath: isSample
        ? 'What observation would distinguish durable accumulation from a short-lived adjustment?'
        : 'What evidence would you need before treating this interpretation as a supported observation?',
      symbol: input.symbol,
      lookbackHours: input.lookbackHours,
      reviewAsOf: SAMPLE_TIME,
      mode: 'demo' as const,
      provenance: isSample
        ? 'Synthetic teaching fixture · DEMO-E-01 · no provider calls'
        : 'Unassessed demo · no matching evidence · no provider calls',
      evidenceIds: evidence.map((item) => item.id),
    };
    return {
      schemaVersion: '1.0',
      requestId: input.requestId,
      canonicalSymbol: input.symbol,
      reviewAsOf: SAMPLE_TIME,
      mode: 'demo',
      evidence,
      card,
      findings: [
        {
          claimId: 'claim-1',
          quotedClaim: isSample ? 'broadly aligned' : '',
          lens: 'micro',
          verdict: isSample ? 'challenged' : 'unknown',
          reason: card.cut,
          evidenceIds: card.evidenceIds,
          ruleId: isSample ? 'demo-sample-breadth' : 'demo-not-assessed',
          ruleVersion: '1.0',
        },
      ],
      warnings: [
        isSample
          ? 'DEMO DATA. Invented figures from a fixed teaching example, not current market activity.'
          : 'DEMO DATA. Custom theses are not analyzed in PASS A. Load the sample to explore linked evidence.',
      ],
      timings: { totalMs: this.delayMs },
      estimatedCredits: 0,
    };
  }
}
