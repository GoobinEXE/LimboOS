/**
 * Trava de zoom do viewport (P07).
 *
 * index.html sai sem trava, para que convite, admin e terminal aceitem pinça.
 * O player (walkman, Nokia) trava por script: pinça e duplo toque ampliariam os
 * controles físicos no meio do gesto. O leitor de evidência destrava enquanto está
 * aberto (overlay com `allowZoom`). O Safari do iOS ignora `user-scalable=no`; o
 * WKWebView do app nativo respeita. `html[data-zoom-locked]` liga
 * `touch-action: manipulation` em src/index.css, que corta o zoom por duplo toque.
 */

const BASE = 'width=device-width, initial-scale=1.0, viewport-fit=cover';
const LOCKED = `${BASE}, maximum-scale=1.0, user-scalable=no`;

/** Rotas que não são o player (têm entry próprio em App.tsx). */
const FREE_ZOOM_PREFIXES = ['/admin', '/terminal', '/convite', '/oraculo'];

/** O player trava o zoom; as outras superfícies não. */
export function isZoomLockedPath(pathname: string): boolean {
  return !FREE_ZOOM_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function setZoomLocked(locked: boolean): void {
  if (typeof document === 'undefined') return;
  let meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'viewport';
    document.head.appendChild(meta);
  }
  const content = locked ? LOCKED : BASE;
  if (meta.content !== content) meta.content = content;
  document.documentElement.toggleAttribute('data-zoom-locked', locked);
}
