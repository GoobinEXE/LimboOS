import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import type { AchievementTier, PlayerPlatform } from '../services/AchievementManager';

export interface Toast {
  id: string;
  type: 'tape' | 'achievement' | 'error';
  title: string;
  subtitle?: string;
  icon?: string;
  tier?: AchievementTier;
  platform?: PlayerPlatform;
}

interface ToastNotificationProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

const ACHIEVEMENT_DURATION_MS = 5500;
const DEFAULT_DURATION_MS = 3500;

function isImageIcon(icon?: string): boolean {
  return !!icon && (icon.startsWith('/') || icon.startsWith('http') || icon.endsWith('.png') || icon.endsWith('.webp'));
}

function ToastIcon({ icon, className }: { icon?: string; className?: string }) {
  if (!icon) return null;
  if (isImageIcon(icon)) {
    return (
      <img
        src={icon}
        alt=""
        className={`object-cover rounded-md shrink-0 ${className || 'w-8 h-8'}`}
      />
    );
  }
  return <span className={`shrink-0 ${className || 'text-xl'}`}>{icon}</span>;
}

export default function ToastNotification({ toasts, onDismiss }: ToastNotificationProps) {
  return (
    <div className="fixed top-4 right-4 z-9999 flex flex-col gap-2 pointer-events-none items-end">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const { t } = useTranslation('common');
  const isAchievement = toast.type === 'achievement';
  const duration = isAchievement ? ACHIEVEMENT_DURATION_MS : DEFAULT_DURATION_MS;

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), duration);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss, duration]);

  if (isAchievement) {
    return <AchievementToast toast={toast} onDismiss={onDismiss} duration={duration} />;
  }

  const colors = {
    tape: 'border-accent-60',
    error: 'border-red-500/60',
  };
  const glows = {
    tape: 'shadow-[0_0_20px_rgba(255,140,0,0.3)]',
    error: 'shadow-[0_0_20px_rgba(239,68,68,0.3)]',
  };
  const textColors = {
    tape: 'text-accent',
    error: 'text-red-400',
  };
  const protocolLabels = {
    tape: t('toast.protocol.intel'),
    error: t('toast.protocol.error'),
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 60, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60, scale: 0.9 }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      role="status"
      className={`pointer-events-auto relative overflow-hidden flex items-center gap-3 px-4 py-3 border rounded-lg bg-surface-raised/95 backdrop-blur-md min-w-[200px] max-w-[260px] cursor-pointer ${colors[toast.type]} ${glows[toast.type]}`}
      onClick={() => onDismiss(toast.id)}
    >
      <ToastIcon icon={toast.icon} />
      <div className="min-w-0">
        <p className={`text-[8px] uppercase tracking-[0.25em] opacity-60 truncate ${textColors[toast.type]}`}>
          {protocolLabels[toast.type]}
        </p>
        <p className={`text-xs font-bold uppercase tracking-wider truncate mt-0.5 ${textColors[toast.type]}`}>
          {toast.title}
        </p>
        {toast.subtitle && (
          <p className="text-[10px] text-gray-400 truncate mt-0.5">{toast.subtitle}</p>
        )}
      </div>
      <motion.div
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0 }}
        transition={{ duration: duration / 1000, ease: 'linear' }}
        className={`absolute bottom-0 left-0 right-0 h-0.5 origin-left opacity-50 ${
          toast.type === 'tape' ? 'bg-accent' : 'bg-red-400'
        }`}
      />
    </motion.div>
  );
}

function AchievementToast({
  toast,
  onDismiss,
  duration,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
  duration: number;
}) {
  const { t } = useTranslation('common');
  const tier = toast.tier || 'common';
  const platform = toast.platform || 'global';
  const tierBorder =
    platform === 'nokia'
      ? 'border-emerald-400/60'
      : tier === 'legendary'
        ? 'border-amber-400/70'
        : tier === 'rare'
          ? 'border-yellow-500/55'
          : 'border-orange-500/45';
  const tierGlow =
    platform === 'nokia'
      ? 'shadow-[0_0_28px_rgba(52,211,153,0.35)]'
      : tier === 'legendary'
        ? 'shadow-[0_0_32px_rgba(251,191,36,0.45)]'
        : 'shadow-[0_0_22px_rgba(255,140,0,0.3)]';
  const tierLabel =
    tier === 'legendary'
      ? t('achievement.tier.legendaryUpper')
      : tier === 'rare'
        ? t('achievement.tier.rareUpper')
        : t('achievement.tier.commonUpper');
  const accentText = platform === 'nokia' ? 'text-emerald-300' : 'text-amber-300';
  const accentMuted = platform === 'nokia' ? 'text-emerald-400/80' : 'text-amber-400/80';

  return (
    <motion.div
      initial={{ opacity: 0, y: -16, scale: 0.86, rotate: -1.5 }}
      animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
      exit={{ opacity: 0, x: 40, scale: 0.92 }}
      transition={{ type: 'spring', damping: 16, stiffness: 260 }}
      role="status"
      className={`pointer-events-auto relative overflow-hidden flex gap-3.5 px-4 py-3.5 border-2 rounded-xl bg-surface-raised/97 backdrop-blur-md min-w-[260px] max-w-[300px] cursor-pointer ${tierBorder} ${tierGlow}`}
      onClick={() => onDismiss(toast.id)}
    >
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 ${
          platform === 'nokia'
            ? 'bg-[radial-gradient(ellipse_at_20%_0%,rgba(52,211,153,0.16),transparent_55%)]'
            : 'bg-[radial-gradient(ellipse_at_20%_0%,rgba(251,191,36,0.18),transparent_55%)]'
        }`}
      />
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 12, stiffness: 280, delay: 0.05 }}
        className="relative shrink-0"
      >
        <ToastIcon icon={toast.icon || '/achievements/ACH-VETERAN.png'} className="w-12 h-12 rounded-lg shadow-[0_0_12px_rgba(251,191,36,0.35)]" />
      </motion.div>
      <div className="relative min-w-0 flex-1">
        <p className={`text-[8px] uppercase tracking-[0.28em] font-bold ${accentMuted}`}>
          {t('toast.achievement.header')}
        </p>
        <p className={`text-sm font-black uppercase tracking-wide mt-1 leading-tight wrap-break-word ${accentText}`}>
          {toast.title}
        </p>
        {toast.subtitle && (
          <p className="text-[11px] text-industrial-silver/70 mt-1 leading-snug wrap-break-word font-sans">
            {toast.subtitle}
          </p>
        )}
        <p className={`text-[8px] uppercase tracking-[0.2em] mt-2 font-mono opacity-50 ${accentText}`}>
          {t('toast.achievement.class', { tier: tierLabel })}
        </p>
      </div>
      <motion.div
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0 }}
        transition={{ duration: duration / 1000, ease: 'linear' }}
        className={`absolute bottom-0 left-0 right-0 h-0.5 origin-left ${
          platform === 'nokia' ? 'bg-emerald-400/70' : 'bg-amber-400/70'
        }`}
      />
    </motion.div>
  );
}
