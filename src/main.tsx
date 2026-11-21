import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import './i18n';
import App from './App.tsx';
// Fontes empacotadas (woff2 com hash em assets/, font-display: swap): web e nativo
// não dependem do Google Fonts. Archivo variável com eixo de largura, Spline Sans Mono
// para dados e VT323 para a tela LCD do Nokia.
import '@fontsource-variable/archivo/wdth.css';
import '@fontsource/spline-sans-mono/400.css';
import '@fontsource/spline-sans-mono/600.css';
import '@fontsource/spline-sans-mono/700.css';
import '@fontsource/vt323/400.css';
import './index.css';
import {applyWebKitLiteClass} from './lib/webkitLite';
import {initNativeShell} from './lib/native/nativeShell';
import {detachBootSplash} from './lib/bootSplash';
import {isZoomLockedPath, setZoomLocked} from './lib/viewportZoom';
import {isChunkLoadError, markBootHealthy, reloadOnce, startVersionChannel} from './lib/versionChannel';
import {registerServiceWorker} from './lib/serviceWorker';

// App Capacitor: status bar e splash nativo (no-op no navegador). Primeiro, para que
// um erro no boot já encontre os ouvintes que escondem a splash nativa.
initNativeShell();

// Antes do paint React: overlays CSS leves em Safari / iOS WebKit
applyWebKitLiteClass();

// Player trava o zoom desde o primeiro quadro; App.tsx mantém a trava por rota.
setZoomLocked(isZoomLockedPath(window.location.pathname));

// Chunk do build antigo sumiu depois de um deploy: recarrega no máximo uma vez a cada
// 30 s. Bloqueada, o erro sobe ao ErrorBoundary e o aviso de nova versão aparece.
window.addEventListener('vite:preloadError', (event) => {
  if (reloadOnce()) event.preventDefault();
});

// Mesmo caso quando o import dinâmico falha fora do preload do Vite (WebView nativo).
window.addEventListener('unhandledrejection', (event) => {
  if (isChunkLoadError(event.reason)) reloadOnce();
});

// Base do aviso de nova versão: o build que esta aba carregou (no-op no nativo).
startVersionChannel();

// Splash Dark Room de index.html: sai do #root antes do React e some com fade
const releaseBootSplash = detachBootSplash();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

releaseBootSplash();
markBootHealthy();

// Shell offline e assets em cache (só no site de produção; no-op no nativo e no dev)
registerServiceWorker();
