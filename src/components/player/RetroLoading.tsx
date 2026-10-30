import React from 'react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import RetroSpinner from './RetroSpinner';
import { EASE_OUT } from '../../lib/motion';

interface RetroLoadingProps {
  message?: string;
  subMessage?: string;
  fullScreen?: boolean;
}

export default function RetroLoading({
  message,
  subMessage,
  fullScreen = false
}: RetroLoadingProps) {
  const { t } = useTranslation('common');
  const resolvedMessage = message ?? t('loading');
  const resolvedSubMessage = subMessage ?? t('loadingSub');

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center relative ${fullScreen ? 'fixed inset-0 z-100 bg-surface-sunken' : 'w-full h-full p-8'}`}
    >
      <div className="noise-overlay" />
      <div className="scanlines" />
      {fullScreen && <div className="vignette" />}

      <motion.div
        // Atraso curto: cargas rápidas não piscam o carregador na tela
        initial={{ opacity: 0, transform: 'translateY(6px)' }}
        animate={{ opacity: 1, transform: 'translateY(0px)' }}
        transition={{ duration: 0.28, ease: EASE_OUT, delay: 0.12 }}
        className="relative z-10 flex flex-col items-center"
      >
        <RetroSpinner size="lg" />

        <div className="mt-6 flex flex-col items-center gap-2">
          <div className="text-protocol text-accent text-shadow-orange text-center animate-flicker">
            {resolvedMessage}
          </div>

          {resolvedSubMessage && (
            <div className="text-mono-ui text-ash-500 text-center">
              {resolvedSubMessage}
            </div>
          )}
        </div>

        <div className="mt-6 w-32 h-px bg-border-strong overflow-hidden relative rounded-inset">
          <motion.div
            animate={{ x: ['-100%', '100%'] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-y-0 w-1/3 bg-accent"
          />
        </div>
      </motion.div>
    </div>
  );
}
