import { describe, expect, it } from 'vitest';
import { shelfIdentityForRank } from '../src/ui/shelfIdentities';

describe('White Lotus Shelf identities', () => {
  it('maps ranked wallet positions to the requested characters', () => {
    expect(
      Array.from(
        { length: 10 },
        (_, index) => shelfIdentityForRank(index + 1)?.name,
      ),
    ).toEqual([
      'Iroh',
      'Bumi',
      'Pakku',
      'Piandao',
      'Jeong Jeong',
      'Roku',
      'Kuruk',
      'Fung',
      'Xian',
      'The White Lotus Tile',
    ]);
    expect(shelfIdentityForRank(1)?.portraitIndex).toBe(0);
    expect(shelfIdentityForRank(10)?.portraitIndex).toBe(9);
    expect(shelfIdentityForRank(11)).toBeNull();
  });
});
