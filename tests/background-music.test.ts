import { describe, expect, it } from 'vitest';
import {
  BACKGROUND_MUSIC_KEY,
  BACKGROUND_MUSIC_SRC,
  readBackgroundMusic,
  writeBackgroundMusic,
} from '../src/ui/backgroundMusic';

function memory() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

describe('background music preference', () => {
  it('stays off until the guest turns it on', () => {
    const storage = memory();
    expect(readBackgroundMusic(storage)).toBe(false);
    writeBackgroundMusic(storage, true);
    expect(storage.getItem(BACKGROUND_MUSIC_KEY)).toBe('on');
    expect(readBackgroundMusic(storage)).toBe(true);
    writeBackgroundMusic(storage, false);
    expect(readBackgroundMusic(storage)).toBe(false);
  });

  it('points at the ambience file the guest can drop in later', () => {
    expect(BACKGROUND_MUSIC_SRC).toBe('/audio/tea-ambience.mp3');
  });

  it('ignores storage that throws', () => {
    const storage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readBackgroundMusic(storage)).toBe(false);
    expect(() => writeBackgroundMusic(storage, true)).not.toThrow();
  });
});
