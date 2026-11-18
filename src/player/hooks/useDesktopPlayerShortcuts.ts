import React, { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { AppScreen } from '../../types/player';
import { MINI_APP_SCREENS } from '../lib/screenHistoryModel';

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  );
}

/** Controles de mídia para os atalhos de teclado (J05). Passe undefined sem fita carregada. */
export interface PlayerMediaShortcuts {
  toggle: () => void;
  /** Só áudio avança/recua; vídeo do Nokia fica de fora. */
  canSeek: boolean;
  seekBy: (deltaSeconds: number) => void;
  toggleMute: () => void;
}

const SEEK_STEP_S = 10;

/** Espaço no botão, link ou slider já tem ação nativa; não duplicar. */
function ownsSpaceKey(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest('button, a, [role="slider"]'));
}

/**
 * Atalhos de teclado para viewport desktop (≥1024px).
 * Espaço = tocar/pausar, setas = ±10 s, M = mudo (só na tela do player), P = perfil, Esc = fechar overlay/mini-app / voltar à tela anterior.
 */
export function useDesktopPlayerShortcuts(
  screen: AppScreen,
  setScreen: Dispatch<SetStateAction<AppScreen>>,
  enabled: boolean,
  onCloseEvidence: (() => void) | undefined,
  hasCampaign: boolean,
  goBack: (fallback: AppScreen) => void,
  exitMiniApp: () => void,
  media?: PlayerMediaShortcuts,
): void {
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === 'Escape') {
        if (onCloseEvidence) {
          onCloseEvidence();
          return;
        }
        // Diálogo aberto (menu, metadata) fecha a si mesmo; não navegar por baixo dele
        if (document.querySelector('[aria-modal="true"]')) return;
        if (screen === 'campaignSelection') {
          // Só volta ao player se já houver missão ativa
          if (hasCampaign) {
            e.preventDefault();
            setScreen('player');
          }
          return;
        }
        if (screen === 'agentDossier') {
          // Volta para onde o dossiê foi aberto (perfil ou seleção de missão)
          e.preventDefault();
          goBack('campaignSelection');
          return;
        }
        if (screen === 'profile') {
          e.preventDefault();
          setScreen('player');
          return;
        }
        if (MINI_APP_SCREENS.has(screen)) {
          e.preventDefault();
          exitMiniApp();
        }
        return;
      }

      if (media && screen === 'player' && !document.querySelector('[aria-modal="true"]')) {
        if (e.key === ' ' && !ownsSpaceKey(e.target)) {
          e.preventDefault();
          media.toggle();
          return;
        }
        if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && media.canSeek && !ownsSpaceKey(e.target)) {
          e.preventDefault();
          media.seekBy(e.key === 'ArrowRight' ? SEEK_STEP_S : -SEEK_STEP_S);
          return;
        }
        if (e.key === 'm' || e.key === 'M') {
          e.preventDefault();
          media.toggleMute();
          return;
        }
      }

      if ((e.key === 'p' || e.key === 'P') && screen === 'player') {
        e.preventDefault();
        setScreen('profile');
        return;
      }

      if ((e.key === 'p' || e.key === 'P') && screen === 'profile') {
        e.preventDefault();
        setScreen('player');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, screen, setScreen, onCloseEvidence, hasCampaign, goBack, exitMiniApp, media]);
}

/** True quando a viewport é desktop larga. */
export function useIsDesktopViewport(minWidth = 1024): boolean {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(`(min-width: ${minWidth}px)`).matches
  );

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${minWidth}px)`);
    const onChange = () => setIsDesktop(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [minWidth]);

  return isDesktop;
}
