import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound, ArrowRight, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';
import { dialogPop } from '../../lib/motion';
import { normalizeOracleCode } from '../../services/OracleService';
import RetroSpinner from '../../components/player/RetroSpinner';

interface SlotAccessStepProps {
  initialCode?: string;
  loading: boolean;
  error: string | null;
  onSubmitCode: (code: string) => void;
}

export default function SlotAccessStep({
  initialCode = '',
  loading,
  error,
  onSubmitCode,
}: SlotAccessStepProps) {
  const { t } = useTranslation('common');
  const [code, setCode] = useState(initialCode);

  const normalized = normalizeOracleCode(code);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (normalized.length < 4 || loading) return;
    onSubmitCode(normalized);
  };

  return (
    <motion.div
      variants={dialogPop}
      initial="hidden"
      animate="visible"
      className="w-full max-w-md bg-surface-raised rounded-panel shadow-panel p-6 sm:p-8 space-y-6"
    >
      <div className="space-y-2">
        <div className="flex items-center gap-2.5">
          <span className="lmb-led text-accent animate-led" aria-hidden />
          <span className="text-protocol text-ash-400">{t('oracle.access.eyebrow')}</span>
        </div>
        <h1 className="text-display text-2xl sm:text-3xl text-bone uppercase">
          {t('oracle.access.title')}
        </h1>
        <p className="text-xs text-ash-400 leading-relaxed">
          {t('oracle.access.hint')}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <label className="block space-y-2">
          <span className="lmb-eyebrow block">{t('oracle.access.codeLabel')}</span>
          <div className="relative">
            <KeyRound
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ash-500 pointer-events-none"
            />
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder={t('oracle.access.placeholder')}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={32}
              className="lmb-field w-full pl-10 pr-4 py-3.5 font-mono text-base tracking-[0.14em] uppercase"
            />
          </div>
        </label>

        {error && (
          <div role="alert" className="bg-error-container/30 rounded-control p-3 flex items-center gap-2.5 text-error text-xs">
            <AlertTriangle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={normalized.length < 4 || loading}
          className="lmb-btn lmb-btn-solid w-full h-11 justify-center text-xs uppercase tracking-[0.12em]"
        >
          {loading ? (
            <RetroSpinner size="sm" />
          ) : (
            <>
              <span>{t('oracle.access.submit')}</span>
              <ArrowRight size={15} />
            </>
          )}
        </button>
      </form>

      <div className="pt-3 border-t border-border-subtle flex items-center justify-between text-[11px] text-ash-500">
        <a href="/" className="hover:text-bone transition-colors">
          {t('oracle.access.backToApp')}
        </a>
        <span className="font-mono">LIMBO-OS</span>
      </div>
    </motion.div>
  );
}
