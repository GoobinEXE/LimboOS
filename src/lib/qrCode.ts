/**
 * Normaliza o payload lido de um QR para o ID usado em resolve/unlock.
 * Aceita ID puro ou URL com path/query (?code= / ?id= / ?intel=).
 */
export function normalizeQrPayload(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;

  const looksLikeUrl =
    /^https?:\/\//i.test(trimmed) ||
    trimmed.startsWith('/') ||
    trimmed.includes('://');

  if (!looksLikeUrl) return trimmed;

  try {
    const url = new URL(trimmed, 'https://limbo.local');
    const fromQuery =
      url.searchParams.get('code') ||
      url.searchParams.get('id') ||
      url.searchParams.get('intel') ||
      url.searchParams.get('tape');
    if (fromQuery?.trim()) return fromQuery.trim();

    const segments = url.pathname.split('/').filter(Boolean);
    const last = segments[segments.length - 1];
    if (last && last.length >= 4 && !last.includes('.')) {
      return decodeURIComponent(last);
    }
  } catch {
    // não era URL válida — mantém o texto original
  }

  return trimmed;
}
