import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'motion/react';
import type { Campaign } from '../../../data/campaigns';
import { oracleService } from '../../../services/OracleService';
import type { AllocationMode, OracleTemplate } from '../../../types/oracle';
import { useAdminScope } from '../../context/AdminScopeContext';
import { dialogPop, overlayFade } from '../../lib/motion';
import MIcon from '../MIcon';
import OverlayPortal from '../OverlayPortal';
import { useToast } from '../ToastProvider';
import RetroSpinner from '../../../components/player/RetroSpinner';

interface OracleSessionCreatorModalProps {
  open: boolean;
  initialTemplate: OracleTemplate | null;
  templates: OracleTemplate[];
  campaigns: Campaign[];
  defaultCampaignId: string | null;
  onClose: () => void;
  onCreated: (sessionId: string) => void;
}

const FIELD =
  'lmb-field w-full px-3 py-2.5 text-xs text-bone rounded-sm outline-none';

export default function OracleSessionCreatorModal({
  open,
  initialTemplate,
  templates,
  campaigns,
  defaultCampaignId,
  onClose,
  onCreated,
}: OracleSessionCreatorModalProps) {
  const { t } = useTranslation('admin');
  const toast = useToast();
  const { isCoGm } = useAdminScope();

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    () => initialTemplate?.id || templates[0]?.id || '',
  );
  const selectedTemplate = useMemo(
    () => templates.find((tpl) => tpl.id === selectedTemplateId) || initialTemplate || templates[0] || null,
    [templates, selectedTemplateId, initialTemplate],
  );

  const [title, setTitle] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [mode, setMode] = useState<AllocationMode>('batch');
  const [autoResolve, setAutoResolve] = useState(true);
  const [codePrefix, setCodePrefix] = useState('ORC');
  const [slotCount, setSlotCount] = useState<number>(2);
  const [slotLabels, setSlotLabels] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  // Sincroniza estado ao abrir o modal com um template específico
  useEffect(() => {
    if (!open) return;
    const target = initialTemplate || templates[0] || null;
    if (target) {
      setSelectedTemplateId(target.id);
      setTitle(target.name);
      setCodePrefix(target.codePrefix || 'ORC');
      setSlotCount(Math.max(1, target.sheets.length));
    }
    if (defaultCampaignId && campaigns.some((c) => c.id === defaultCampaignId)) {
      setCampaignId(defaultCampaignId);
    } else if (isCoGm) {
      setCampaignId(campaigns[0]?.id || '');
    } else {
      setCampaignId('');
    }
    setMode('batch');
    setAutoResolve(true);
    setSlotLabels([]);
  }, [open, initialTemplate, templates, defaultCampaignId, campaigns, isCoGm]);

  const maxSheets = Math.max(selectedTemplate?.sheets.length || 1, 1);

  const handleSelectTemplate = (nextId: string) => {
    setSelectedTemplateId(nextId);
    const tpl = templates.find((item) => item.id === nextId);
    if (tpl) {
      setTitle(tpl.name);
      setCodePrefix(tpl.codePrefix || 'ORC');
      setSlotCount(Math.max(1, tpl.sheets.length));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creating || !selectedTemplate) return;
    if (isCoGm && !campaignId) {
      toast.error(t('oracle.creator.coGmNeedCampaign'));
      return;
    }
    setCreating(true);
    try {
      const clampedCount = Math.min(Math.max(slotCount, 1), selectedTemplate.sheets.length);
      const res = await oracleService.createSession({
        campaignId: campaignId || null,
        templateId: selectedTemplate.id,
        title: title.trim() || selectedTemplate.name,
        mode,
        slotCount: clampedCount,
        codePrefix,
        autoResolve: mode === 'batch' ? autoResolve : false,
        slotLabels: Array.from({ length: clampedCount }, (_, idx) => (slotLabels[idx] || '').trim()),
      });
      toast.success(t('oracle.toast.sessionCreated', { count: res.slotCodes.length }));
      onCreated(res.sessionId);
      onClose();
    } catch (err: unknown) {
      console.error('[OracleSessionCreatorModal] createSession failed:', err);
      toast.error((err as { message?: string })?.message || t('oracle.toast.createFail'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <OverlayPortal open={open} onClose={creating ? undefined : onClose} withExitAnimation>
      <AnimatePresence>
        {open && selectedTemplate && (
          <motion.div
            variants={overlayFade}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-scrim"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget && !creating) onClose();
            }}
          >
            <motion.form
              onSubmit={handleSubmit}
              variants={dialogPop}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="w-full max-w-xl max-h-[90dvh] overflow-y-auto bg-surface-container-low rounded-panel shadow-panel p-6 space-y-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display font-bold text-lg text-bone uppercase tracking-wide">
                    {t('oracle.creator.title')}
                  </h2>
                  <p className="text-xs text-ash-400 mt-0.5">{t('oracle.creator.subtitle')}</p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={creating}
                  className="lmb-btn lmb-btn-ghost lmb-btn-icon h-8 w-8"
                  aria-label={t('common:close')}
                >
                  <MIcon name="close" className="text-base" />
                </button>
              </div>

              <div className="space-y-4">
                <label className="block space-y-1.5">
                  <span className="lmb-eyebrow block">{t('oracle.creator.template')}</span>
                  <select
                    value={selectedTemplate.id}
                    onChange={(e) => handleSelectTemplate(e.target.value)}
                    className={FIELD}
                  >
                    {templates.map((tpl) => (
                      <option key={tpl.id} value={tpl.id}>
                        {tpl.name} ({tpl.sheets.length} {t('oracle.creator.sheetsUnit')})
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="block space-y-1.5">
                    <span className="lmb-eyebrow block">{t('oracle.creator.sessionTitle')}</span>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      maxLength={140}
                      className={FIELD}
                      required
                    />
                  </label>

                  <label className="block space-y-1.5">
                    <span className="lmb-eyebrow block">{t('oracle.creator.campaign')}</span>
                    <select
                      value={campaignId}
                      onChange={(e) => setCampaignId(e.target.value)}
                      className={FIELD}
                      required={isCoGm}
                    >
                      {!isCoGm && <option value="">{t('oracle.creator.noCampaign')}</option>}
                      {campaigns.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <label className="block space-y-1.5">
                    <span className="lmb-eyebrow block">{t('oracle.creator.mode')}</span>
                    <select
                      value={mode}
                      onChange={(e) => setMode(e.target.value as AllocationMode)}
                      className={FIELD}
                    >
                      <option value="batch">{t('oracle.mode.batch')}</option>
                      <option value="instant">{t('oracle.mode.instant')}</option>
                    </select>
                  </label>

                  <label className="block space-y-1.5">
                    <span className="lmb-eyebrow block">
                      {t('oracle.creator.slotCount', { max: maxSheets })}
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={maxSheets}
                      value={slotCount}
                      onChange={(e) =>
                        setSlotCount(Math.min(Math.max(Number(e.target.value) || 1, 1), maxSheets))
                      }
                      className={FIELD}
                    />
                  </label>

                  <label className="block space-y-1.5">
                    <span className="lmb-eyebrow block">{t('oracle.creator.prefix')}</span>
                    <input
                      type="text"
                      value={codePrefix}
                      onChange={(e) =>
                        setCodePrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))
                      }
                      maxLength={8}
                      className={`${FIELD} font-mono uppercase`}
                    />
                  </label>
                </div>

                {mode === 'batch' && (
                  <label className="flex items-center gap-2.5 text-xs text-ash-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoResolve}
                      onChange={(e) => setAutoResolve(e.target.checked)}
                      className="accent-accent"
                    />
                    <span>{t('oracle.creator.autoResolve')}</span>
                  </label>
                )}

                {slotCount <= 16 && (
                  <div className="space-y-2 pt-2 border-t border-border-subtle">
                    <span className="lmb-eyebrow block">{t('oracle.creator.slotLabelsHint')}</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {Array.from({ length: slotCount }).map((_, idx) => (
                        <input
                          key={idx}
                          type="text"
                          value={slotLabels[idx] || ''}
                          onChange={(e) => {
                            const next = [...slotLabels];
                            next[idx] = e.target.value;
                            setSlotLabels(next);
                          }}
                          placeholder={t('oracle.creator.slotPlaceholder', { n: idx + 1 })}
                          maxLength={60}
                          className={FIELD}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border-subtle">
                <button
                  type="button"
                  disabled={creating}
                  onClick={onClose}
                  className="lmb-btn h-9 px-4"
                >
                  {t('common:cancel')}
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="lmb-btn lmb-btn-solid h-9 px-5"
                >
                  {creating ? <RetroSpinner size="sm" /> : t('oracle.creator.submit')}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </OverlayPortal>
  );
}
