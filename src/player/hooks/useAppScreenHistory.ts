import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { AppScreen, PlayerData } from '../../types/player';
import {
  TRACKED_SCREENS,
  buildEntryState,
  buildLoggedOutSearch,
  buildScreenSearch,
  findMiniAppExit,
  mirrorMoveTo,
  mirrorPush,
  mirrorReplace,
  planOverlayClose,
  planOverlayOpen,
  planPop,
  planScreenChange,
  readPopState,
  seedMirror,
  stripLimboState,
} from '../lib/screenHistoryModel';
import type { HistoryEntry, HistoryMirror, HistoryOverlay, PopRead } from '../lib/screenHistoryModel';

/** Sem `popstate` até aqui, o espelho perdeu a referência e é re-semeado. */
const TRAVERSAL_TIMEOUT_MS = 1000;

interface PendingTraversal {
  /** sync: app → histórico; skip: pulo de overlay obsoleto; logout: volta ao início da sessão. */
  purpose: 'sync' | 'skip' | 'logout';
  timer: number;
}

export interface UseAppScreenHistoryOptions {
  screen: AppScreen;
  setScreen: Dispatch<SetStateAction<AppScreen>>;
  /** Conta autenticada. Ao desligar (logout), o histórico volta ao início da sessão. */
  enabled: boolean;
  playerDataRef: RefObject<PlayerData | null>;
  /** Limpeza da troca de agente (áudio, sync, playerData) ao voltar para a seleção. */
  onCharacterSwitch: () => void;
  /** Voltar do browser fechou o overlay: o dono do estado precisa refletir. */
  onOverlayDismiss: (overlay: HistoryOverlay) => void;
}

export interface AppScreenHistoryControls {
  /** Voltar de verdade (entrada anterior desta sessão); sem histórico, vai para `fallback`. */
  goBack: (fallback: AppScreen) => void;
  /** Fecha um mini-app voltando à última tela que não é mini-app (reserva: player). */
  exitMiniApp: () => void;
  openOverlay: (overlay: HistoryOverlay) => void;
  closeOverlay: (overlay: HistoryOverlay) => void;
}

function newSessionId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function urlWithSearch(search: string): string {
  return `${window.location.pathname}${search}${window.location.hash}`;
}

/**
 * Sincroniza AppScreen com a History API para o botão Voltar do browser.
 *
 * Mantém um espelho das entradas criadas nesta sessão; `screenHistoryModel`
 * decide push, replace ou `history.go` (tela já existente abaixo do cursor).
 * O app é a fonte da verdade nas mudanças que ele inicia; no `popstate` do
 * usuário, a entrada de destino vence, com as guardas de agente carregado.
 */
export function useAppScreenHistory(options: UseAppScreenHistoryOptions): AppScreenHistoryControls {
  const { screen, enabled } = options;

  const mirrorRef = useRef<HistoryMirror | null>(null);
  const pendingRef = useRef<PendingTraversal | null>(null);
  const overlayRef = useRef<HistoryOverlay | null>(null);
  /** Houve sessão e ela terminou (logout). Antes do primeiro login não mexemos no URL. */
  const sessionEndedRef = useRef(false);
  const screenRef = useRef(screen);
  const enabledRef = useRef(enabled);
  const optionsRef = useRef(options);

  // Layout effect: os refs ficam atualizados antes de qualquer efeito passivo (inclusive dos filhos).
  useLayoutEffect(() => {
    screenRef.current = screen;
    enabledRef.current = enabled;
    optionsRef.current = options;
  });

  const engine = useMemo(() => {
    const writeSeed = (base: unknown, entry: HistoryEntry) => {
      const mirror = seedMirror(newSessionId(), entry);
      window.history.replaceState(
        buildEntryState(base, mirror.session, 0, entry),
        '',
        urlWithSearch(buildScreenSearch(window.location.search, entry.screen)),
      );
      mirrorRef.current = mirror;
    };

    const writeEntry = (mode: 'push' | 'replace', mirror: HistoryMirror, entry: HistoryEntry) => {
      const next = mode === 'push' ? mirrorPush(mirror, entry) : mirrorReplace(mirror, entry);
      const state = buildEntryState(window.history.state, next.session, next.cursor, entry);
      const url = urlWithSearch(buildScreenSearch(window.location.search, entry.screen));
      if (mode === 'push') window.history.pushState(state, '', url);
      else window.history.replaceState(state, '', url);
      mirrorRef.current = next;
    };

    /** Entrada do início da sessão sem `s`, `mode` nem chaves do LimboOS. */
    const finishLogout = () => {
      window.history.replaceState(
        stripLimboState(window.history.state),
        '',
        urlWithSearch(buildLoggedOutSearch(window.location.search)),
      );
      mirrorRef.current = null;
      overlayRef.current = null;
    };

    const clearPending = () => {
      if (pendingRef.current) window.clearTimeout(pendingRef.current.timer);
      pendingRef.current = null;
    };

    const traverse = (delta: number, purpose: PendingTraversal['purpose']) => {
      if (delta === 0) return; // history.go(0) recarrega a página
      clearPending();
      const timer = window.setTimeout(() => {
        if (pendingRef.current?.timer !== timer) return;
        pendingRef.current = null;
        if (purpose === 'logout') {
          finishLogout();
          return;
        }
        mirrorRef.current = null;
        reconcile();
      }, TRAVERSAL_TIMEOUT_MS);
      pendingRef.current = { purpose, timer };
      window.history.go(delta);
    };

    /** App → histórico: leva a entrada atual até `screen` e o overlay aberto. */
    const reconcile = () => {
      if (!enabledRef.current || pendingRef.current) return;
      const current = screenRef.current;
      if (!TRACKED_SCREENS.has(current)) return;

      const plan = planScreenChange(mirrorRef.current, current);
      if (plan.kind === 'go') {
        // O overlay é reavaliado quando o popstate desta travessia chegar.
        traverse(plan.delta, 'sync');
        return;
      }
      if (plan.kind === 'seed') writeSeed(window.history.state, { screen: current });
      else if ((plan.kind === 'push' || plan.kind === 'replace') && mirrorRef.current) {
        writeEntry(plan.kind, mirrorRef.current, { screen: current });
      }

      const mirror = mirrorRef.current;
      const overlay = overlayRef.current;
      const overlayPlan = overlay ? planOverlayOpen(mirror, overlay) : planOverlayClose(mirror);
      if (overlayPlan.kind === 'go') traverse(overlayPlan.delta, 'sync');
      else if (overlayPlan.kind === 'push' && mirror && overlay) {
        writeEntry('push', mirror, { screen: current, overlay });
      }
    };

    /** Histórico → app, para o Voltar/Avançar do usuário. */
    const applyUserPop = (read: PopRead, eventState: unknown) => {
      const mirror = mirrorRef.current;
      const opts = optionsRef.current;
      const decision = planPop(
        mirror,
        read,
        { overlayOpen: overlayRef.current !== null, hasPlayerData: Boolean(opts.playerDataRef.current) },
        screenRef.current,
      );

      if (decision.kind === 'skip') {
        if (mirror) mirrorRef.current = mirrorMoveTo(mirror, decision.cursor);
        traverse(decision.delta, 'skip');
        return;
      }

      if (decision.closeOverlay && overlayRef.current) {
        const overlay = overlayRef.current;
        overlayRef.current = null;
        opts.onOverlayDismiss(overlay);
      }

      if (decision.kind === 'reseed') writeSeed(eventState, { screen: decision.screen });
      else if (mirror) mirrorRef.current = mirrorMoveTo(mirror, decision.cursor);

      if (decision.switchCharacter) {
        opts.onCharacterSwitch();
        return;
      }
      // Mesma tela: setScreen não renderiza de novo, então a reconciliação roda aqui.
      if (decision.screen === screenRef.current) reconcile();
      else opts.setScreen(decision.screen);
    };

    const onPopState = (event: PopStateEvent) => {
      const pending = pendingRef.current;
      if (pending) {
        clearPending();
        const read = readPopState(mirrorRef.current, event.state);
        const mirror = mirrorRef.current;
        mirrorRef.current = read.kind === 'known' && mirror ? mirrorMoveTo(mirror, read.idx) : null;

        if (pending.purpose === 'logout') {
          finishLogout();
          return;
        }
        if (pending.purpose === 'sync') {
          reconcile();
          return;
        }
        // skip: a entrada onde o pulo terminou vale como o Voltar do usuário.
        applyUserPop(readPopState(mirrorRef.current, event.state), event.state);
        return;
      }

      if (!enabledRef.current) {
        // Após o logout, o Avançar pode trazer entradas antigas: sem `mode` nem `s`.
        if (sessionEndedRef.current && event.state?.limboSession) finishLogout();
        return;
      }

      applyUserPop(readPopState(mirrorRef.current, event.state), event.state);
    };

    const onDisable = () => {
      if (pendingRef.current?.purpose === 'logout') return;
      clearPending();
      overlayRef.current = null;
      const mirror = mirrorRef.current;
      if (!mirror) return;
      sessionEndedRef.current = true;
      if (mirror.cursor > 0) traverse(-mirror.cursor, 'logout');
      else finishLogout();
    };

    const controls: AppScreenHistoryControls = {
      goBack: (fallback) => {
        if (pendingRef.current) return;
        const mirror = mirrorRef.current;
        if (enabledRef.current && mirror && mirror.cursor > 0) {
          window.history.back();
          return;
        }
        optionsRef.current.setScreen(fallback);
      },
      exitMiniApp: () => {
        optionsRef.current.setScreen(findMiniAppExit(mirrorRef.current) ?? 'player');
      },
      openOverlay: (overlay) => {
        overlayRef.current = overlay;
        reconcile();
      },
      closeOverlay: (overlay) => {
        if (overlayRef.current !== overlay) return;
        overlayRef.current = null;
        reconcile();
      },
    };

    return { reconcile, onPopState, onDisable, clearPending, controls };
  }, []);

  // App → histórico
  useEffect(() => {
    if (enabled) {
      sessionEndedRef.current = false;
      engine.reconcile();
    } else {
      engine.onDisable();
    }
  }, [engine, screen, enabled]);

  // Histórico → app
  useEffect(() => {
    window.addEventListener('popstate', engine.onPopState);
    return () => {
      window.removeEventListener('popstate', engine.onPopState);
      engine.clearPending();
    };
  }, [engine]);

  return engine.controls;
}
