export const BACKGROUND_MUSIC_SRC = '/audio/tea-ambience.mp3';
export const BACKGROUND_MUSIC_KEY = 'iroh-background-music';

export function readBackgroundMusic(
  storage: Pick<Storage, 'getItem'>,
): boolean {
  try {
    return storage.getItem(BACKGROUND_MUSIC_KEY) === 'on';
  } catch {
    return false;
  }
}

export function writeBackgroundMusic(
  storage: Pick<Storage, 'setItem'>,
  enabled: boolean,
) {
  try {
    storage.setItem(BACKGROUND_MUSIC_KEY, enabled ? 'on' : 'off');
  } catch {
    /* Private mode and blocked storage keep the in-memory choice. */
  }
}
