import { getPlatform, isNative } from './platform';
import { haptic } from './haptics';

/**
 * Ajustes do shell nativo no boot: status bar clara sobre o fundo escuro e
 * esconder o splash nativo assim que o WebView pinta o splash crítico de index.html
 * (mesma cor #090A0C, então a troca não pisca). No navegador não faz nada.
 */
export function initNativeShell(): void {
  if (!isNative()) return;

  const root = document.documentElement;
  root.classList.add('native-app');
  root.dataset.platform = getPlatform();

  void import('./fonts').catch((err) => console.warn('[Native] fontes:', err));
  void import('./deepLinks')
    .then(({ initDeepLinks }) => initDeepLinks())
    .catch((err) => console.warn('[Native] links:', err));

  void import('@capacitor/status-bar')
    .then(({ StatusBar, Style }) => StatusBar.setStyle({ style: Style.Dark }))
    .catch(() => {});

  // Toque em qualquer controle dá um retorno tátil leve: o deslocamento de 1 px
  // do :active some embaixo do dedo. O walkman tem o próprio retorno (data-haptic="off").
  document.addEventListener(
    'pointerdown',
    (e) => {
      const el = (e.target as Element | null)?.closest?.('button, [role="button"], a[href], summary');
      if (!el || el.closest('[data-haptic="off"]')) return;
      if ((el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') return;
      haptic('light');
    },
    { passive: true, capture: true },
  );

  requestAnimationFrame(() => {
    void import('@capacitor/splash-screen')
      .then(({ SplashScreen }) => SplashScreen.hide({ fadeOutDuration: 200 }))
      .catch(() => {});
  });
}
