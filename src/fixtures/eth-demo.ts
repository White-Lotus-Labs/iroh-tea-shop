import type { EvidenceItem } from '../shared/contracts';
export const SAMPLE_THESIS = 'ETH is being accumulated by Smart Money, so the market is broadly aligned with my bullish thesis.';
export const SAMPLE_TIME = '2026-09-22T18:00:00.000Z';
export const ETH_EVIDENCE: EvidenceItem = {
  id: 'DEMO-E-01', provider: 'Synthetic fixture · Nansen-shaped',
  endpoint: '/api/v1/smart-money/perp-trades (illustrative source)',
  canonicalSymbol: 'ETH', cohort: 'Synthetic Smart Money sample',
  requestedWindow: {from:'2026-09-21T18:00:00.000Z', to:SAMPLE_TIME, hours:24},
  retrievedAt: SAMPLE_TIME, latestEventAt:'2026-09-22T17:48:00.000Z',
  metrics: [{metric:'Opening / adding longs',value:1200000,unit:'USD'}, {metric:'Opening / adding shorts',value:900000,unit:'USD'}],
  sampleSize:12, coverage:'capped',
  caveats:['Invented teaching data. No provider was contacted.', 'Twelve distinct synthetic wallets; this capped sample does not describe the full cohort.', 'Buying alone can include short covering. These illustrative totals distinguish opening and adding exposure.'],
  sourceRequestId:'fixture-eth-24h-v1', mode:'demo',
};
