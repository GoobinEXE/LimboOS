import React, { useCallback } from 'react';
import { AnimatePresence } from 'motion/react';
import { useSwipeable } from 'react-swipeable';
import ToastNotification from '../../components/ToastNotification';
import RetroLoading from '../../components/player/RetroLoading';

const EvidenceReader = React.lazy(() => import('../../components/EvidenceReader'));
import NokiaSessionLayout from './NokiaSessionLayout';
import PlayerScreenRouter from './PlayerScreenRouter';
import { usePlayerSession } from '../context/PlayerProviders';
import { usePlayerPlayback } from '../context/PlayerProviders';
import {
  useDesktopPlayerShortcuts,
  useIsDesktopViewport,
} from '../hooks/useDesktopPlayerShortcuts';

export default function PlayerRootShell() {
  const session = usePlayerSession();
  const playback = usePlayerPlayback();
  const isDesktop = useIsDesktopViewport(1024);

  const { masterAccount, playerData, screen, setScreen, isNokiaTheme, showNokiaShell } = session;

  const closeEvidence = useCallback(() => {
    if (playback.activeEvidence) playback.setActiveEvidence(null);
  }, [playback.activeEvidence, playback.setActiveEvidence]);

  useDesktopPlayerShortcuts(
    screen,
    setScreen,
    isDesktop && Boolean(playerData),
    playback.activeEvidence ? closeEvidence : undefined,
    Boolean(playerData?.character?.campaignId),
  );

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      if (isDesktop) return;
      if (screen === 'player' && playback.playerDataRef.current) setScreen('profile');
    },
    onSwipedRight: () => {
      if (isDesktop) return;
      if (screen === 'profile' && playback.playerDataRef.current) setScreen('player');
    },
    trackMouse: !isDesktop,
    preventScrollOnSwipe: true,
  });

  if (masterAccount === null) {
    return (
      <RetroLoading fullScreen message="AUTENTICANDO..." subMessage="Validando credenciais de acesso" />
    );
  }

  return (
    <div
      onMouseDown={isDesktop ? undefined : swipeHandlers.onMouseDown}
      ref={isDesktop ? undefined : swipeHandlers.ref}
      className={`fixed inset-0 player-viewport bg-surface flex items-center justify-center p-0 pt-[env(safe-area-inset-top,0px)] pr-[env(safe-area-inset-right,0px)] pb-[env(safe-area-inset-bottom,0px)] pl-[env(safe-area-inset-left,0px)] sm:p-4 sm:pt-4 sm:pr-4 sm:pb-4 sm:pl-4 lg:p-6 lg:pt-6 lg:pr-6 lg:pb-6 lg:pl-6 overflow-hidden select-none${showNokiaShell ? ' overscroll-none' : ''}${isDesktop ? ' desktop-player-shell' : ''}`}
    >
      {!isNokiaTheme && (
        <>
          {/* Luz ambiente quente atrás do aparelho: assenta o Deck sobre a bancada */}
          <div
            aria-hidden
            className="fixed inset-0 pointer-events-none z-0 bg-radial-[at_50%_42%] from-accent-05 via-transparent to-transparent"
          />
          <div className="noise-overlay" />
          <div className="scanlines" />
          <div className="vignette" />
        </>
      )}

      {/* Fundo escuro contínuo ao sair do Nokia para mini-apps (menos quebra visual) */}
      {isNokiaTheme && !showNokiaShell && (
        <div className="absolute inset-0 bg-[#0a0f0c] z-0" aria-hidden />
      )}

      {showNokiaShell && playerData ? <NokiaSessionLayout /> : <PlayerScreenRouter />}

      <AnimatePresence>
        {playback.activeEvidence && (
          <React.Suspense fallback={null}>
            <EvidenceReader
              evidence={playback.activeEvidence}
              onClose={() => playback.setActiveEvidence(null)}
            />
          </React.Suspense>
        )}
      </AnimatePresence>

      <ToastNotification toasts={playback.toasts} onDismiss={playback.dismissToast} />
    </div>
  );
}
