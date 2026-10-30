import React, { useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { INDICATOR_SPRING } from './constants';

interface TapeProgressProps {
  total: number;
  current: number;
  onChange?: (index: number) => void;
}

const pad = (n: number) => String(n).padStart(2, '0');

export const TapeProgress = ({ total, current, onChange }: TapeProgressProps) => {
  const { t } = useTranslation('player');
  const barRef = useRef<HTMLDivElement>(null);

  const resolveIndex = useCallback((clientX: number) => {
    if (!onChange || !barRef.current) return;
    const { left, width } = barRef.current.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (clientX - left) / width));
    const nextIndex = Math.round(percentage * (total - 1));
    onChange(Math.max(0, Math.min(total - 1, nextIndex)));
  }, [onChange, total]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    resolveIndex(e.clientX);

    const onMove = (ev: PointerEvent) => resolveIndex(ev.clientX);
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [resolveIndex]);

  const denominator = Math.max(1, total - 1);

  return (
    <div className="flex flex-col items-center w-full max-w-55 cursor-pointer group">
      <div
        ref={barRef}
        className="relative w-full py-4 -my-4 touch-none"
        onPointerDown={handlePointerDown}
        role="slider"
        aria-label={t('campaign.progressAria')}
        aria-valuemin={0}
        aria-valuemax={total - 1}
        aria-valuenow={current}
      >
        <div className="relative w-full h-2 rounded-full bg-surface-sunken border border-border overflow-hidden shadow-hairline transition-colors group-hover:border-border-strong">
          {total > 1 && (
            <div aria-hidden className="absolute inset-y-0 left-3 right-3 pointer-events-none">
              {Array.from({ length: total }).map((_, i) => (
                <span
                  key={i}
                  className="absolute top-0 bottom-0 w-px bg-border-strong"
                  style={{ left: `${(i / denominator) * 100}%` }}
                />
              ))}
            </div>
          )}

          <motion.div
            className="absolute top-0 bottom-0 w-6 rounded-full bg-primary glow-orange"
            initial={false}
            animate={{ left: `${(current / denominator) * 100}%`, x: `${-(current / denominator) * 100}%` }}
            transition={INDICATOR_SPRING}
          />
        </div>
      </div>

      <div className="mt-3 flex items-baseline gap-2 text-mono-ui text-[10px] text-ash-600 group-hover:text-ash-400 transition-colors">
        <span className="text-primary/80">{pad(Math.min(current + 1, Math.max(total, 1)))}</span>
        <span className="opacity-50">/</span>
        <span>{pad(total)}</span>
        <span className="text-protocol text-[8px] ml-2 opacity-70">{t('campaign.progressRecords')}</span>
      </div>
    </div>
  );
};
