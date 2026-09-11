import React, { memo, Suspense } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import CassetteVisor from '../../components/player/CassetteVisor';
import TapeLibrary from '../../components/player/TapeLibrary';
import SideControls from '../../components/player/SideControls';
import BottomControls from '../../components/player/BottomControls';
import Screw from '../../components/player/Screw';
import RetroSpinner from '../../components/player/RetroSpinner';
import { useLandscapeLayout } from '../hooks/useLandscapeLayout';
import type { IntelBase } from '../../services/IntelEngine';
import type { PlayerData, WalkmanStatus, DisplayMode } from '../../types/player';

const QrScanner = React.lazy(() => import('../../components/QrScanner'));

const EMPTY_INTEL: IntelBase[] = [];
const LIMBO_EASE = [0.22, 1, 0.36, 1] as const;

interface WalkmanShellProps {
  currentIntel: IntelBase | null;
  walkmanStatus: WalkmanStatus;
  isPlaying: boolean;
  displayMode: DisplayMode;
  volume: number;
  setVolume: (v: number) => void;
  intelItems: IntelBase[];
  playerData: PlayerData;
  onEject: () => void;
  onScanClick: () => void;
  onCancelScan: () => void;
  onQrDetected: (code: string) => void;
  onIntelSelect: (intel: IntelBase) => void;
  onModeChange: (dir: 'up' | 'down') => void;
  onProfileOpen: () => void;
  onCharacterSwitch: () => void;
  onSetIsPlaying: (playing: boolean) => void;
  onRewind: () => void;
  onTerminalOpen: () => void;
  onMacOpen: () => void;
}

function WalkmanShell({
  currentIntel,
  walkmanStatus,
  isPlaying,
  displayMode,
  volume,
  setVolume,
  intelItems,
  playerData,
  onEject,
  onScanClick,
  onCancelScan,
  onQrDetected,
  onIntelSelect,
  onModeChange,
  onProfileOpen,
  onCharacterSwitch,
  onSetIsPlaying,
  onRewind,
  onTerminalOpen,
  onMacOpen,
}: WalkmanShellProps) {
  const { isLandscape } = useLandscapeLayout();
  const isScanning = walkmanStatus === 'SCANNING';
  const landscapeScan = isLandscape && isScanning;

  return (
    <motion.div
      key="player"
      initial={{ opacity: 0, scale: 0.96, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, y: -6 }}
      transition={{ duration: 0.32, ease: LIMBO_EASE }}
      layout
      className={`relative w-full h-full bg-linear-to-b from-surface-container-highest via-surface-container-high to-surface-container shadow-panel flex overflow-hidden z-10 ${
        isLandscape
          ? 'max-w-none max-h-none flex-row rounded-2xl border-4 border-surface-sunken p-1.5 gap-1.5'
          : 'max-w-sm max-h-187.5 lg:max-w-md xl:max-w-lg lg:max-h-205 flex-col rounded-4xl border-8 border-surface-sunken p-3 sm:p-4'
      }`}
    >
      <div
        aria-hidden
        className={`absolute inset-0 shadow-hairline ring-1 ring-inset ring-border-subtle pointer-events-none -z-10 ${
          isLandscape ? 'rounded-xl' : 'rounded-[24px]'
        }`}
      />
      <div
        aria-hidden
        className={`absolute inset-0 bg-radial-[at_30%_0%] from-white/5 via-transparent to-transparent pointer-events-none -z-10 ${
          isLandscape ? 'rounded-xl' : 'rounded-[24px]'
        }`}
      />

      {!landscapeScan && (
        <>
          <Screw className={isLandscape ? 'top-2 left-2 scale-75' : 'top-4 left-4'} />
          <Screw className={isLandscape ? 'top-2 right-2 -rotate-90 scale-75' : 'top-4 right-4 -rotate-90'} />
          <Screw className={isLandscape ? 'bottom-2 left-2 -rotate-90 scale-75' : 'bottom-4 left-4 -rotate-90'} />
          <Screw className={isLandscape ? 'bottom-2 right-2 scale-75' : 'bottom-4 right-4'} />
        </>
      )}

      <AnimatePresence mode="wait">
        {landscapeScan ? (
          <motion.div
            key="landscape-scan"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.28, ease: LIMBO_EASE }}
            className="absolute inset-0 z-40 flex flex-col bg-surface-sunken rounded-xl overflow-hidden"
          >
            <div className="absolute top-2 left-3 z-50 pointer-events-none">
              <span className="text-[9px] font-black uppercase tracking-[0.25em] text-accent/80">
                Scanner // Full-bleed
              </span>
            </div>
            <Suspense
              fallback={
                <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                  <RetroSpinner size="sm" />
                  <p className="text-accent text-[9px] font-bold uppercase tracking-widest animate-pulse">
                    Iniciando scanner...
                  </p>
                </div>
              }
            >
              <QrScanner onDetected={onQrDetected} onCancel={onCancelScan} />
            </Suspense>
          </motion.div>
        ) : isLandscape ? (
          <motion.div
            key="landscape-playback"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28, ease: LIMBO_EASE }}
            className="flex flex-row flex-1 min-h-0 min-w-0 gap-1.5"
          >
            <div className="flex flex-col items-stretch justify-center shrink-0 w-[32%] min-w-40 max-w-70 min-h-0">
              <CassetteVisor
                currentIntel={currentIntel}
                status={walkmanStatus}
                onEject={onEject}
                onScanClick={onScanClick}
                onCancelScan={onCancelScan}
                onQrDetected={onQrDetected}
                compact
                fluid
              />
            </div>
            <div className="flex-1 flex flex-col min-h-0 min-w-0 gap-1">
              <TapeLibrary
                intelItems={intelItems.length ? intelItems : EMPTY_INTEL}
                currentIntelId={currentIntel?.id ?? null}
                isPlaying={isPlaying}
                displayMode={displayMode}
                onIntelSelect={onIntelSelect}
                landscape
              />
              <BottomControls
                status={walkmanStatus}
                setIsPlaying={onSetIsPlaying}
                hasTape={!!currentIntel}
                onRewind={onRewind}
                hasTerminalAccess={playerData.hasTerminalAccess}
                onTerminalOpen={onTerminalOpen}
                hasMacAccess={playerData.hasMacAccess}
                onMacOpen={onMacOpen}
                compact
              />
            </div>
            <SideControls
              volume={volume}
              setVolume={setVolume}
              onModeChange={onModeChange}
              onProfileOpen={onProfileOpen}
              onCharacterSwitch={onCharacterSwitch}
              landscape
            />
          </motion.div>
        ) : (
          <motion.div
            key="portrait"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28, ease: LIMBO_EASE }}
            className="flex flex-col flex-1 min-h-0 min-w-0 relative"
          >
            <CassetteVisor
              currentIntel={currentIntel}
              status={walkmanStatus}
              onEject={onEject}
              onScanClick={onScanClick}
              onCancelScan={onCancelScan}
              onQrDetected={onQrDetected}
            />
            <TapeLibrary
              intelItems={intelItems.length ? intelItems : EMPTY_INTEL}
              currentIntelId={currentIntel?.id ?? null}
              isPlaying={isPlaying}
              displayMode={displayMode}
              onIntelSelect={onIntelSelect}
            />
            <SideControls
              volume={volume}
              setVolume={setVolume}
              onModeChange={onModeChange}
              onProfileOpen={onProfileOpen}
              onCharacterSwitch={onCharacterSwitch}
            />
            <BottomControls
              status={walkmanStatus}
              setIsPlaying={onSetIsPlaying}
              hasTape={!!currentIntel}
              onRewind={onRewind}
              hasTerminalAccess={playerData.hasTerminalAccess}
              onTerminalOpen={onTerminalOpen}
              hasMacAccess={playerData.hasMacAccess}
              onMacOpen={onMacOpen}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default memo(WalkmanShell);
