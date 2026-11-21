import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import QRCode from 'react-qr-code';
import { AnimatePresence, motion } from 'motion/react';
import {
  downloadMarkdownFile,
  exportSessionToMarkdown,
  exportSlotToMarkdown,
  formatScore4,
  resolveSlotDisplayName,
} from '../../../modules/oracle';
import { oracleService, oracleSlotUrl } from '../../../services/OracleService';
import type { OracleSession, OracleSlot } from '../../../types/oracle';
import type { Campaign } from '../../../data/campaigns';
import { dialogPop, overlayFade } from '../../lib/motion';
import { useModal } from '../ConfirmModal';
import MIcon from '../MIcon';
import OverlayPortal from '../OverlayPortal';
import { useToast } from '../ToastProvider';
import RetroSpinner from '../../../components/player/RetroSpinner';

interface OracleSessionConsoleProps {
  session: OracleSession;
  campaigns: Campaign[];
  onDeleted: () => void;
}

const STATUS_STYLE: Record<OracleSlot['status'], string> = {
  pending: 'bg-surface-container-lowest text-ash-400',
  submitted: 'bg-amber-500/15 text-amber-300',
  revealed: 'bg-phosphor-500/15 text-phosphor-300',
};

export default function OracleSessionConsole({
  session,
  campaigns,
  onDeleted,
}: OracleSessionConsoleProps) {
  const { t } = useTranslation('admin');
  const toast = useToast();
  const { showConfirm, modal } = useModal();

  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [qrSlot, setQrSlot] = useState<OracleSlot | null>(null);
  const [detailSlot, setDetailSlot] = useState<OracleSlot | null>(null);

  const template = session.templateSnapshot;
  const sheets = template.sheets || [];
  const slots = useMemo(
    () =>
      Object.values(session.slots || {}).sort((a, b) =>
        a.slotCode.localeCompare(b.slotCode, 'en'),
      ),
    [session.slots],
  );
  const wordById = useMemo(
    () => new Map((template.syncWords || []).map((w) => [w.id, w])),
    [template.syncWords],
  );
  const sheetById = useMemo(
    () => new Map(sheets.map((s) => [s.id, s])),
    [sheets],
  );

  const submittedCount = slots.filter((s) => s.status === 'submitted').length;
  const completedCount = slots.filter(
    (s) => s.status === 'submitted' || s.status === 'revealed',
  ).length;
  const canResolve = session.mode === 'batch' && !session.resolved && submittedCount > 0;
  const canAddSlot = !session.resolved && slots.length < sheets.length;
  const campaignName = session.campaignId
    ? campaigns.find((c) => c.id === session.campaignId)?.name || session.campaignId
    : t('oracle.creator.noCampaign');

  const copyText = async (text: string, okMsg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(okMsg);
    } catch {
      toast.error(t('oracle.toast.copyFail'));
    }
  };

  const handleResolve = async () => {
    const pendingCount = slots.length - completedCount;
    if (pendingCount > 0) {
      const ok = await showConfirm(
        t('oracle.console.resolvePartialTitle'),
        t('oracle.console.resolvePartialBody', { pending: pendingCount, ready: submittedCount }),
        t('oracle.console.resolve'),
      );
      if (!ok) return;
    }
    setBusyAction('resolve');
    try {
      await oracleService.resolveSession(session.id);
      toast.success(t('oracle.toast.resolved'));
    } catch (err: unknown) {
      toast.error((err as { message?: string })?.message || t('oracle.toast.resolveFail'));
    } finally {
      setBusyAction(null);
    }
  };

  const handleAddSlot = async () => {
    setBusyAction('addSlot');
    try {
      const res = await oracleService.addSlot(session.id);
      toast.success(t('oracle.toast.slotAdded', { code: res.slotCode }));
    } catch (err: unknown) {
      toast.error((err as { message?: string })?.message || t('oracle.toast.actionFail'));
    } finally {
      setBusyAction(null);
    }
  };

  const handleResetSlot = async (slot: OracleSlot) => {
    const ok = await showConfirm(
      t('oracle.console.resetTitle'),
      t('oracle.console.resetBody', { code: slot.slotCode }),
      t('oracle.console.resetAction'),
    );
    if (!ok) return;
    setBusyAction(`reset:${slot.slotCode}`);
    try {
      await oracleService.resetSlot(session.id, slot.slotCode);
      toast.success(t('oracle.toast.slotReset', { code: slot.slotCode }));
    } catch (err: unknown) {
      toast.error((err as { message?: string })?.message || t('oracle.toast.actionFail'));
    } finally {
      setBusyAction(null);
    }
  };

  const handleDeleteSession = async () => {
    const ok = await showConfirm(
      t('oracle.console.deleteTitle'),
      t('oracle.console.deleteBody', { title: session.title }),
      t('oracle.console.deleteAction'),
    );
    if (!ok) return;
    setBusyAction('delete');
    try {
      await oracleService.deleteSession(session.id);
      toast.success(t('oracle.toast.sessionDeleted'));
      onDeleted();
    } catch (err: unknown) {
      toast.error((err as { message?: string })?.message || t('oracle.toast.deleteFail'));
    } finally {
      setBusyAction(null);
    }
  };

  const handleCopyAllLinks = () => {
    const lines = slots.map((s) => {
      const tag = s.label ? ` (${s.label})` : '';
      return `${s.slotCode}${tag}: ${oracleSlotUrl(s.slotCode)}`;
    });
    void copyText(lines.join('\n'), t('oracle.toast.allLinksCopied'));
  };

  const handleExportSession = () => {
    downloadMarkdownFile(`${session.title}-oraculo.md`, exportSessionToMarkdown(session));
  };

  const handleExportSlot = (slot: OracleSlot) => {
    const sheet = slot.assignedSheetId ? sheetById.get(slot.assignedSheetId) : undefined;
    if (!sheet) return;
    const md = exportSlotToMarkdown({
      sessionTitle: session.title,
      rpgSystem: template.rpgSystem,
      slotCode: slot.slotCode,
      slotLabel: slot.label,
      intakeData: slot.intakeData,
      intakeFields: template.intakeFields,
      sheet,
      sharedDocument: template.sharedDocument,
      affinityScore: slot.affinityScore ?? 0,
      isUnexpectedAssignment: slot.isUnexpectedAssignment,
      customFlavor: slot.customFlavor,
      submittedAt: slot.submittedAt,
    });
    downloadMarkdownFile(`${slot.slotCode}-${sheet.id}.md`, md);
  };

  const matrixSlots = slots.filter((s) => Boolean(s.scores));

  return (
    <div className="space-y-6">
      {modal}

      {/* Cabeçalho e ações da sessão */}
      <section className="bg-surface-container-low rounded-panel p-5 sm:p-6 space-y-4 shadow-panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
              <span className="px-2 py-0.5 rounded-inset bg-accent-10 text-primary uppercase font-display font-bold text-[10px]">
                {t(`oracle.mode.${session.mode}`)}
              </span>
              <span className={session.resolved ? 'text-phosphor-400' : 'text-amber-300'}>
                {session.resolved ? t('oracle.console.stateResolved') : t('oracle.console.stateOpen')}
              </span>
              <span className="text-ash-500">· {campaignName}</span>
            </div>
            <h3 className="font-display font-bold text-xl text-bone uppercase tracking-wide">
              {session.title}
            </h3>
            <p className="text-xs font-mono text-ash-400">
              {template.rpgSystem} · {completedCount}/{slots.length} {t('oracle.console.submittedUnit')} ·{' '}
              {session.availablePool.length} {t('oracle.console.freeSheetsUnit')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={handleCopyAllLinks} className="lmb-btn h-9 px-3">
              <MIcon name="content_copy" className="text-base" />
              <span>{t('oracle.console.copyAllLinks')}</span>
            </button>
            <button type="button" onClick={handleExportSession} className="lmb-btn h-9 px-3">
              <MIcon name="download" className="text-base" />
              <span>{t('oracle.console.exportMd')}</span>
            </button>
            {canAddSlot && (
              <button
                type="button"
                disabled={busyAction === 'addSlot'}
                onClick={() => void handleAddSlot()}
                className="lmb-btn h-9 px-3"
              >
                <MIcon name="person_add" className="text-base" />
                <span>{t('oracle.console.addSlot')}</span>
              </button>
            )}
            {canResolve && (
              <button
                type="button"
                disabled={busyAction === 'resolve'}
                onClick={() => void handleResolve()}
                className="lmb-btn lmb-btn-solid h-9 px-4"
              >
                {busyAction === 'resolve' ? (
                  <RetroSpinner size="sm" />
                ) : (
                  <>
                    <MIcon name="auto_awesome" className="text-base" />
                    <span>{t('oracle.console.resolve')}</span>
                  </>
                )}
              </button>
            )}
            <button
              type="button"
              disabled={busyAction === 'delete'}
              onClick={() => void handleDeleteSession()}
              className="lmb-btn lmb-btn-ghost lmb-btn-icon h-9 w-9 text-red-400 hover:text-red-300"
              title={t('oracle.console.deleteAction')}
              aria-label={t('oracle.console.deleteAction')}
            >
              <MIcon name="delete" className="text-base" />
            </button>
          </div>
        </div>

        {session.resolutionMetrics && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-border-subtle">
            <div className="bg-surface-sunken rounded-card p-3 shadow-pressed">
              <div className="text-[10px] font-display uppercase tracking-wider text-ash-500">
                {t('oracle.console.metricTotal')}
              </div>
              <div className="font-mono text-lg text-bone">
                {formatScore4(session.resolutionMetrics.totalScore)}
              </div>
            </div>
            <div className="bg-surface-sunken rounded-card p-3 shadow-pressed">
              <div className="text-[10px] font-display uppercase tracking-wider text-ash-500">
                {t('oracle.console.metricMin')}
              </div>
              <div className="font-mono text-lg text-bone">
                {formatScore4(session.resolutionMetrics.minScore)}
              </div>
            </div>
            <div className="bg-surface-sunken rounded-card p-3 shadow-pressed">
              <div className="text-[10px] font-display uppercase tracking-wider text-ash-500">
                {t('oracle.console.metricFirst')}
              </div>
              <div className="font-mono text-lg text-bone">
                {session.resolutionMetrics.firstChoicesHit}
              </div>
            </div>
            <div className="bg-surface-sunken rounded-card p-3 shadow-pressed">
              <div className="text-[10px] font-display uppercase tracking-wider text-ash-500">
                {t('oracle.console.metricWords')}
              </div>
              <div className="font-mono text-lg text-bone">
                {session.resolutionMetrics.totalWordHits}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Vagas e códigos individuais */}
      <section className="space-y-3">
        <h4 className="text-[10px] font-display font-bold uppercase tracking-[0.14em] text-ash-400">
          {t('oracle.console.slotsTitle', { count: slots.length })}
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {slots.map((slot) => {
            const identity = resolveSlotDisplayName(
              slot.intakeData,
              template.intakeFields,
              slot.label,
              slot.slotCode,
            );
            const assignedSheet = slot.assignedSheetId
              ? sheetById.get(slot.assignedSheetId)
              : undefined;
            const canReset =
              slot.status !== 'pending' && !(session.mode === 'batch' && session.resolved);

            return (
              <div
                key={slot.slotCode}
                className="bg-surface-container-low rounded-panel p-4 flex flex-col justify-between gap-3 shadow-hairline"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-accent tracking-wider">
                      {slot.slotCode}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-inset text-[10px] font-display font-bold uppercase tracking-wider ${STATUS_STYLE[slot.status]}`}
                    >
                      {t(`oracle.status.${slot.status}`)}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <div className="text-sm font-display font-bold text-bone truncate">
                      {identity.primary}
                    </div>
                    {identity.secondary && (
                      <div className="text-[11px] text-ash-400 truncate">{identity.secondary}</div>
                    )}
                  </div>

                  {assignedSheet && (
                    <div className="bg-surface-sunken rounded-card px-3 py-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: assignedSheet.themeColor || '#FF8C00' }}
                        />
                        <span className="text-xs font-display font-bold text-bone truncate">
                          {assignedSheet.name}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] text-phosphor-400 shrink-0">
                        {formatScore4(slot.affinityScore)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t border-border-subtle">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        void copyText(oracleSlotUrl(slot.slotCode), t('oracle.toast.linkCopied'))
                      }
                      className="lmb-btn h-7 px-2 text-[11px]"
                      title={t('oracle.console.copyLink')}
                    >
                      <MIcon name="link" className="text-sm" />
                      <span>{t('oracle.console.copyLink')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setQrSlot(slot)}
                      className="lmb-btn lmb-btn-ghost lmb-btn-icon h-7 w-7"
                      title="QR Code"
                      aria-label="QR Code"
                    >
                      <MIcon name="qr_code" className="text-sm" />
                    </button>
                    {slot.scores && (
                      <button
                        type="button"
                        onClick={() => setDetailSlot(slot)}
                        className="lmb-btn lmb-btn-ghost lmb-btn-icon h-7 w-7"
                        title={t('oracle.console.details')}
                        aria-label={t('oracle.console.details')}
                      >
                        <MIcon name="visibility" className="text-sm" />
                      </button>
                    )}
                  </div>

                  {canReset && (
                    <button
                      type="button"
                      disabled={busyAction === `reset:${slot.slotCode}`}
                      onClick={() => void handleResetSlot(slot)}
                      className="lmb-btn lmb-btn-ghost h-7 px-2 text-[11px] text-amber-300"
                    >
                      <MIcon name="restart_alt" className="text-sm" />
                      <span>{t('oracle.console.resetAction')}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Matriz de afinidade (4 casas decimais) */}
      {matrixSlots.length > 0 && (
        <section className="bg-surface-container-low rounded-panel p-5 space-y-3 shadow-panel">
          <h4 className="text-[10px] font-display font-bold uppercase tracking-[0.14em] text-ash-400">
            {t('oracle.console.matrixTitle')}
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border-subtle text-[10px] font-display uppercase tracking-wider text-ash-400">
                  <th className="py-2 pr-3">{t('oracle.console.colSlot')}</th>
                  {sheets.map((s) => (
                    <th key={s.id} className="py-2 px-2 text-right font-mono">
                      {s.name}
                    </th>
                  ))}
                  <th className="py-2 pl-3">{t('oracle.console.colAssigned')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50">
                {matrixSlots.map((slot) => {
                  const identity = resolveSlotDisplayName(
                    slot.intakeData,
                    template.intakeFields,
                    slot.label,
                    slot.slotCode,
                  );
                  return (
                    <tr key={slot.slotCode}>
                      <td className="py-2.5 pr-3">
                        <div className="font-mono text-accent">{slot.slotCode}</div>
                        <div className="text-[11px] text-ash-400">{identity.primary}</div>
                      </td>
                      {sheets.map((s) => {
                        const isWinner = slot.assignedSheetId === s.id;
                        const score = slot.scores?.[s.id] ?? 0;
                        const pos = slot.wordPositions?.[s.id] || [];
                        return (
                          <td
                            key={s.id}
                            className={`py-2.5 px-2 text-right font-mono tabular-nums ${
                              isWinner ? 'text-phosphor-400 font-bold bg-phosphor-500/10' : 'text-ash-300'
                            }`}
                          >
                            <div>{formatScore4(score)}</div>
                            {pos.length > 0 && (
                              <div className="text-[10px] text-ash-500">#{pos.join(',#')}</div>
                            )}
                          </td>
                        );
                      })}
                      <td className="py-2.5 pl-3 font-display font-bold text-bone">
                        {slot.assignedSheetId ? sheetById.get(slot.assignedSheetId)?.name || '—' : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Log auditável */}
      {session.auditLog?.length > 0 && (
        <section className="bg-surface-container-low rounded-panel p-5 space-y-3 shadow-panel">
          <h4 className="text-[10px] font-display font-bold uppercase tracking-[0.14em] text-ash-400">
            {t('oracle.console.auditTitle')}
          </h4>
          <ul className="space-y-2 text-xs font-mono">
            {[...session.auditLog].reverse().map((entry, idx) => (
              <li key={`${entry.at}-${idx}`} className="bg-surface-sunken rounded-card p-3 space-y-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-bone">{entry.message}</span>
                  <span className="text-[10px] text-ash-500">
                    {new Date(entry.at).toLocaleString('pt-BR')}
                  </span>
                </div>
                {entry.details?.contenders && entry.details.contenders.length > 0 && (
                  <div className="pt-1 space-y-0.5 text-[11px] text-ash-400">
                    {entry.details.contenders.map((c, ci) => (
                      <div key={ci}>
                        {c.slotCode} → {sheetById.get(c.sheetId)?.name || c.sheetId}:{' '}
                        {formatScore4(c.score)} · {c.wordHits} pal.
                        {c.wordPositions?.length ? ` (#${c.wordPositions.join(', #')})` : ''}
                        {c.won ? ' ★' : ''}
                      </div>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Modal QR Code */}
      <OverlayPortal open={Boolean(qrSlot)} onClose={() => setQrSlot(null)} withExitAnimation>
        <AnimatePresence>
          {qrSlot && (
            <motion.div
              variants={overlayFade}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-scrim"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setQrSlot(null);
              }}
            >
              <motion.div
                variants={dialogPop}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="w-full max-w-sm bg-surface-container-low rounded-panel shadow-panel p-6 text-center space-y-4"
              >
                <div className="font-mono text-sm font-bold text-accent tracking-widest">
                  {qrSlot.slotCode}
                </div>
                <div className="bg-white p-4 rounded-card inline-block">
                  <QRCode value={oracleSlotUrl(qrSlot.slotCode)} size={200} />
                </div>
                <p className="text-[11px] font-mono text-ash-400 break-all">
                  {oracleSlotUrl(qrSlot.slotCode)}
                </p>
                <div className="flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      void copyText(oracleSlotUrl(qrSlot.slotCode), t('oracle.toast.linkCopied'))
                    }
                    className="lmb-btn lmb-btn-primary h-9 px-4"
                  >
                    {t('oracle.console.copyLink')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setQrSlot(null)}
                    className="lmb-btn h-9 px-4"
                  >
                    {t('common:close')}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </OverlayPortal>

      {/* Modal Detalhes da Vaga */}
      <OverlayPortal open={Boolean(detailSlot)} onClose={() => setDetailSlot(null)} withExitAnimation>
        <AnimatePresence>
          {detailSlot && (
            <motion.div
              variants={overlayFade}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-scrim"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setDetailSlot(null);
              }}
            >
              <motion.div
                variants={dialogPop}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="w-full max-w-2xl max-h-[88dvh] overflow-y-auto bg-surface-container-low rounded-panel shadow-panel p-6 space-y-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-mono text-xs text-accent">{detailSlot.slotCode}</div>
                    <h3 className="font-display font-bold text-lg text-bone uppercase">
                      {
                        resolveSlotDisplayName(
                          detailSlot.intakeData,
                          template.intakeFields,
                          detailSlot.label,
                          detailSlot.slotCode,
                        ).primary
                      }
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {detailSlot.assignedSheetId && (
                      <button
                        type="button"
                        onClick={() => handleExportSlot(detailSlot)}
                        className="lmb-btn h-8 px-3 text-xs"
                      >
                        <MIcon name="download" className="text-sm" />
                        <span>MD</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setDetailSlot(null)}
                      className="lmb-btn lmb-btn-ghost lmb-btn-icon h-8 w-8"
                      aria-label={t('common:close')}
                    >
                      <MIcon name="close" className="text-base" />
                    </button>
                  </div>
                </div>

                {/* Palavras escolhidas em ordem */}
                {detailSlot.selectedWordIds?.length > 0 && (
                  <div className="space-y-2">
                    <span className="lmb-eyebrow block">{t('oracle.console.selectedWordsOrder')}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {detailSlot.selectedWordIds.map((wid, idx) => {
                        const w = wordById.get(wid);
                        const s = w ? sheetById.get(w.sheetId) : undefined;
                        return (
                          <span
                            key={wid}
                            className="px-2.5 py-1 rounded-inset bg-surface-sunken font-mono text-xs text-bone inline-flex items-center gap-1.5"
                          >
                            <span className="text-accent font-bold">#{idx + 1}</span>
                            <span>{w?.label || wid}</span>
                            {s && <span className="text-[10px] text-ash-400">({s.name})</span>}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Ranking detalhado com 4 casas decimais */}
                {detailSlot.scores && (
                  <div className="space-y-2">
                    <span className="lmb-eyebrow block">{t('oracle.console.scoresRanking')}</span>
                    <div className="space-y-1.5">
                      {(detailSlot.ranking || Object.keys(detailSlot.scores)).map((sid, idx) => {
                        const s = sheetById.get(sid);
                        const pos = detailSlot.wordPositions?.[sid] || [];
                        const isAssigned = detailSlot.assignedSheetId === sid;
                        return (
                          <div
                            key={sid}
                            className={`rounded-card px-3.5 py-2 flex items-center justify-between gap-3 text-xs font-mono ${
                              isAssigned ? 'bg-phosphor-500/15 text-bone' : 'bg-surface-sunken text-ash-300'
                            }`}
                          >
                            <span className="truncate">
                              {idx + 1}. {s?.name || sid}
                              {pos.length > 0 ? ` · pal. #${pos.join(',#')}` : ''}
                            </span>
                            <span className={isAssigned ? 'text-phosphor-300 font-bold' : ''}>
                              {formatScore4(detailSlot.scores?.[sid])}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Campos de identificação preenchidos */}
                {detailSlot.intakeData && Object.keys(detailSlot.intakeData).length > 0 && (
                  <div className="space-y-2">
                    <span className="lmb-eyebrow block">{t('oracle.console.intakeDataTitle')}</span>
                    <dl className="divide-y divide-border-subtle bg-surface-sunken rounded-card p-3.5 text-xs">
                      {template.intakeFields.map((f) => {
                        const val = detailSlot.intakeData?.[f.id];
                        if (!val) return null;
                        return (
                          <div key={f.id} className="py-1.5 first:pt-0 last:pb-0">
                            <dt className="text-[10px] uppercase text-ash-500 font-display font-bold">
                              {f.label}
                            </dt>
                            <dd className="text-ash-200 whitespace-pre-wrap">{val}</dd>
                          </div>
                        );
                      })}
                    </dl>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </OverlayPortal>
    </div>
  );
}
