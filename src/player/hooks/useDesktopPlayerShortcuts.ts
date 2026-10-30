import React, { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { AppScreen } from '../../types/player';

const MINI_APP_SCREENS: ReadonlySet<AppScreen> = new Set([
  'bios',
  'limbo',
  'diskRepair',
  'macos',
  'windows95',
  'agentDossier',
  'campaignSelection',
  'profile',
]);

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

/**
 * Atalhos de teclado para viewport desktop (≥1024px).
 * P = perfil, Esc = fechar overlay/mini-app / voltar ao player.
 */
export function useDesktopPlayerShortcuts(
  screen: AppScreen,
  setScreen: Dispatch<SetStateAction<AppScreen>>,
  enabled: boolean,
  onCloseEvidence?: () => void,
  hasCampaign?: boolean,
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
        if (MINI_APP_SCREENS.has(screen)) {
          e.preventDefault();
          setScreen(screen === 'agentDossier' ? 'campaignSelection' : 'player');
        }
        return;
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
  }, [enabled, screen, setScreen, onCloseEvidence, hasCampaign]);
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
