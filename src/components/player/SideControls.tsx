import React, { useEffect, useRef } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'motion/react';
import { User } from 'lucide-react';
import { analyticsTracker } from '../../services/AnalyticsTracker';
import { activityLogger } from '../../services/ActivityLogger';
export default React.memo(function SideControls({ volume, setVolume, onModeChange, onProfileOpen, onCharacterSwitch, landscape }: {
  volume: number; setVolume: (v: number) => void;
  onModeChange: (dir: 'up' | 'down') => void; onProfileOpen: () => void;
  onCharacterSwitch?: () => void;
  landscape?: boolean;
}) {
  const dragY = useMotionValue(0);
  const firedRef = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const upArrowColor = useTransform(dragY, (v: number) => v < -5 ? '#FF8C00' : '#6b6b6b');
  const downArrowColor = useTransform(dragY, (v: number) => v > 5 ? '#FF8C00' : '#6b6b6b');
  
  const lastLoggedVolume = useRef(volume);
  const volumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };
  }, []);

  useEffect(() => {
    if (volume === lastLoggedVolume.current) return;
    if (volumeTimer.current) clearTimeout(volumeTimer.current);
    volumeTimer.current = setTimeout(() => {
      activityLogger.logAction('player', `Volume ajustado para ${volume}%`, { volume });
      lastLoggedVolume.current = volume;
    }, 1500);
    return () => { if (volumeTimer.current) clearTimeout(volumeTimer.current); };
  }, [volume]);

  const handleProfilePointerDown = (e: React.PointerEvent) => {
    longPressTimer.current = setTimeout(() => {
      if (onCharacterSwitch) {
        if (typeof window !== 'undefined' && window.navigator?.vibrate) {
          try { window.navigator.vibrate([50, 30, 50]); } catch(e) {}
        }
        activityLogger.logAction('player', 'Troca rápida de agente acionada via long-press');
        onCharacterSwitch();
      }
      longPressTimer.current = null;
    }, 1000);
  };

  const handleProfilePointerUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
      onProfileOpen();
    }
  };

  return (
    <div
      className={
        landscape
          ? 'relative shrink-0 w-14 flex flex-col items-center justify-between gap-2 py-1 touch-none min-h-0'
          : 'absolute right-2 top-60 bottom-20 flex flex-col items-center justify-center gap-6 w-16 touch-none'
      }
    >
      <button 
        onPointerDown={handleProfilePointerDown}
        onPointerUp={handleProfilePointerUp}
        onPointerLeave={() => {
          if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
          }
        }}
        className={`${landscape ? 'w-9 h-9 min-h-9' : 'w-10 h-10'} rounded-full bg-radial-[at_35%_30%] from-surface-bright to-surface-container-highest border-2 border-surface-sunken shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_4px_10px_-3px_rgba(0,0,0,0.9)] flex items-center justify-center hover:from-accent-20 hover:to-surface-container-highest transition-all duration-150 ease-limbo shrink-0 active:scale-90 active:shadow-[inset_0_2px_5px_rgba(0,0,0,0.7)]`}
        title="Clique para perfil, segure para trocar agente"
      >
        <User size={landscape ? 14 : 16} className="text-accent" />
      </button>
      <div className={`relative ${landscape ? 'w-12 h-12' : 'w-14 h-14'} shrink-0 flex items-center justify-center z-20`}>
        <motion.div style={{ color: upArrowColor }} className="absolute -top-4 pointer-events-none transition-colors">
          <div className="w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-b-[6px] border-b-current" />
        </motion.div>
        <motion.div style={{ color: downArrowColor }} className="absolute -bottom-4 pointer-events-none transition-colors">
          <div className="w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-t-[6px] border-t-current" />
        </motion.div>
        <motion.div
          style={{ y: dragY, touchAction: 'none' }}
          className={`relative ${landscape ? 'w-12 h-12 border-[3px]' : 'w-14 h-14 border-4'} rounded-full bg-radial-[at_35%_25%] from-surface-bright to-surface-container-highest border-surface-sunken shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_6px_14px_-4px_rgba(0,0,0,0.9)] flex items-center justify-center group cursor-ns-resize`}
          onPointerDown={(e) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            const el = e.currentTarget;
            let startY = e.clientY;
            firedRef.current = false;
            const onMove = (me: PointerEvent) => {
              me.preventDefault();
              if (firedRef.current) return; 
              const delta = Math.max(-20, Math.min(20, me.clientY - startY));
              if (delta <= -18) {
                onModeChange('up');
                activityLogger.logAction('player', 'Alterado modo de exibição (Cima)');
                analyticsTracker.incrementStat('fidgetClicks');
                firedRef.current = true;
                animate(dragY, 0, { type: 'spring', stiffness: 400, damping: 25 });
              } else if (delta >= 18) {
                onModeChange('down');
                activityLogger.logAction('player', 'Alterado modo de exibição (Baixo)');
                analyticsTracker.incrementStat('fidgetClicks');
                firedRef.current = true;
                animate(dragY, 0, { type: 'spring', stiffness: 400, damping: 25 });
              } else {
                dragY.set(delta);
              }
            };
            const onUp = () => {
              animate(dragY, 0, { type: 'spring', stiffness: 400, damping: 25 });
              firedRef.current = false;
              el.removeEventListener('pointermove', onMove);
              el.removeEventListener('pointerup', onUp);
            };
            el.addEventListener('pointermove', onMove);
            el.addEventListener('pointerup', onUp);
          }}>
          <div className="absolute inset-0 rounded-full border border-border pointer-events-none" />
          <div className={`${landscape ? 'w-8 h-8' : 'w-10 h-10'} rounded-full bg-surface-bright border-2 border-surface-container flex items-center justify-center shadow-inner pointer-events-none`}>
            <div className={`${landscape ? 'w-4 h-4' : 'w-5 h-5'} rounded-full bg-accent border-2 border-surface-sunken glow-orange-subtle`} />
          </div>
        </motion.div>
      </div>
      <div
        className={`w-7 flex-1 ${landscape ? 'min-h-18 max-h-none' : 'max-h-40'} bg-surface-sunken rounded-full border-2 border-surface-container-highest shadow-[inset_0_2px_6px_rgba(0,0,0,0.7)] relative flex flex-col items-center py-1.5 shrink min-h-0`}
        style={{ touchAction: 'none' }}
      >
        <span className="text-[10px] text-industrial-silver/50 font-bold mb-1">+</span>
        <div className="flex-1 w-1 bg-surface-container rounded-full relative overflow-visible cursor-pointer"
          onClick={(e) => {
            analyticsTracker.incrementStat('fidgetClicks');
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = Math.round(((rect.bottom - e.clientY) / rect.height) * 100);
            setVolume(Math.max(0, Math.min(100, pct)));
          }}>
          <div className="absolute bottom-0 w-full bg-accent rounded-full transition-[height] duration-75" style={{ height: `${volume}%` }} />
          <div className="absolute left-1/2 -translate-x-1/2 w-6 h-8 bg-linear-to-b from-stone-200 to-stone-400 rounded border-2 border-stone-600 shadow-[0_3px_8px_-2px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.5)] cursor-ns-resize flex flex-col justify-center items-center gap-0.5 z-10"
            style={{ bottom: `calc(${volume}% - 16px)`, touchAction: 'none' }}
            onPointerDown={(e) => {
              (e.target as Element).setPointerCapture(e.pointerId);
              const startY = e.clientY, startVol = volume;
              const onMove = (me: PointerEvent) => {
                analyticsTracker.incrementStat('fidgetClicks');
                setVolume(Math.max(0, Math.min(100, Math.round(startVol + ((startY - me.clientY) / 80) * 100))));
              }
              const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
              window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);
            }}>
            {[0,1,2].map(i => <div key={i} className="w-3 h-0.5 bg-stone-500 rounded-full" />)}
          </div>
        </div>
        <span className="text-[10px] text-industrial-silver/50 font-bold mt-1">-</span>
      </div>
    </div>
  );
});
