import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { SPRING_SNAP } from '../../lib/motion';
import { generateAgentId } from '../../store/firestore';

interface AgentDossier {
  uid: string;
  characterId: string;
  username: string;
  agentId?: string;
  agentStatus?: 'vivo' | 'morto' | 'desaparecido';
  dangerLevel?: number;
  lastCampaignName?: string;
}

interface MetadataOverlayProps {
  onClose: () => void;
  agent?: AgentDossier | null;
}

const STATUS_STYLE = {
  vivo: { color: 'text-phosphor-400', dot: 'bg-phosphor-400', labelKey: 'status.ativo' },
  morto: { color: 'text-red-400', dot: 'bg-red-400', labelKey: 'status.eliminado' },
  desaparecido: { color: 'text-yellow-400', dot: 'bg-yellow-400', labelKey: 'status.desaparecido' },
} as const;

const DANGER_KEYS = ['none', 'baixo', 'moderado', 'elevado', 'alto', 'critico'] as const;

const CornerMarks = () => (
  <>
    <span aria-hidden className="absolute top-2 left-2 w-3 h-3 border-t border-l border-border-accent" />
    <span aria-hidden className="absolute top-2 right-2 w-3 h-3 border-t border-r border-border-accent" />
    <span aria-hidden className="absolute bottom-2 left-2 w-3 h-3 border-b border-l border-border-accent" />
    <span aria-hidden className="absolute bottom-2 right-2 w-3 h-3 border-b border-r border-border-accent" />
  </>
);

/** Linha de ficha: rótulo ..... valor (pontilhado tipo formulário datilografado). */
const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-baseline gap-2 min-w-0">
    <span className="text-protocol text-[9px] text-ash-500 shrink-0">{label}</span>
    <span aria-hidden className="flex-1 border-b border-dotted border-border-strong -translate-y-0.75" />
    <span className="text-mono-ui text-[11px] text-right min-w-0 truncate">{children}</span>
  </div>
);

export const MetadataOverlay = ({ onClose, agent }: MetadataOverlayProps) => {
  const { t } = useTranslation(['player', 'common']);
  const [agentCode, setAgentCode] = useState<string | null>(agent?.agentId || null);
  const [loading, setLoading] = useState(!agent?.agentId);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (agent?.uid && !agent.agentId) {
      setLoading(true);
      generateAgentId(agent.uid, agent.characterId)
        .then((id) => { setAgentCode(id); setLoading(false); })
        .catch(() => setLoading(false));
    } else if (agent?.agentId) {
      setAgentCode(agent.agentId);
      setLoading(false);
    }
  }, [agent?.uid, agent?.agentId]);

  useEffect(() => {
    if (!loading && agentCode) {
      const timer = setTimeout(() => setRevealed(true), 400);
      return () => clearTimeout(timer);
    }
  }, [loading, agentCode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const status = agent?.agentStatus || 'vivo';
  const statusCfg = useMemo(() => {
    const cfg = STATUS_STYLE[status] || STATUS_STYLE.vivo;
    return { ...cfg, label: t(cfg.labelKey, { ns: 'common' }) };
  }, [status, t]);

  const dangerLevel = agent?.dangerLevel || 0;
  const dangerLabel = t(`danger.${DANGER_KEYS[dangerLevel] || 'none'}`, { ns: 'common' });
  const maskedCode = (agentCode || '0000').replace(/./g, '•');

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-120 bg-surface-scrim flex items-center justify-center p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.94, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        transition={SPRING_SNAP}
        role="dialog"
        aria-modal="true"
        aria-label={t('metadata.title')}
        className="bg-surface-panel border border-border-strong rounded-card shadow-panel w-full max-w-90 relative overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="noise-overlay" />
        <CornerMarks />
        <div aria-hidden className="absolute inset-x-0 top-0 h-0.75 bg-linear-to-r from-accent via-accent-60 to-transparent" />

        <header className="px-7 pt-7 pb-4 border-b border-border-subtle relative z-10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-protocol text-[8px] text-primary/60">{t('metadata.title')}</span>
            <span className="inline-flex items-center gap-1.5 text-protocol text-[8px]">
              <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot} animate-led`} />
              <span className={statusCfg.color}>{statusCfg.label}</span>
            </span>
          </div>
          <h2 className="text-display text-2xl text-white uppercase truncate">{agent?.username || t('metadata.loadingName')}</h2>
        </header>

        <div className="px-7 py-6 space-y-5 relative z-10">
          <Row label={t('metadata.idLabel')}>
            {loading ? (
              <span className="text-primary/40 animate-led">{t('metadata.syncing')}</span>
            ) : (
              <span className="text-primary font-semibold relative inline-block">
                <AnimatePresence mode="wait" initial={false}>
                  {revealed ? (
                    <motion.span key="code" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="inline-block">
                      RM-{agentCode}
                    </motion.span>
                  ) : (
                    <motion.span key="mask" exit={{ opacity: 0, y: -4 }} className="inline-block tracking-widest opacity-60">
                      RM-{maskedCode}
                    </motion.span>
                  )}
                </AnimatePresence>
              </span>
            )}
          </Row>
          <Row label={t('metadata.statusLabel')}>
            <span className={statusCfg.color}>{statusCfg.label}</span>
          </Row>
          <Row label={t('metadata.lastOp')}>
            <span className="text-white/80">{agent?.lastCampaignName || t('metadata.noRecord')}</span>
          </Row>

          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-protocol text-[9px] text-ash-500">{t('danger.label', { ns: 'common' })}</span>
              <span className={`text-protocol text-[9px] ${dangerLevel >= 4 ? 'text-red-400' : dangerLevel >= 2 ? 'text-primary' : 'text-ash-500'}`}>
                {dangerLabel}
              </span>
            </div>
            <div className="flex gap-1.5">
              {Array.from({ length: 5 }, (_, i) => (
                <div
                  key={i}
                  className={`h-2 flex-1 rounded-inset transition duration-700 ${
                    i < dangerLevel
                      ? dangerLevel >= 4 ? 'bg-red-500' : 'bg-primary'
                      : 'bg-surface-sunken border border-border-subtle'
                  }`}
                />
              ))}
            </div>
          </div>

          <p className="pt-4 border-t border-border-subtle text-[9px] leading-relaxed text-ash-600 italic font-sans">
            "Informação classificada nível OMEGA. Distribuição não autorizada resulta em eliminação imediata."
          </p>
        </div>

        <div className="px-7 pb-7 relative z-10">
          <button
            type="button"
            onClick={onClose}
            className="w-full bg-accent-10 hover:bg-accent-20 text-primary border border-border-accent rounded-control py-3.5 text-protocol transition duration-200 active:scale-[0.98]"
          >
            {t('metadata.syncExit')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};
