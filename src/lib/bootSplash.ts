/**
 * Splash de abertura com a logo da Dark Room (markup e CSS em index.html).
 *
 * O bloco #initial-loader nasce dentro de #root; aqui ele vai para o <body> antes do
 * primeiro render do React, para não sumir de uma vez quando o React assume #root.
 * Na primeira abertura da sessão a assinatura fica pelo menos MIN_VISIBLE_MS na tela
 * (contados desde o início da navegação, então carregamento lento não soma espera).
 * Recargas na mesma sessão saem assim que o app pinta. Toque ou tecla pulam.
 */

const MIN_VISIBLE_MS = 1400;
const FADE_MS = 360;
const SESSION_KEY = 'limboos.bootIdentSeen';

function alreadySeenThisSession(): boolean {
  try {
    const seen = sessionStorage.getItem(SESSION_KEY) === '1';
    sessionStorage.setItem(SESSION_KEY, '1');
    return seen;
  } catch {
    return false;
  }
}

/** Chame antes de createRoot().render(). Devolve a função que libera a saída do splash. */
export function detachBootSplash(): () => void {
  const el = document.getElementById('initial-loader');
  if (!el) return () => {};
  document.body.appendChild(el);

  const minUntil = alreadySeenThisSession() ? 0 : MIN_VISIBLE_MS;
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  let gone = false;

  const hide = () => {
    if (gone) return;
    gone = true;
    window.removeEventListener('keydown', hide);
    el.classList.add('is-leaving');
    el.setAttribute('aria-hidden', 'true');
    window.setTimeout(() => el.remove(), reduceMotion ? 0 : FADE_MS);
  };

  el.addEventListener('pointerdown', hide, { once: true });
  window.addEventListener('keydown', hide);

  // Libera depois que o React pintou o primeiro frame e o tempo mínimo passou.
  return () => {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const wait = Math.max(0, minUntil - performance.now());
        window.setTimeout(hide, wait);
      }),
    );
  };
}
