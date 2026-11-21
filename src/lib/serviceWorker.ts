import { isNative } from './native/platform';
import { notifyWorkerUpdate, reloadOnce } from './versionChannel';

/**
 * Registro do service worker (P01, public/sw.js).
 *
 * Só no site de produção: o app nativo serve o bundle do próprio binário e o
 * `npm run dev` precisa de rede sempre fresca (lá, um worker deixado por um
 * `npm run preview` na mesma porta é removido). Antes de registrar, lê /sw.js:
 * 404 ou `SW_ENABLED = false` desinstala o worker e apaga os caches.
 *
 * Worker novo instalado com a página já controlada vira o aviso de nova versão;
 * "Atualizar" manda SKIP_WAITING e recarrega uma vez quando o worker novo assume.
 */

const SW_URL = '/sw.js';
const CACHE_PREFIX = 'limboos-';
const UPDATE_CHECK_GAP_MS = 15 * 60_000;
/** Se o worker novo não assumir nesse prazo, recarrega mesmo assim. */
const SWAP_TIMEOUT_MS = 3000;

type ScriptState = 'enabled' | 'disabled' | 'unknown';

async function probeWorkerScript(): Promise<ScriptState> {
  try {
    const res = await fetch(SW_URL, { cache: 'no-store' });
    if (res.status === 404 || res.status === 410) return 'disabled';
    if (!res.ok) return 'unknown';
    // Um rewrite de SPA devolveria index.html com 200: não é o worker.
    if (!(res.headers.get('content-type') ?? '').includes('javascript')) return 'disabled';
    const source = await res.text();
    return /SW_ENABLED\s*=\s*false/.test(source) ? 'disabled' : 'enabled';
  } catch {
    // Sem rede: mantém o que já está instalado.
    return 'unknown';
  }
}

/** Remove os workers desta origem e os caches do LimboOS. */
export async function uninstallServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));
  if ('caches' in window) {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith(CACHE_PREFIX)).map((name) => caches.delete(name)));
  }
}

let swapRequested = false;
let reloading = false;

function reloadAfterSwap(): void {
  if (reloading) return;
  reloading = true;
  reloadOnce();
}

/** Ativa o worker que espera. Devolve `false` se ele já não existe mais. */
function activateWaiting(worker: ServiceWorker): boolean {
  if (worker.state === 'redundant') return false;
  swapRequested = true;
  worker.postMessage({ type: 'SKIP_WAITING' });
  window.setTimeout(reloadAfterSwap, SWAP_TIMEOUT_MS);
  return true;
}

function offerUpdate(worker: ServiceWorker): void {
  notifyWorkerUpdate(() => activateWaiting(worker));
}

function watchRegistration(registration: ServiceWorkerRegistration): void {
  // Sem controller é a primeira instalação: o worker assume sozinho, sem aviso.
  const trackInstalling = (worker: ServiceWorker | null) => {
    if (!worker) return;
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(worker);
    });
  };
  if (registration.waiting && navigator.serviceWorker.controller) offerUpdate(registration.waiting);
  // A checagem da navegação pode ter começado antes deste ouvinte.
  trackInstalling(registration.installing);
  registration.addEventListener('updatefound', () => trackInstalling(registration.installing));

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (swapRequested) reloadAfterSwap();
  });

  // O navegador só confere /sw.js nas navegações; o app vive numa só.
  let lastUpdateAt = Date.now();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || Date.now() - lastUpdateAt < UPDATE_CHECK_GAP_MS) return;
    lastUpdateAt = Date.now();
    void registration.update().catch(() => {});
  });
}

async function setup(): Promise<void> {
  const state = await probeWorkerScript();
  if (state === 'disabled') {
    await uninstallServiceWorker();
    return;
  }
  if (state === 'unknown') {
    const existing = await navigator.serviceWorker.getRegistration();
    if (existing) watchRegistration(existing);
    return;
  }
  const registration = await navigator.serviceWorker.register(SW_URL, { scope: '/', updateViaCache: 'none' });
  watchRegistration(registration);
  void navigator.serviceWorker.ready.then(sendLoadedAssets);
}

/**
 * Na primeira visita os chunks lazy (Player, login) carregam antes de o worker assumir
 * e não passam pelo cache dele. Manda a lista para o worker guardar, senão uma
 * recarga sem rede abriria o shell e quebraria no primeiro import().
 */
function sendLoadedAssets(registration: ServiceWorkerRegistration): void {
  const urls = performance
    .getEntriesByType('resource')
    .map((entry) => entry.name)
    .filter((name) => name.startsWith(`${window.location.origin}/assets/`));
  if (urls.length) registration.active?.postMessage({ type: 'CACHE_ASSETS', urls });
}

/** Chame uma vez no boot. No-op fora do site de produção. */
export function registerServiceWorker(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || isNative()) return;

  if (!import.meta.env.PROD) {
    void navigator.serviceWorker
      .getRegistrations()
      .then((registrations) =>
        Promise.all(
          registrations
            .filter((registration) => registration.active?.scriptURL.endsWith(SW_URL))
            .map((registration) => registration.unregister()),
        ),
      )
      .catch(() => {});
    return;
  }

  const start = () => {
    void setup().catch((err) => console.warn('[SW] registro:', err));
  };
  // Depois do load, para não disputar banda com o primeiro carregamento.
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
}
