import { describe, expect, it } from 'vitest';
import { MockReviewAdapter } from '../src/review/mock-adapter';
import { validateInput, type ReviewInput } from '../src/shared/contracts';
const input = { thesis: 'ETH is being accumulated by Smart Money, so the market is broadly aligned with my bullish thesis.', symbol: 'ETH', lookbackHours: 24 as const, mode: 'demo' as const, requestId: 'test-1' };
describe('review boundary', () => {
  it('rejects short, oversize, invalid-window and live inputs', () => {
    for (const patch of [{ thesis: 'short' }, { thesis: 'a'.repeat(6001) }, { lookbackHours: 5 }, { mode: 'live' }, { symbol: '' }]) expect(() => validateInput({...input, ...patch} as ReviewInput)).toThrow();
  });
  it('returns reproducible synthetic evidence with resolvable findings', async () => {
    const adapter = new MockReviewAdapter(0);
    const result = await adapter.review(input);
    expect(await adapter.review(input)).toEqual(result);
    expect(result.mode).toBe('demo');
    expect(result.evidence[0].coverage).toBe('capped');
    expect(result.evidence[0].sampleSize).toBe(12);
    expect(result.evidence[0].metrics[0].value).toBe(1200000);
    for (const finding of result.findings) expect(finding.evidenceIds.every(id => result.evidence.some(e => e.id === id))).toBe(true);
    expect(result.card.cut).toContain('broadly aligned');
    expect(JSON.stringify(result.card)).not.toContain(input.thesis);
  });
  it('does not pretend a different thesis or symbol was assessed', async () => {
    for (const patch of [{symbol:'BTC'}, {thesis:'An unrelated observation about market history. '.repeat(3)}, {lookbackHours:168 as const}]) {
      const result = await new MockReviewAdapter(0).review({...input, ...patch});
      expect(result.findings[0].verdict).toBe('unknown');
      expect(result.evidence).toHaveLength(0);
    }
  });
  it('supports cancellation before and during retrieval', async () => {
    const controller = new AbortController();
    const pending = new MockReviewAdapter(100).review(input, controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({name:'AbortError'});
    await expect(new MockReviewAdapter(0).review(input, controller.signal)).rejects.toMatchObject({name:'AbortError'});
  });
});
