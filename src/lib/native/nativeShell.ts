import { getPlatform, isNative } from './platform';
import { haptic } from './haptics';
import { closeTopOverlay } from '../overlayStack';

/** Teto da splash nativa: com `launchAutoHide: false` ela só sai pelo `hide()`. */
const SPLASH_FAILSAFE_MS = 2500;

let splashHidden = false;

/**
 * Esconde a splash nativa uma única vez. O splash crítico de index.html tem a mesma
 * cor (#090A0C), então a troca não pisca; num boot com erro a tela do erro aparece.
 */
function hideSplash(): void {
  if (splashHidden) return;
  splashHidden = true;
  void import('@capacitor/splash-screen')
    .then(({ SplashScreen }) => SplashScreen.hide({ fadeOutDuration: 200 }))
    .catch(() => {});
}

/**
 * Botão voltar do Android (P09): fecha o overlay do topo (leitor, modal, mini-app
 * registrados em src/lib/overlayStack.ts); sem overlay, volta no histórico, que o
 * player espelha em useAppScreenHistory; na raiz, fecha o app.
 */
async function initBackButton(): Promise<void> {
  const { App } = await import('@capacitor/app');
  await App.addListener('backButton', ({ canGoBack }) => {
    if (closeTopOverlay()) return;
    if (canGoBack) {
      window.history.back();
      return;
    }
    void App.exitApp();
  });
}

/**
 * Ajustes do shell nativo no boot: status bar clara sobre o fundo escuro e
 * esconder o splash nativo assim que o WebView pinta (ou no primeiro erro, ou em
 * 2,5 s, o que vier antes). index.html tem o mesmo teto para o caso de o bundle
 * nem chegar a rodar. No navegador não faz nada.
 */
export function initNativeShell(): void {
  if (!isNative()) return;

  window.addEventListener('error', hideSplash, { once: true });
  window.addEventListener('unhandledrejection', hideSplash, { once: true });
  window.setTimeout(hideSplash, SPLASH_FAILSAFE_MS);

  const root = document.documentElement;
  root.classList.add('native-app');
  root.dataset.platform = getPlatform();

  void import('./deepLinks')
    .then(({ initDeepLinks }) => initDeepLinks())
    .catch((err) => console.warn('[Native] links:', err));

  void import('./keyboard')
    .then(({ initKeyboard }) => initKeyboard())
    .catch((err) => console.warn('[Native] teclado:', err));

  if (getPlatform() === 'android') {
    void initBackButton().catch((err) => console.warn('[Native] voltar:', err));
  }

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

  requestAnimationFrame(hideSplash);
}
