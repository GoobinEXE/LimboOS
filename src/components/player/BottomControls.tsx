import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Pause, RotateCcw, Menu, Monitor } from 'lucide-react';
import AppleIcon from '../icons/AppleIcon';
import { motion, AnimatePresence } from 'motion/react';
import { analyticsTracker } from '../../services/AnalyticsTracker';
import { activityLogger } from '../../services/ActivityLogger';
import type { WalkmanStatus } from '../../types/player';

// Tecla física: filete claro no topo, sombra projetada; pressionada afunda (translate + inset)
const KEYCAP =
  'bg-radial-[at_50%_15%] from-surface-bright to-surface-container-highest border-2 border-surface-sunken ' +
  'shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_6px_14px_-5px_rgba(0,0,0,0.95)] ' +
  'flex items-center justify-center transition duration-150 ease-limbo';
const KEYCAP_ACTIVE =
  'active:translate-y-px active:scale-[0.97] active:from-surface-container-highest active:to-surface-container-high active:shadow-[inset_0_2px_6px_rgba(0,0,0,0.75)]';
const KEYCAP_DISABLED = 'opacity-40 cursor-not-allowed';

export default React.memo(function BottomControls({ 
  status,
  setIsPlaying, 
  hasTape,
  onRewind,
  hasTerminalAccess,
  onTerminalOpen,
  hasMacAccess,
  onMacOpen,
  compact,
}: { 
  status: WalkmanStatus;
  setIsPlaying: (v: boolean) => void; 
  hasTape: boolean;
  onRewind?: () => void;
  hasTerminalAccess?: boolean;
  onTerminalOpen?: () => void;
  hasMacAccess?: boolean;
  onMacOpen?: () => void;
  compact?: boolean;
}) {
  const { t } = useTranslation('player');
  const [showMenu, setShowMenu] = useState(false);
  
  const isPlaying = status === 'PLAYING';
  const isRewinding = status === 'REWINDING';
  const terminalAccess = !!hasTerminalAccess;
  const macAccess = !!hasMacAccess;
  const appCount = (terminalAccess ? 1 : 0) + (macAccess ? 1 : 0);

  const handleAppClick = () => {
    analyticsTracker.incrementStat('fidgetClicks');
    if (appCount > 1) {
      if (!showMenu) activityLogger.logAction('menu', 'Aberto seletor de sistemas');
      setShowMenu(!showMenu);
    } else if (terminalAccess && onTerminalOpen) {
      onTerminalOpen();
    } else if (macAccess && onMacOpen) {
      onMacOpen();
    }
  };

  const sideBtn = compact ? 'w-12 h-9 min-h-9' : 'w-16 h-10';
  const playBtn = compact ? 'w-16 h-10 min-h-10 rounded-lg' : 'w-20 h-12 rounded-xl';
  const iconSide = compact ? 16 : 18;
  const iconPlay = compact ? 18 : 22;

  return (
    <div
      className={`${compact ? 'mt-0 py-0.5' : 'mt-4'} flex justify-between items-center px-1.5 shrink-0 relative`}
      style={{ touchAction: 'manipulation' }}
    >
      <AnimatePresence>
        {showMenu && appCount > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className={`absolute ${compact ? 'bottom-11' : 'bottom-14'} right-1 w-40 bg-surface-panel border border-border-strong shadow-panel rounded-card overflow-hidden z-50 py-1`}
          >
            <div className="px-3 py-1.5 border-b border-border mb-1">
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-ash-500">{t('walkman.systems')}</span>
            </div>
            {terminalAccess && (
              <button 
                onClick={() => { onTerminalOpen?.(); setShowMenu(false); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-surface-container-high active:bg-surface-container-highest transition-colors duration-150 text-[10px] font-black tracking-widest text-crt"
              >
                <Monitor size={14} /> {t('walkman.mhDos')}
              </button>
            )}
            {macAccess && (
              <button 
                onClick={() => { onMacOpen?.(); setShowMenu(false); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-surface-container-high active:bg-surface-container-highest transition-colors duration-150 text-[10px] font-black tracking-widest text-ash-300"
              >
                <div className="w-3.5 flex justify-center"><AppleIcon size={14} /></div> {t('walkman.macos')}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <button 
        onClick={() => { 
          analyticsTracker.incrementStat('fidgetClicks');
          if (hasTape && onRewind && !isRewinding) {
            activityLogger.logAction('player', 'Retroceder fita');
            onRewind();
          }
        }}
        aria-label={t('walkman.rewind')}
        aria-disabled={!hasTape || isRewinding}
        className={`${sideBtn} rounded-full ${KEYCAP} ${(hasTape && !isRewinding) ? KEYCAP_ACTIVE : KEYCAP_DISABLED}`}
      >
        <RotateCcw size={iconSide} className={`text-accent ${isRewinding ? 'animate-spin' : ''}`} />
      </button>

      <button onClick={() => {
        analyticsTracker.incrementStat('fidgetClicks');
        if (hasTape) {
          const nextPlaying = !isPlaying;
          activityLogger.logAction('player', nextPlaying ? 'Iniciado Play' : 'Pausado');
          setIsPlaying(nextPlaying);
        }
      }}
        aria-label={isPlaying ? t('walkman.pause') : t('walkman.play')}
        aria-disabled={!hasTape}
        className={`${playBtn} gap-1 ${KEYCAP} ${hasTape ? KEYCAP_ACTIVE : KEYCAP_DISABLED}`}>
        {isPlaying
          ? <Pause size={iconPlay} className="text-accent fill-accent" />
          : <Play size={iconPlay} className="text-accent fill-accent" />}
      </button>

      <button 
        onClick={handleAppClick} 
        aria-label={appCount > 1 ? t('walkman.systems') : terminalAccess ? t('walkman.mhDos') : macAccess ? t('walkman.macos') : t('walkman.eq')}
        aria-disabled={appCount === 0}
        aria-expanded={appCount > 1 ? showMenu : undefined}
        className={`${sideBtn} rounded-full ${KEYCAP} ${appCount > 0 ? KEYCAP_ACTIVE : KEYCAP_DISABLED}`}
      >
        <span className="flex items-center justify-center pointer-events-none">
          {appCount > 1 ? (
            <Menu size={iconSide} className={`${showMenu ? 'text-on-background' : 'text-accent'} transition-colors`} />
          ) : terminalAccess ? (
            <span className="text-crt text-[10px] font-black tracking-tighter drop-shadow-[0_0_5px_rgba(51,255,51,0.5)]">{t('walkman.mhDosShort')}</span>
          ) : macAccess ? (
            <span className="text-ash-300">
              <AppleIcon size={iconSide} />
            </span>
          ) : (
            <span className="text-accent text-xs font-bold">{t('walkman.eq')}</span>
          )}
        </span>
      </button>
    </div>
  );
});
