import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import './i18n';
import App from './App.tsx';
import './index.css';
import {applyWebKitLiteClass} from './lib/webkitLite';

// Antes do paint React: overlays CSS leves em Safari / iOS WebKit
applyWebKitLiteClass();

// Handle Vite chunk load errors after new deployments
window.addEventListener('vite:preloadError', () => {
  const reloaded = sessionStorage.getItem('vite_reload');
  if (!reloaded) {
    sessionStorage.setItem('vite_reload', '1');
    window.location.reload();
  }
});

// Fallback for native dynamic import failures
window.addEventListener('unhandledrejection', (event) => {
  const msg = event.reason?.message || '';
  if (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed')
  ) {
    const reloaded = sessionStorage.getItem('vite_reload');
    if (!reloaded) {
      sessionStorage.setItem('vite_reload', '1');
      window.location.reload();
    }
  }
});



createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
