/** Extrai o token de um link `/convite/:token` ou de um código colado sozinho. */
export function parseInviteToken(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const match = raw.match(/\/convite\/([A-Za-z0-9_-]{10,64})/);
  if (match) return match[1];
  return /^[A-Za-z0-9_-]{10,64}$/.test(raw) ? raw : null;
}
