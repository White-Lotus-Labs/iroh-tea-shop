export interface ShelfIdentity {
  name: string;
  nickname?: string;
  portraitIndex: number;
}

const identities: readonly ShelfIdentity[] = [
  { name: 'Iroh', nickname: 'santochan', portraitIndex: 0 },
  { name: 'Bumi', portraitIndex: 1 },
  { name: 'Pakku', portraitIndex: 2 },
  { name: 'Piandao', portraitIndex: 3 },
  { name: 'Jeong Jeong', portraitIndex: 4 },
  { name: 'Roku', portraitIndex: 5 },
  { name: 'Kuruk', portraitIndex: 6 },
  { name: 'Fung', portraitIndex: 7 },
  { name: 'Xian', portraitIndex: 8 },
  { name: 'The White Lotus Tile', portraitIndex: 9 },
];

export function shelfIdentityForRank(rank: number): ShelfIdentity | null {
  return Number.isInteger(rank) ? (identities[rank - 1] ?? null) : null;
}
