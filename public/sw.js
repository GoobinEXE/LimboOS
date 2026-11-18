/*
 * Service worker do LimboOS (P01). Só o site de produção registra
 * (src/lib/serviceWorker.ts); o app nativo e o `npm run dev` nunca.
 *
 * - Navegação: rede primeiro; sem rede, o shell (/index.html) guardado.
 * - /assets/**: cache primeiro (nomes com hash, imutáveis), com teto de entradas.
 * - Todo o resto passa direto: outros hosts (Firestore, Functions, Storage, Google),
 *   métodos que não são GET, pedidos com Range, /build-info.json, /sw.js e /__/*.
 *
 * Desligar: trocar SW_ENABLED para false e publicar. O worker se desinstala e apaga
 * os caches; o registro no cliente faz o mesmo quando /sw.js some (404).
 * Mudou a lógica? Suba SW_VERSION: os caches antigos são apagados na ativação.
 */
const SW_ENABLED = true;
const SW_VERSION = 'v1';

const CACHE_PREFIX = 'limboos-';
const SHELL_CACHE = `${CACHE_PREFIX}shell-${SW_VERSION}`;
const ASSET_CACHE = `${CACHE_PREFIX}assets-${SW_VERSION}`;
const SHELL_URL = '/index.html';
const MAX_ASSETS = 200;

const BYPASS_PATHS = new Set(['/sw.js', '/build-info.json', '/licenses.json']);

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data) return;
  if (data.type === 'SKIP_WAITING') self.skipWaiting();
  // Chunks que a página carregou antes de o worker assumir (primeira visita).
  if (data.type === 'CACHE_ASSETS' && SW_ENABLED && Array.isArray(data.urls)) event.waitUntil(cacheAssets(data.urls));
});

if (!SW_ENABLED) {
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', (event) => {
    event.waitUntil(
      (async () => {
        await deleteCaches(() => true);
        await self.registration.unregister();
      })(),
    );
  });
} else {
  self.addEventListener('install', (event) => {
    event.waitUntil(
      (async () => {
        await precacheShell();
        // Primeira instalação assume na hora. Atualização espera o aviso de nova versão
        // (UpdateNotice manda SKIP_WAITING), para não trocar o worker no meio da sessão.
        if (!self.registration.active) await self.skipWaiting();
      })(),
    );
  });

  self.addEventListener('activate', (event) => {
    event.waitUntil(
      (async () => {
        const keep = new Set([SHELL_CACHE, ASSET_CACHE]);
        await deleteCaches((name) => !keep.has(name));
        if (self.registration.navigationPreload) {
          await self.registration.navigationPreload.enable().catch(() => {});
        }
        await self.clients.claim();
      })(),
    );
  });

  self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET' || request.headers.has('range')) return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;
    if (BYPASS_PATHS.has(url.pathname) || url.pathname.startsWith('/__/')) return;

    if (request.mode === 'navigate') {
      event.respondWith(networkFirstNavigation(event, url));
      return;
    }
    if (url.pathname.startsWith('/assets/')) {
      event.respondWith(cacheFirstAsset(request));
    }
  });
}

async function deleteCaches(shouldDelete) {
  const names = await caches.keys();
  await Promise.all(
    names.filter((name) => name.startsWith(CACHE_PREFIX) && shouldDelete(name)).map((name) => caches.delete(name)),
  );
}

/** Guarda o shell e os assets que ele referencia (entrada, CSS, modulepreload). */
async function precacheShell() {
  try {
    const response = await fetch(SHELL_URL, { cache: 'reload' });
    if (!response.ok) return;
    const html = await response.clone().text();
    const shell = await caches.open(SHELL_CACHE);
    await shell.put(SHELL_URL, response);

    const assets = [];
    for (const match of html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)) assets.push(match[1]);
    await cacheAssets(assets);
  } catch {
    // Sem rede na instalação: o shell entra no cache na próxima navegação.
  }
}

/** Guarda assets do próprio site que ainda não estão no cache. */
async function cacheAssets(urls) {
  const assetCache = await caches.open(ASSET_CACHE);
  const paths = new Set();
  for (const raw of urls) {
    try {
      const url = new URL(raw, self.location.origin);
      if (url.origin === self.location.origin && url.pathname.startsWith('/assets/')) paths.add(url.pathname);
    } catch {
      // URL inválida: ignora
    }
  }
  await Promise.all(
    [...paths].map(async (path) => {
      if (await assetCache.match(path)) return;
      try {
        const res = await fetch(path);
        if (res.ok) await assetCache.put(path, res);
      } catch {
        // sem rede: fica para a próxima visita
      }
    }),
  );
}

async function networkFirstNavigation(event, url) {
  try {
    const preloaded = await event.preloadResponse;
    const response = preloaded || (await fetch(event.request));
    // /convite/* vem de uma Function com meta própria: não serve de shell.
    const isShell =
      response.ok &&
      response.type === 'basic' &&
      !url.pathname.startsWith('/convite/') &&
      (response.headers.get('content-type') || '').includes('text/html');
    if (isShell) {
      const copy = response.clone();
      event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.put(SHELL_URL, copy)));
    }
    return response;
  } catch (err) {
    const cached = await caches.match(SHELL_URL, { cacheName: SHELL_CACHE });
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirstAsset(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request, { ignoreVary: true });
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && response.type === 'basic') {
    await cache.put(request, response.clone());
    void trimAssets(cache);
  }
  return response;
}

/** Deploys novos acumulam chunks: mantém só as entradas mais recentes. */
async function trimAssets(cache) {
  const keys = await cache.keys();
  const excess = keys.length - MAX_ASSETS;
  if (excess <= 0) return;
  await Promise.all(keys.slice(0, excess).map((key) => cache.delete(key)));
}
