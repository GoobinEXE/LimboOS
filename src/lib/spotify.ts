const SPOTIFY_TYPES = 'playlist|album|track|episode|show';
const SPOTIFY_URI_RE = new RegExp(`^spotify:(${SPOTIFY_TYPES}):([a-zA-Z0-9]+)$`);
/** Aceita /playlist/id, /embed/..., e variantes /intl-pt/playlist/... */
const SPOTIFY_PATH_RE = new RegExp(
  `^/(?:intl-[a-z]{2}(?:-[a-zA-Z]+)?/)?(?:embed/)?(${SPOTIFY_TYPES})/([a-zA-Z0-9]+)/?$`
);

/**
 * Valida e converte URL/URI do Spotify em URL de embed.
 * Retorna null se o link for inválido.
 */
export function extractSpotifyEmbedUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    if (trimmed.startsWith('spotify:')) {
      const uriMatch = trimmed.match(SPOTIFY_URI_RE);
      if (!uriMatch) return null;
      return `https://open.spotify.com/embed/${uriMatch[1]}/${uriMatch[2]}?utm_source=generator&theme=0`;
    }
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'open.spotify.com') return null;
    const match = parsed.pathname.match(SPOTIFY_PATH_RE);
    if (!match) return null;
    return `https://open.spotify.com/embed/${match[1]}/${match[2]}?utm_source=generator&theme=0`;
  } catch {
    return null;
  }
}

/** True se a string for vazia (desconectar) ou um link Spotify válido. */
export function isValidSpotifyPlaylistInput(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return true;
  return extractSpotifyEmbedUrl(trimmed) !== null;
}
