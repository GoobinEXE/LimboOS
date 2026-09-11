import { useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { AppScreen } from '../../types/player';

/** Telas sincronizadas com o histórico do browser (exceto login). */
const TRACKED_SCREENS: ReadonlySet<AppScreen> = new Set([
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

interface LimboHistoryState {
  limboScreen?: AppScreen;
}

function buildScreenUrl(screen: AppScreen): string {
  const url = new URL(window.location.href);
  // Preserva mode=play e demais params
  if (screen === 'characterSelection' || screen === 'player') {
    url.searchParams.delete('s');
  } else {
    url.searchParams.set('s', screen);
  }
  const qs = url.searchParams.toString();
  return qs ? `${url.pathname}?${qs}` : url.pathname;
}

/**
 * Sincroniza AppScreen com History API para o botão Voltar do browser.
 * Navegação "para cima" (ex.: profile → player) usa replaceState para não poluir o histórico.
 */
export function useAppScreenHistory(
  screen: AppScreen,
  setScreen: Dispatch<SetStateAction<AppScreen>>,
  enabled: boolean
): void {
  const applyingPopRef = useRef(false);
  const lastPushedRef = useRef<AppScreen | null>(null);

  // App → histórico
  useEffect(() => {
    if (!enabled || screen === 'login' || !TRACKED_SCREENS.has(screen)) return;
    if (applyingPopRef.current) {
      applyingPopRef.current = false;
      lastPushedRef.current = screen;
      return;
    }
    if (lastPushedRef.current === screen) return;

    const state: LimboHistoryState = { limboScreen: screen };
    const href = buildScreenUrl(screen);
    const prev = lastPushedRef.current;
    const prevDepth = prev ? screenDepth(prev) : -1;
    const nextDepth = screenDepth(screen);

    // Primeira tela pós-auth ou voltando na hierarquia: replace; avançando: push
    if (prev == null || nextDepth <= prevDepth) {
      window.history.replaceState(state, '', href);
    } else {
      window.history.pushState(state, '', href);
    }
    lastPushedRef.current = screen;
  }, [screen, enabled]);

  // Histórico → app
  useEffect(() => {
    if (!enabled) return;

    const onPopState = (event: PopStateEvent) => {
      const next = (event.state as LimboHistoryState | null)?.limboScreen;
      if (next && TRACKED_SCREENS.has(next)) {
        applyingPopRef.current = true;
        setScreen(next);
        return;
      }
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [enabled, setScreen]);

  // Reset ao desabilitar (logout)
  useEffect(() => {
    if (!enabled) {
      lastPushedRef.current = null;
    }
  }, [enabled]);
}

function screenDepth(screen: AppScreen): number {
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
