interface MediaSessionState {
  title: string;
  playing: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSeekBackward?: () => void;
  onSeekForward?: () => void;
}

function session(): MediaSession | null {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return null;
  return navigator.mediaSession;
}

function setHandler(media: MediaSession, action: MediaSessionAction, handler: MediaSessionActionHandler | null): void {
  // Ações não suportadas pelo navegador lançam; ignorar mantém as demais
  try {
    media.setActionHandler(action, handler);
  } catch {
    /* ação não suportada */
  }
}

/** Título e controles da fita no painel de mídia do sistema (tela de bloqueio, teclas de mídia). */
export function updateMediaSession(state: MediaSessionState): void {
  const media = session();
  if (!media) return;
  if (typeof MediaMetadata !== 'undefined') {
    media.metadata = new MediaMetadata({ title: state.title, artist: 'LimboOS' });
  }
  media.playbackState = state.playing ? 'playing' : 'paused';
  setHandler(media, 'play', state.onPlay);
  setHandler(media, 'pause', state.onPause);
  setHandler(media, 'seekbackward', state.onSeekBackward ?? null);
  setHandler(media, 'seekforward', state.onSeekForward ?? null);
}

export function clearMediaSession(): void {
  const media = session();
  if (!media) return;
  media.metadata = null;
  media.playbackState = 'none';
  for (const action of ['play', 'pause', 'seekbackward', 'seekforward'] as const) {
    setHandler(media, action, null);
  }
}
