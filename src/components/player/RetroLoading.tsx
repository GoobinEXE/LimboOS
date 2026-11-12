import React from 'react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { EASE_OUT } from '../../lib/motion';

interface RetroLoadingProps {
  message?: string;
  /** Cobre a viewport inteira. Sem ele, cobre o contêiner posicionado mais próximo (tela ou aparelho). */
  fullScreen?: boolean;
}

/** Carretel de fita girando: dois aros, cubo âmbar e três raios. */
function Reel() {
  return (
    <div className="relative w-14 h-14" aria-hidden>
      <div className="absolute inset-0 rounded-full bg-surface-container shadow-[inset_0_2px_6px_rgba(0,0,0,0.6),0_1px_0_rgba(255,245,230,0.05)]" />
      <div className="absolute inset-1.5 rounded-full animate-[spin_1.1s_linear_infinite] motion-reduce:animate-none">
        {[0, 120, 240].map((deg) => (
          <span
            key={deg}
            className="absolute left-1/2 top-1/2 h-0.75 w-5 -translate-y-1/2 origin-left rounded-full bg-ash-600"
            style={{ transform: `rotate(${deg}deg)` }}
          />
        ))}
        <span className="absolute left-1/2 top-0 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-accent" />
      </div>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-accent shadow-[0_0_10px_-2px_rgba(255,140,0,0.6)]" />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-surface-sunken" />
    </div>
  );
}

export default function RetroLoading({ message, fullScreen = false }: RetroLoadingProps) {
  const { t } = useTranslation('common');
  const resolvedMessage = message ?? t('loading');

  return (
    <div
      role="status"
      aria-live="polite"
      className={`${fullScreen ? 'fixed z-100' : 'absolute z-40'} inset-0 flex items-center justify-center bg-surface overflow-hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]`}
    >
      <div className="noise-overlay" />

      <motion.div
        // Atraso curto: cargas rápidas não piscam o carregador na tela
        initial={{ opacity: 0, transform: 'translateY(6px)' }}
        animate={{ opacity: 1, transform: 'translateY(0px)' }}
        transition={{ duration: 0.28, ease: EASE_OUT, delay: 0.12 }}
        className="relative z-10 flex flex-col items-center gap-5 px-6"
      >
        <Reel />
        <p className="text-protocol text-ash-300 text-center tracking-[0.18em] max-w-[28ch]">
          {resolvedMessage}
        </p>
        <div className="relative w-36 h-0.5 rounded-full bg-surface-container-high overflow-hidden" aria-hidden>
          <span className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-accent animate-loading-bar motion-reduce:animate-none" />
        </div>
      </motion.div>
    </div>
  );
}
