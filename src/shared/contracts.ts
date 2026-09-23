export type Station = 'Entrance' | 'Counter' | 'TeaTable' | 'AvatarSeat' | 'Shelf';
export type MotionPreference = 'system' | 'reduce' | 'full';
export type WorkflowState = 'idle' | 'fetching' | 'result' | 'error';
export interface ReviewInput {
  thesis: string;
  symbol: string;
  lookbackHours: 6 | 24 | 168;
  mode: 'demo' | 'live';
  requestId: string;
}
export interface EvidenceItem {
  id: string;
  provider: string;
  endpoint: string;
  canonicalSymbol: string;
  cohort: string;
  requestedWindow: { from: string; to: string; hours: number };
  retrievedAt: string;
  latestEventAt: string | null;
  metrics: { metric: string; value: number | null; unit: string }[];
  sampleSize: number | null;
  coverage: 'capped' | 'complete' | 'unknown';
  caveats: string[];
  sourceRequestId: string;
  mode: 'demo' | 'live';
}
export interface Finding {
  claimId: string;
  quotedClaim: string;
  lens: 'macro' | 'meso' | 'micro';
  verdict: 'supported' | 'challenged' | 'mixed' | 'unknown';
  reason: string;
  evidenceIds: string[];
  ruleId: string;
  ruleVersion: string;
}
export interface ReviewCard {
  noticed: string;
  cut: string;
  oneBreath: string;
  symbol: string;
  lookbackHours: number;
  reviewAsOf: string;
  mode: 'demo' | 'live';
  provenance: string;
  evidenceIds: string[];
}
export interface InterrogationResult {
  schemaVersion: '1.0';
  requestId: string;
  canonicalSymbol: string;
  reviewAsOf: string;
  mode: 'demo' | 'live';
  evidence: EvidenceItem[];
  findings: Finding[];
  card: ReviewCard;
  warnings: string[];
  timings: { totalMs: number };
  estimatedCredits: number;
}
export interface ReviewAdapter {
  review(input: ReviewInput, signal?: AbortSignal): Promise<InterrogationResult>;
}
export function validateInput(value: ReviewInput): ReviewInput {
  const thesis = value.thesis.trim();
  if (thesis.length < 80 || thesis.length > 6000) throw new Error('Your thesis needs 80–6,000 characters. Your writing is still here.');
  const symbol = value.symbol.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9:-]{0,19}$/.test(symbol)) throw new Error('Confirm a symbol using 1–20 letters, numbers, colons or hyphens.');
  if (![6, 24, 168].includes(value.lookbackHours)) throw new Error('Choose a 6-hour, 24-hour or 7-day review window.');
  if (value.mode !== 'demo') throw new Error('Only DEMO DATA is available in PASS A.');
  if (!value.requestId) throw new Error('A review needs a request ID.');
  return {...value, thesis, symbol};
}
