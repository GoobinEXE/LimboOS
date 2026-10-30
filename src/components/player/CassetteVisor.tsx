import React from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'motion/react';
import { EXIT_FAST, SPRING_MECHANICAL } from '../../lib/motion';
import { Camera } from 'lucide-react';
const QrScanner = React.lazy(() => import('../QrScanner'));
import { IntelBase, AudioIntel } from '../../services/IntelEngine';
import type { WalkmanStatus } from '../../types/player';
import Screw from './Screw';
import RetroSpinner from './RetroSpinner';

export default React.memo(function CassetteVisor({
  currentIntel, 
  status,
  onEject, 
  onScanClick, 
  onCancelScan, 
  onQrDetected,
  compact,
  fluid,
}: {
  currentIntel: IntelBase | null; 
  status: WalkmanStatus;
  onEject: () => void; 
  onScanClick: () => void;
  onCancelScan: () => void; 
  onQrDetected: (code: string) => void;
  compact?: boolean;
  /** Landscape: preenche a coluna sem altura fixa em px */
  fluid?: boolean;
}) {
  const { t } = useTranslation('player');
  const isPlaying = status === 'PLAYING';
  const isRewinding = status === 'REWINDING';
  const isLoading = status === 'LOADING';
  const isScanning = status === 'SCANNING';
  const hasTape = !!currentIntel && (status === 'LOADED' || status === 'PLAYING' || status === 'REWINDING');

  const shellSize = fluid
    ? 'mt-0 w-full h-full min-h-0 max-h-full max-w-none'
    : compact
      ? 'mt-0 w-full max-w-70 h-[160px]'
      : 'mt-4 w-full max-w-[310px] h-[190px]';

  return (
    <div
      className={`mx-auto bg-surface-container rounded-xl border-4 border-surface-sunken shadow-[inset_0_4px_12px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.04)] flex flex-col items-center relative overflow-hidden ${
        fluid ? 'shrink min-h-0' : 'shrink-0'
      } ${shellSize}`}
    >
      {/* Vidro do visor: reflexo diagonal discreto */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none z-1 bg-linear-to-br from-white/5 via-transparent to-transparent"
      />

      {([['top-2 left-2',''],['top-2 right-2','-rotate-45'],['bottom-2 left-2','rotate-90'],['bottom-2 right-2','']] as const).map(([pos, rot], i) => (
        <Screw key={i} className={`absolute ${pos} w-2.5 h-2.5 rounded-full bg-surface-sunken shadow-[inset_0_1px_2px_rgba(0,0,0,0.7)]`} innerClassName={`w-1.5 h-px bg-surface-container-highest ${rot}`} />
      ))}

      <AnimatePresence mode="wait">
        {hasTape && currentIntel ? (
          // Fita entra descendo no compartimento e sai subindo na ejeção (mesmo eixo)
          <motion.div key="cassette"
            initial={{ y: -28, opacity: 0 }}
            animate={{ y: 0, opacity: 1, transition: SPRING_MECHANICAL }}
            exit={{ y: -18, opacity: 0, transition: EXIT_FAST }}
            onClick={onEject}
            role="button"
            tabIndex={0}
            aria-label={t('walkman.visor.eject')}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEject(); } }}
            className="w-full h-full flex flex-col items-center cursor-pointer group rounded-card">
      
            <div className={`mt-4 w-full max-w-70 bg-[#f4f1ea] rounded-md shadow-[0_2px_6px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.6)] relative flex flex-col p-3 border-t-12 border-accent transition-transform duration-300 ease-limbo group-hover:scale-[1.01] ${
              fluid ? 'h-[min(130px,55%)] min-h-24' : 'h-32.5'
            }`}>
              <div className="text-[8px] font-bold flex justify-center gap-4 text-ash-500 mb-2 border-b border-ash-300/50 pb-1">
                <span>{currentIntel.metadata?.chapter}</span>
                <span>{currentIntel instanceof AudioIntel ? currentIntel.metadata.artist : currentIntel.metadata?.npc}</span>
              </div>
              <div className="flex-1 flex flex-col text-center px-2">
                <div className="text-[13px] font-black uppercase tracking-tight text-ash-800 truncate leading-tight">{currentIntel.title}</div>
                <div className="text-[10px] font-bold text-ash-600 truncate mt-0.5">{currentIntel instanceof AudioIntel ? currentIntel.metadata.artist : currentIntel.metadata?.npc}</div>
              </div>
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-45 h-12.5 bg-surface-container rounded-t-lg border-t-2 border-l-2 border-r-2 border-surface-sunken" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity bg-black/80 text-bone text-[10px] font-bold tracking-widest px-3 py-1 rounded-inset">{t('walkman.visor.eject')}</div>
            </div>
      
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-42.5 h-11.5 bg-black/40 rounded-md flex items-center justify-between px-4 border border-border-subtle shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]">
              {[true, false].map((_, si) => (
                // Carretel em CSS: pausa onde parou (sem voltar a 0°) e roda fora da main thread
                <div key={si}
                  style={{
                    animation: 'spin 3s linear infinite',
                    animationDuration: isRewinding ? '0.3s' : '3s',
                    animationDirection: isRewinding ? 'reverse' : 'normal',
                    animationPlayState: isPlaying || isRewinding ? 'running' : 'paused',
                  }}
                  className="w-10 h-10 rounded-full bg-industrial-silver flex items-center justify-center relative shadow-md">
                  <div className="absolute inset-0 rounded-full border-[6px] border-surface-sunken opacity-90" />
                  <div className="w-4 h-4 rounded-full bg-surface-container flex items-center justify-center z-10">
                    <div className="w-full h-0.5 bg-industrial-silver absolute" /><div className="w-0.5 h-full bg-industrial-silver absolute" />
                    <div className="w-full h-0.5 bg-industrial-silver absolute rotate-45" /><div className="w-0.5 h-full bg-industrial-silver absolute rotate-45" />
                  </div>
                </div>
              ))}
              <div className="absolute bottom-1 left-8 right-8 h-0.75 bg-surface-sunken" />
            </div>
          </motion.div>
        ) : (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className={isScanning ? 'w-full h-full' : 'w-full h-full flex flex-col items-center justify-center p-4'}>
            {isScanning ? (
              <React.Suspense fallback={
                <div className="w-full h-full flex flex-col items-center justify-center p-4">
                  <RetroSpinner size="sm" className="mb-2" />
                  <p className="text-accent text-[9px] font-bold uppercase tracking-widest animate-led mt-2">{t('walkman.visor.startingScanner')}</p>
                </div>
              }>
                <QrScanner
                  onDetected={onQrDetected}
                  onCancel={onCancelScan}
                />
              </React.Suspense>
            ) : (
              <button type="button" onClick={!isLoading ? onScanClick : undefined} disabled={isLoading} aria-busy={isLoading}
                className={`w-full max-w-70 h-32.5 border-2 border-dashed rounded-card flex flex-col items-center justify-center gap-3 transition duration-200 ease-limbo active:scale-[0.98] ${isLoading ? 'border-border-accent cursor-default' : 'border-border-strong hover:bg-accent-05 hover:border-border-accent cursor-pointer group'}`}>
                {isLoading ? (
                  <div className="flex flex-col items-center gap-2">
                    <RetroSpinner size="sm" />
                    <p className="text-accent text-[9px] font-bold uppercase tracking-widest animate-led">{t('walkman.visor.loadingProof')}</p>
                  </div>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-full bg-surface-container-highest shadow-hairline flex items-center justify-center group-hover:bg-accent-10 transition-colors duration-200 ease-limbo">
                      <Camera className="text-ash-400 group-hover:text-accent transition-colors" size={24} />
                    </div>
                    <div className="text-center">
                      <p className="text-ash-300 text-[11px] font-bold uppercase tracking-widest">{t('walkman.visor.emptyBay')}</p>
                      <p className="text-accent text-[9px] font-bold uppercase tracking-tighter mt-1">{t('walkman.visor.scanHint')}</p>
                    </div>
                  </>
                )}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
