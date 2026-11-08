import { isNative } from './platform';

interface MediaSessionState {
  title: string;
  playing: boolean;
  onPlay: () => void;
  onPause: () => void;
}

function session(): MediaSession | null {
  if (!isNative() || typeof navigator === 'undefined' || !('mediaSession' in navigator)) return null;
  return navigator.mediaSession;
}

/** Título e controles da fita na tela de bloqueio. */
export function updateMediaSession(state: MediaSessionState): void {
  const media = session();
  if (!media) return;
  media.metadata = new MediaMetadata({ title: state.title, artist: 'LimboOS' });
  media.playbackState = state.playing ? 'playing' : 'paused';
  media.setActionHandler('play', state.onPlay);
  media.setActionHandler('pause', state.onPause);
}

export function clearMediaSession(): void {
  const media = session();
  if (!media) return;
  media.metadata = null;
  media.playbackState = 'none';
  media.setActionHandler('play', null);
  media.setActionHandler('pause', null);
}
