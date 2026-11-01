import type { AppScreen } from '../../types/player';

/**
 * Modelo puro do histórico de telas do jogador (sem React, sem `window`).
 *
 * O hook `useAppScreenHistory` mantém um espelho das entradas que criou no
 * `window.history` nesta sessão e pergunta a este módulo o que fazer quando a
 * tela muda (app → histórico) e quando chega um `popstate` (histórico → app).
 */

export type HistoryOverlay = 'evidence';

export interface HistoryEntry {
  screen: AppScreen;
  overlay?: HistoryOverlay;
}

/** Espelho das entradas desta sessão: índice 0 é a semente, `cursor` é a entrada atual. */
export interface HistoryMirror {
  session: string;
  entries: HistoryEntry[];
  cursor: number;
}

/** Chaves gravadas em `history.state`, ao lado das chaves do React Router. */
export interface LimboHistoryState {
  limboScreen?: AppScreen;
  limboIdx?: number;
  limboSession?: string;
  limboOverlay?: HistoryOverlay;
}

export type HistoryPlan =
  | { kind: 'seed' }
  | { kind: 'noop' }
  | { kind: 'push' }
  | { kind: 'replace' }
  | { kind: 'go'; delta: number; targetIdx: number };

/** Telas sincronizadas com o histórico do browser (login fica de fora). */
export const TRACKED_SCREENS: ReadonlySet<AppScreen> = new Set<AppScreen>([
  'characterSelection',
  'campaignSelection',
  'player',
  'profile',
  'agentDossier',
  'bios',
  'limbo',
  'diskRepair',
  'macos',
  'windows95',
]);

/** Mini-apps do portal: ao fechar, voltam à última tela que não é mini-app. */
export const MINI_APP_SCREENS: ReadonlySet<AppScreen> = new Set<AppScreen>([
  'bios',
  'limbo',
  'diskRepair',
  'macos',
  'windows95',
]);

const LIMBO_STATE_KEYS = ['limboScreen', 'limboIdx', 'limboSession', 'limboOverlay'] as const;

export function screenDepth(screen: AppScreen): number {
  switch (screen) {
    case 'characterSelection':
      return 1;
    case 'campaignSelection':
      return 2;
    case 'player':
      return 3;
    case 'profile':
    case 'agentDossier':
    case 'bios':
    case 'limbo':
    case 'diskRepair':
    case 'macos':
    case 'windows95':
      return 4;
    default:
      return 0;
  }
}

/** Telas que só renderizam com um agente carregado (`playerData`). */
export function requiresPlayerData(screen: AppScreen): boolean {
  return screen !== 'login' && screen !== 'characterSelection';
}

/** Índice da última entrada não-overlay de `screen` abaixo do cursor, ou -1. */
function findAncestor(mirror: HistoryMirror, screen: AppScreen): number {
  for (let j = mirror.cursor - 1; j >= 0; j--) {
    const entry = mirror.entries[j];
    if (entry && entry.screen === screen && !entry.overlay) return j;
  }
  return -1;
}

/**
 * App → histórico. Regra central: se `next` já existe abaixo do cursor, volta
 * até ela com `go` em vez de empilhar uma duplicata. Isso colapsa perfil → player,
 * troca de agente → seleção e limbo → bios.
 */
export function planScreenChange(mirror: HistoryMirror | null, next: AppScreen): HistoryPlan {
  const current = mirror?.entries[mirror.cursor];
  if (!mirror || !current) return { kind: 'seed' };
  if (current.screen === next && !current.overlay) return { kind: 'noop' };

  const ancestor = findAncestor(mirror, next);
  if (ancestor >= 0) return { kind: 'go', delta: ancestor - mirror.cursor, targetIdx: ancestor };

  // Entrada de overlay no topo vira a tela nova: não sobra overlay morto no histórico.
  if (current.overlay) return { kind: 'replace' };

  // Subir na hierarquia sem ancestral (ex.: reseed após reload) substitui.
  if (screenDepth(next) < screenDepth(current.screen)) return { kind: 'replace' };

  // Mesma profundidade empilha: Voltar a partir de Limbo ou Win95 retorna ao BIOS.
  return { kind: 'push' };
}

export function planOverlayOpen(mirror: HistoryMirror | null, overlay: HistoryOverlay): HistoryPlan {
  const current = mirror?.entries[mirror.cursor];
  if (!mirror || !current) return { kind: 'noop' };
  if (current.overlay === overlay) return { kind: 'noop' };
  return { kind: 'push' };
}

/** Fechar pela UI desfaz a entrada do overlay; a tela por baixo é a mesma. */
export function planOverlayClose(mirror: HistoryMirror | null): HistoryPlan {
  const current = mirror?.entries[mirror.cursor];
  if (!mirror || !current?.overlay || mirror.cursor === 0) return { kind: 'noop' };
  return { kind: 'go', delta: -1, targetIdx: mirror.cursor - 1 };
}

/* ─── Atualização do espelho ─────────────────────────────────── */

export function seedMirror(session: string, entry: HistoryEntry): HistoryMirror {
  return { session, entries: [entry], cursor: 0 };
}

export function mirrorPush(mirror: HistoryMirror, entry: HistoryEntry): HistoryMirror {
  const entries = mirror.entries.slice(0, mirror.cursor + 1);
  entries.push(entry);
  return { ...mirror, entries, cursor: entries.length - 1 };
}

export function mirrorReplace(mirror: HistoryMirror, entry: HistoryEntry): HistoryMirror {
  const entries = mirror.entries.slice();
  entries[mirror.cursor] = entry;
  return { ...mirror, entries };
}

export function mirrorMoveTo(mirror: HistoryMirror, idx: number): HistoryMirror {
  return { ...mirror, cursor: idx };
}

/** Última tela abaixo do cursor que não é mini-app (destino de `exitMiniApp`), ou null. */
export function findMiniAppExit(mirror: HistoryMirror | null): AppScreen | null {
  if (!mirror) return null;
  for (let j = mirror.cursor - 1; j >= 0; j--) {
    const entry = mirror.entries[j];
    if (entry && !entry.overlay && !MINI_APP_SCREENS.has(entry.screen)) return entry.screen;
  }
  return null;
}

/* ─── Histórico → app ────────────────────────────────────────── */

export type PopRead =
  | { kind: 'known'; idx: number; delta: number; entry: HistoryEntry }
  /** Outra sessão (reload, logout anterior) ou estado sem chaves do LimboOS. */
  | { kind: 'foreign'; screen: AppScreen | null };

function isTrackedScreen(value: unknown): value is AppScreen {
  return typeof value === 'string' && TRACKED_SCREENS.has(value as AppScreen);
}

export function readPopState(mirror: HistoryMirror | null, state: unknown): PopRead {
  const raw = (state && typeof state === 'object' ? state : {}) as LimboHistoryState;
  const screen = isTrackedScreen(raw.limboScreen) ? raw.limboScreen : null;
  const idx = raw.limboIdx;

  if (
    mirror &&
    screen &&
    raw.limboSession === mirror.session &&
    typeof idx === 'number' &&
    Number.isInteger(idx) &&
    idx >= 0 &&
    idx < mirror.entries.length
  ) {
    const entry = mirror.entries[idx];
    if (entry && entry.screen === screen && (entry.overlay ?? null) === (raw.limboOverlay ?? null)) {
      return { kind: 'known', idx, delta: idx - mirror.cursor, entry };
    }
  }
  return { kind: 'foreign', screen };
}

export interface PopContext {
  /** O leitor de evidência está aberto agora. */
  overlayOpen: boolean;
  hasPlayerData: boolean;
}

export type PopDecision =
  /** Entrada de overlay sem overlay aberto: pula mais um passo na mesma direção. */
  | { kind: 'skip'; cursor: number; delta: number }
  | {
      kind: 'apply';
      cursor: number;
      screen: AppScreen;
      /** Voltou à seleção com agente carregado: rodar a limpeza da troca de agente. */
      switchCharacter: boolean;
      closeOverlay: boolean;
    }
  /** Estado estrangeiro: re-semeia o espelho nesta entrada com `screen`. */
  | { kind: 'reseed'; screen: AppScreen; switchCharacter: boolean; closeOverlay: boolean };

/** Tela que dá para mostrar de fato, dado o que está carregado. */
function guardScreen(screen: AppScreen, ctx: PopContext): { screen: AppScreen; switchCharacter: boolean } {
  if (requiresPlayerData(screen) && !ctx.hasPlayerData) {
    return { screen: 'characterSelection', switchCharacter: false };
  }
  if (screen === 'characterSelection' && ctx.hasPlayerData) {
    return { screen, switchCharacter: true };
  }
  return { screen, switchCharacter: false };
}

/**
 * Decide o efeito de um `popstate` iniciado pelo usuário, nesta ordem:
 * overlay aberto (fecha), overlay obsoleto (pula), tela que exige agente sem
 * agente (seleção), seleção com agente (limpeza da troca) e o caso comum.
 */
export function planPop(
  mirror: HistoryMirror | null,
  read: PopRead,
  ctx: PopContext,
  currentScreen: AppScreen,
): PopDecision {
  if (read.kind === 'foreign') {
    const guarded = guardScreen(read.screen ?? currentScreen, ctx);
    return { kind: 'reseed', ...guarded, closeOverlay: ctx.overlayOpen };
  }

  if (ctx.overlayOpen) {
    const guarded = guardScreen(read.entry.screen, ctx);
    return { kind: 'apply', cursor: read.idx, ...guarded, closeOverlay: true };
  }

  if (read.entry.overlay) {
    const last = (mirror?.entries.length ?? 1) - 1;
    const delta = read.delta > 0 && read.idx < last ? 1 : -1;
    // Overlay na semente não tem para onde pular: trata como a tela dele.
    if (!(read.idx === 0 && delta < 0)) return { kind: 'skip', cursor: read.idx, delta };
  }

  const guarded = guardScreen(read.entry.screen, ctx);
  return { kind: 'apply', cursor: read.idx, ...guarded, closeOverlay: false };
}

/* ─── history.state e URL ────────────────────────────────────── */

/** Remove as chaves do LimboOS e preserva as do React Router (`usr`, `key`, `idx`). */
export function stripLimboState(state: unknown): Record<string, unknown> {
  if (!state || typeof state !== 'object') return {};
  const copy: Record<string, unknown> = { ...(state as Record<string, unknown>) };
  for (const key of LIMBO_STATE_KEYS) delete copy[key];
  return copy;
}

export function buildEntryState(
  base: unknown,
  session: string,
  idx: number,
  entry: HistoryEntry,
): Record<string, unknown> {
  const next: Record<string, unknown> = {
    ...stripLimboState(base),
    limboScreen: entry.screen,
    limboIdx: idx,
    limboSession: session,
  };
  if (entry.overlay) next.limboOverlay = entry.overlay;
  return next;
}

/** `?s=` para telas internas; seleção e player ficam sem. Preserva `mode=play` e o resto. */
export function buildScreenSearch(search: string, screen: AppScreen): string {
  const params = new URLSearchParams(search);
  if (screen === 'characterSelection' || screen === 'player') {
    params.delete('s');
  } else {
    params.set('s', screen);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/** Saída da sessão: sem `s` nem `mode`. */
export function buildLoggedOutSearch(search: string): string {
  const params = new URLSearchParams(search);
  params.delete('s');
  params.delete('mode');
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}
