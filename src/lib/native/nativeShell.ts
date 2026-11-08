import { getPlatform, isNative } from './platform';

/**
 * Ajustes do shell nativo no boot: status bar clara sobre o fundo escuro e
 * esconder o splash nativo assim que o WebView pinta o splash crítico de index.html
 * (mesma cor #131210, então a troca não pisca). No navegador não faz nada.
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

  requestAnimationFrame(() => {
    void import('@capacitor/splash-screen')
      .then(({ SplashScreen }) => SplashScreen.hide({ fadeOutDuration: 200 }))
      .catch(() => {});
  });
}
