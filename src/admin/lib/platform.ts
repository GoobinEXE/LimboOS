let cachedIsApple: boolean | null = null;

/** macOS / iOS usam ⌘; demais plataformas usam Ctrl. */
export function isApplePlatform(): boolean {
  if (cachedIsApple !== null) return cachedIsApple;
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const platform = nav.userAgentData?.platform || nav.platform || nav.userAgent;
  cachedIsApple = /mac|iphone|ipad|ipod/i.test(platform);
  return cachedIsApple;
}

/** Rótulo da tecla modificadora para dicas de atalho (⌘ ou Ctrl+). */
export function modKeyLabel(): string {
  return isApplePlatform() ? '⌘' : 'Ctrl+';
}
