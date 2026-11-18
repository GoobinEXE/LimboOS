import { useSyncExternalStore } from 'react';
import { isNative } from './native/platform';
import { fetchBuildInfo, getLoadedBuildInfo, isEmptyBuildInfo, type BuildInfoFile } from './appInfo';

/**
 * Canal de versão do bundle web (F7).
 *
 * Base: o primeiro /build-info.json lido na sessão (`getLoadedBuildInfo`), que descreve
 * o build que esta aba carregou. Ao voltar o foco, ao voltar a rede e a cada 15 min com
 * a aba visível, lê o arquivo de novo sem cache e compara. Diferença vira o aviso
 * "nova versão" (P02, `UpdateNotice`). A recarga automática depois de chunk quebrado
 * (P04, `reloadOnce`) usa o mesmo canal: quando a recarga é bloqueada, o aviso aparece.
 * O service worker (P01) também: worker novo esperando vira o mesmo aviso.
 *
 * No app nativo o bundle vem empacotado no binário; a versão nova chega pela loja,
 * então a checagem fica desligada.
 */

export interface VersionSnapshot {
  /** Existe build publicado diferente do carregado (ou um chunk do build carregado sumiu). */
  updateAvailable: boolean;
  /** Build publicado lido do servidor; null quando o aviso veio só de chunk quebrado. */
  latest: BuildInfoFile | null;
  /** O usuário fechou o aviso deste build. */
  dismissed: boolean;
}

const CHECK_INTERVAL_MS = 15 * 60_000;
/** Foco, visibilidade e rede costumam disparar juntos: uma leitura basta. */
const MIN_CHECK_GAP_MS = 10_000;

const RELOAD_KEY = 'vite_reload_at';
const LEGACY_RELOAD_KEY = 'vite_reload';
const RELOAD_WINDOW_MS = 30_000;
const HEALTHY_BOOT_MS = 5_000;

let snapshot: VersionSnapshot = { updateAvailable: false, latest: null, dismissed: false };
const listeners = new Set<() => void>();
let dismissedKey: string | null = null;
let started = false;
let lastCheckAt = 0;
let inFlight: Promise<boolean> | null = null;
/** Uma recarga foi bloqueada nesta página: o boot não está saudável. */
let reloadBlocked = false;

function emit(): void {
  for (const listener of listeners) listener();
}

/** Identidade de um build, com o mesmo critério de `isDifferentBuild`. */
function stampKey(file: BuildInfoFile | null): string {
  if (!file) return 'stale-bundle';
  return import.meta.env.PROD ? `${file.commit ?? ''}@${file.builtAt ?? ''}` : (file.commit ?? '');
}

function isDifferentBuild(loaded: BuildInfoFile, latest: BuildInfoFile): boolean {
  if (isEmptyBuildInfo(loaded) || isEmptyBuildInfo(latest)) return false;
  if (loaded.commit && latest.commit && loaded.commit !== latest.commit) return true;
  // Mesmo commit com outro build também troca os hashes dos chunks. Em dev o predev
  // regrava builtAt a cada `npm run dev`, então lá só o commit conta.
  return import.meta.env.PROD && !!loaded.builtAt && !!latest.builtAt && loaded.builtAt !== latest.builtAt;
}

function markUpdate(latest: BuildInfoFile | null, forceVisible = false): void {
  const key = stampKey(latest);
  if (snapshot.updateAvailable && stampKey(snapshot.latest) === key && !(forceVisible && snapshot.dismissed)) return;
  snapshot = {
    updateAvailable: true,
    latest: latest ?? snapshot.latest,
    dismissed: forceVisible ? false : dismissedKey === key,
  };
  emit();
}

/** Lê /build-info.json agora e compara com o build carregado. Devolve se há versão nova. */
export function checkForUpdate(options?: { force?: boolean }): Promise<boolean> {
  if (typeof window === 'undefined' || isNative()) return Promise.resolve(false);
  if (inFlight) return inFlight;
  const now = Date.now();
  if (!options?.force && now - lastCheckAt < MIN_CHECK_GAP_MS) {
    return Promise.resolve(snapshot.updateAvailable);
  }
  lastCheckAt = now;
  inFlight = (async () => {
    const loaded = await getLoadedBuildInfo();
    // Sem base (boot sem rede): a próxima checagem tenta de novo.
    if (isEmptyBuildInfo(loaded)) return snapshot.updateAvailable;
    const latest = await fetchBuildInfo();
    if (isDifferentBuild(loaded, latest)) markUpdate(latest);
    return snapshot.updateAvailable;
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/** Liga a checagem (idempotente). No-op no app nativo e fora do navegador. */
export function startVersionChannel(): void {
  if (started || typeof window === 'undefined' || isNative()) return;
  started = true;
  // Fixa a base o quanto antes: é o build desta aba.
  void getLoadedBuildInfo();

  const checkIfVisible = () => {
    if (document.visibilityState === 'visible') void checkForUpdate();
  };
  document.addEventListener('visibilitychange', checkIfVisible);
  window.addEventListener('focus', checkIfVisible);
  window.addEventListener('online', checkIfVisible);
  window.setInterval(checkIfVisible, CHECK_INTERVAL_MS);
}

/**
 * Avisa que um chunk do build carregado não existe mais (deploy novo) e a recarga
 * automática não pôde acontecer. Mostra o aviso mesmo que tenha sido fechado.
 */
export function notifyStaleBundle(): void {
  if (typeof window === 'undefined' || isNative()) return;
  markUpdate(snapshot.latest, true);
  void checkForUpdate({ force: true });
}

/** Fecha o aviso do build atual; um build ainda mais novo volta a avisar. */
export function dismissUpdate(): void {
  if (!snapshot.updateAvailable || snapshot.dismissed) return;
  dismissedKey = stampKey(snapshot.latest);
  snapshot = { ...snapshot, dismissed: true };
  emit();
}

/** Ativa o service worker novo que espera; `true` se a troca (e a recarga) começou. */
let applyWorkerUpdate: (() => boolean) | null = null;

/**
 * O service worker (src/lib/serviceWorker.ts) instalou uma versão nova que espera.
 * Mostra o aviso; "Atualizar" chama `apply`, que ativa o worker e recarrega uma vez.
 */
export function notifyWorkerUpdate(apply: () => boolean): void {
  if (typeof window === 'undefined' || isNative()) return;
  applyWorkerUpdate = apply;
  markUpdate(snapshot.latest, true);
}

/**
 * "Atualizar" no aviso. Com worker novo esperando, ativa a troca (ele recarrega com
 * `reloadOnce`); a tentativa vale uma vez, e um segundo toque recarrega direto.
 */
export function reloadToUpdate(): void {
  const apply = applyWorkerUpdate;
  applyWorkerUpdate = null;
  if (apply && apply()) return;
  window.location.reload();
}

/** Erro de import dinâmico (chunk do build antigo apagado pelo deploy). */
export function isChunkLoadError(reason: unknown): boolean {
  const message =
    typeof reason === 'string'
      ? reason
      : reason && typeof reason === 'object' && typeof (reason as { message?: unknown }).message === 'string'
        ? (reason as { message: string }).message
        : '';
  return /failed to fetch dynamically imported module|importing a module script failed|error loading dynamically imported module|unable to preload css/i.test(
    message,
  );
}

/**
 * Recarga automática depois de chunk quebrado (P04), no máximo uma a cada 30 s.
 * Devolve `true` se a página vai recarregar. Com `false` o chamador deixa o erro subir
 * ao ErrorBoundary em vez de entrar em laço, e o aviso de versão aparece.
 */
export function reloadOnce(): boolean {
  const now = Date.now();
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY)) || 0;
    if (last && now - last < RELOAD_WINDOW_MS && now >= last) {
      reloadBlocked = true;
      notifyStaleBundle();
      return false;
    }
    sessionStorage.setItem(RELOAD_KEY, String(now));
  } catch {
    // Sem sessionStorage não há como lembrar a tentativa: recarregar arriscaria laço.
    reloadBlocked = true;
    notifyStaleBundle();
    return false;
  }
  window.location.reload();
  return true;
}

/**
 * Chame depois do primeiro render. Passados 5 s sem chunk quebrado, apaga a marca da
 * última recarga: um segundo deploy na mesma sessão ganha direito a outra tentativa.
 */
export function markBootHealthy(): void {
  if (typeof window === 'undefined') return;
  const bootAt = Date.now();
  try {
    sessionStorage.removeItem(LEGACY_RELOAD_KEY);
  } catch {
    // sem storage
  }
  window.setTimeout(() => {
    if (reloadBlocked) return;
    try {
      const last = Number(sessionStorage.getItem(RELOAD_KEY)) || 0;
      if (last && last <= bootAt) sessionStorage.removeItem(RELOAD_KEY);
    } catch {
      // sem storage
    }
  }, HEALTHY_BOOT_MS);
}

export function getVersionSnapshot(): VersionSnapshot {
  return snapshot;
}

export function subscribeVersion(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export interface VersionUpdateState {
  /** Mostrar o aviso: há versão nova e o usuário não o fechou. */
  available: boolean;
  latest: BuildInfoFile | null;
  reload: () => void;
  dismiss: () => void;
}

/** Estado do aviso de nova versão para a UI. */
export function useVersionUpdate(): VersionUpdateState {
  const state = useSyncExternalStore(subscribeVersion, getVersionSnapshot, getVersionSnapshot);
  return {
    available: state.updateAvailable && !state.dismissed,
    latest: state.latest,
    reload: reloadToUpdate,
    dismiss: dismissUpdate,
  };
}
