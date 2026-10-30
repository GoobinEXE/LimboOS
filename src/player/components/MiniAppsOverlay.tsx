import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import RetroLoading from '../../components/player/RetroLoading';
import { analyticsTracker } from '../../services/AnalyticsTracker';

const BiosTerminal = React.lazy(() => import('../../components/BiosTerminal'));
const LimboBoard = React.lazy(() => import('../../components/LimboBoard'));
const DiskRepairApp = React.lazy(() => import('../../components/DiskRepairApp'));
const MacOsApp = React.lazy(() => import('../../components/MacOsApp'));
const Windows95App = React.lazy(() => import('../../components/Windows95App'));
import type { AppScreen, LimboGlobalState, PlayerData } from '../../types/player';

interface MiniAppsOverlayProps {
  screen: AppScreen;
  playerData: PlayerData;
  limboStatus: LimboGlobalState;
  setScreen: (screen: AppScreen) => void;
}

const LIMBO_EASE = [0.22, 1, 0.36, 1] as const;

export default function MiniAppsOverlay({ screen, playerData, limboStatus, setScreen }: MiniAppsOverlayProps) {
  const { t } = useTranslation('player');

  useEffect(() => {
    if (screen === 'bios') analyticsTracker.markFlag('biosOpened');
    else if (screen === 'windows95') analyticsTracker.markFlag('win95Opened');
    else if (screen === 'macos') analyticsTracker.markFlag('macosOpened');
  }, [screen]);

  return (
    <motion.div
      key="apps"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28, ease: LIMBO_EASE }}
      className="absolute inset-0 z-50 bg-surface-sunken"
    >
      {/* Portal chrome LimboOS — framing only; skins internas intactas */}
      <div className="pointer-events-none absolute inset-0 z-20" aria-hidden>
        <div className="absolute inset-0 vignette opacity-80" />
        <div className="absolute top-0 inset-x-0 h-px bg-linear-to-r from-transparent via-accent-40 to-transparent" />
        <div className="absolute bottom-0 inset-x-0 h-px bg-linear-to-r from-transparent via-border-strong to-transparent" />
        <div
          className="absolute text-protocol text-[8px] text-accent/50 tracking-[0.35em]"
          style={{
            top: 'max(0.75rem, env(safe-area-inset-top, 0px))',
            left: 'max(0.75rem, env(safe-area-inset-left, 0px))',
          }}
        >
          LIMBOOS // PORTAL
        </div>
        <div
          className="absolute text-mono-ui text-[8px] text-industrial-silver/35 uppercase tracking-widest"
          style={{
            top: 'max(0.75rem, env(safe-area-inset-top, 0px))',
            right: 'max(0.75rem, env(safe-area-inset-right, 0px))',
          }}
        >
          {screen}
        </div>
      </div>

      <React.Suspense
        fallback={
          <RetroLoading
            fullScreen
            message={t('app.loading.initSystem')}
            subMessage={t('app.loading.initSystemSub')}
          />
        }
      >
        {screen === 'bios' && (
          <BiosTerminal
            uid={playerData.uid}
            characterId={playerData.activeCharacterId}
            characterName={playerData.character.codinome}
            onIpDetected={() => setScreen('limbo')}
            onClose={() => setScreen('player')}
            onAppLaunch={(app) => app === 'diskRepair' && setScreen('diskRepair')}
            onBootSystem={() => setScreen('windows95')}
          />
        )}
        {screen === 'limbo' && (
          <LimboBoard
            uid={playerData.uid}
            characterId={playerData.activeCharacterId}
            onClose={() => setScreen('player')}
            onBackToTerminal={() => setScreen('bios')}
            globalSeizedStatus={limboStatus.seized}
            readThreadIds={playerData.character.readThreadIds || []}
          />
        )}
        {screen === 'diskRepair' && (
          <DiskRepairApp
            uid={playerData.uid}
            characterId={playerData.activeCharacterId}
            onClose={() => setScreen('player')}
            onBackToTerminal={() => setScreen('bios')}
          />
        )}
        {screen === 'macos' && (
          <MacOsApp
            uid={playerData.uid}
            characterId={playerData.activeCharacterId}
            onClose={() => setScreen('player')}
          />
        )}
        {screen === 'windows95' && (
          <Windows95App
            uid={playerData.uid}
            characterId={playerData.activeCharacterId}
            onClose={() => setScreen('player')}
          />
        )}
      </React.Suspense>
    </motion.div>
  );
}
