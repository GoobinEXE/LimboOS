import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Radio } from 'lucide-react';
import { motion } from 'motion/react';
import { dialogPop } from '../../lib/motion';
import { resolveSlotDisplayName } from '../../modules/oracle';
import type { PublicOracleSlotResponse } from '../../types/oracle';
import RetroSpinner from '../../components/player/RetroSpinner';

interface OracleWaitStepProps {
  slot: PublicOracleSlotResponse;
  refreshing: boolean;
  onRefresh: () => void;
  onSwitchCode: () => void;
}

export default function OracleWaitStep({
  slot,
  refreshing,
  onRefresh,
  onSwitchCode,
}: OracleWaitStepProps) {
  const { t } = useTranslation('common');
  const submitted = slot.submittedCount ?? 0;
  const total = Math.max(slot.totalSlots ?? 1, 1);
  const pct = Math.min(100, Math.round((submitted / total) * 100));

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') onRefresh();
    }, 8000);
    return () => window.clearInterval(id);
  }, [onRefresh]);

  const identity = resolveSlotDisplayName(
    slot.intakeData,
    slot.intakeFields,
    slot.slotLabel,
    slot.slotCode || '',
  );
  const hasIntakeDisplay = Boolean(slot.intakeData && Object.values(slot.intakeData).some((v) => v?.trim()));

  return (
    <motion.div
      variants={dialogPop}
      initial="hidden"
      animate="visible"
      className="w-full max-w-lg bg-surface-raised rounded-panel shadow-panel p-6 sm:p-8 space-y-6"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="lmb-led text-phosphor-400 animate-led" aria-hidden />
          <span className="font-mono text-xs text-ash-300">{slot.slotCode}</span>
        </div>
        <span className="text-[11px] font-mono text-ash-400 uppercase">{slot.rpgSystem}</span>
      </div>

      <div className="space-y-2">
        <h1 className="text-display text-2xl text-bone uppercase">
          {slot.copy?.waitPhaseTitle || t('oracle.wait.title')}
        </h1>
        <p className="text-sm text-ash-300 leading-relaxed">
          {t('oracle.wait.body')}
        </p>
      </div>

      <div className="bg-surface-sunken rounded-card p-4 space-y-3 shadow-pressed">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-2 text-ash-400">
            <Radio size={14} className="text-accent" />
            <span>{t('oracle.wait.progressLabel')}</span>
          </span>
          <span className="font-mono text-bone tabular-nums">
            {t('oracle.wait.progressCount', { submitted, total })}
          </span>
        </div>
        <div className="h-2 bg-surface-panel rounded-inset overflow-hidden">
          <div
            className="h-full bg-accent transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {hasIntakeDisplay && (
        <div className="bg-surface-panel/60 rounded-card p-4 space-y-1 text-xs">
          <span className="lmb-eyebrow block">{t('oracle.wait.registeredIdentity')}</span>
          <p className="text-bone font-medium">{identity.primary}</p>
          {identity.secondary && <p className="text-ash-400">{identity.secondary}</p>}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border-subtle">
        <button
          type="button"
          onClick={onSwitchCode}
          className="lmb-btn h-10 px-4 text-xs uppercase tracking-wider"
        >
          {t('oracle.dossier.otherCode')}
        </button>

        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="lmb-btn lmb-btn-primary h-10 px-5 text-xs uppercase tracking-wider"
        >
          {refreshing ? <RetroSpinner size="sm" /> : <RefreshCw size={14} />}
          <span>{t('oracle.wait.checkNow')}</span>
        </button>
      </div>
    </motion.div>
  );
}
