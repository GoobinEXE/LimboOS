import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'motion/react';
import type { Campaign } from '../../../data/campaigns';
import {
  parseSheetsFromSingleDocument,
  slugifyOracleId,
  type DocumentSplitMode,
} from '../../../modules/oracle';
import { oracleService } from '../../../services/OracleService';
import type {
  OracleAbility,
  OracleFlavorField,
  OracleIntakeField,
  OracleQuestion,
  OracleQuestionOption,
  OracleSheet,
  OracleStatEntry,
  OracleSyncWord,
  OracleTemplate,
  OracleTrait,
  SheetContentFormat,
} from '../../../types/oracle';
import { useAdminScope } from '../../context/AdminScopeContext';
import { dialogPop, overlayFade } from '../../lib/motion';
import CampaignBindingPicker from '../CampaignBindingPicker';
import MIcon from '../MIcon';
import OverlayPortal from '../OverlayPortal';
import { useToast } from '../ToastProvider';
import RetroSpinner from '../../../components/player/RetroSpinner';

interface OracleTemplateEditorModalProps {
  open: boolean;
  template: OracleTemplate | null;
  campaigns: Campaign[];
  onClose: () => void;
  onSave: (template: OracleTemplate) => Promise<void>;
}

type EditorTab = 'general' | 'intake' | 'sheets' | 'quiz';

const FIELD = 'lmb-field w-full px-3 py-2 text-xs text-bone rounded-sm outline-none';
const MAX_SHEETS = 64;

function toNum(raw: string, fallback = 0): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export default function OracleTemplateEditorModal({
  open,
  template,
  campaigns,
  onClose,
  onSave,
}: OracleTemplateEditorModalProps) {
  const { t } = useTranslation('admin');
  const toast = useToast();
  const { isCoGm } = useAdminScope();

  const [draft, setDraft] = useState<OracleTemplate | null>(() =>
    template ? structuredClone(template) : null,
  );
  const [tab, setTab] = useState<EditorTab>('general');
  const [activeSheetIdx, setActiveSheetIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  // Importação em lote de documento único (.md / .txt)
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkSplitMode, setBulkSplitMode] = useState<DocumentSplitMode>('auto');
  const [bulkFormat, setBulkFormat] = useState<SheetContentFormat>('markdown');

  const sharedPdfRef = useRef<HTMLInputElement>(null);
  const sheetPdfRef = useRef<HTMLInputElement>(null);
  const sheetTextFileRef = useRef<HTMLInputElement>(null);
  const bulkFileRef = useRef<HTMLInputElement>(null);

  const templateId = template?.id || '';
  useEffect(() => {
    if (open && template) {
      const copy = structuredClone(template);
      if (isCoGm && copy.campaignIds === 'global') {
        copy.campaignIds = campaigns[0] ? [campaigns[0].id] : [];
      }
      setDraft(copy);
      setTab('general');
      setActiveSheetIdx(0);
      setBulkOpen(false);
      setBulkText('');
    }
  }, [open, templateId, template, isCoGm, campaigns]);

  const balanceMap = useMemo(() => {
    const map = new Map<string, { qCount: number; wCount: number }>();
    if (!draft) return map;
    draft.sheets.forEach((s) => map.set(s.id, { qCount: 0, wCount: 0 }));
    draft.questions.forEach((q) => {
      q.options.forEach((opt) => {
        if (opt.weights && Object.keys(opt.weights).length > 0) {
          Object.entries(opt.weights).forEach(([sid, val]) => {
            if (val > 0) {
              const item = map.get(sid);
              if (item) item.qCount += 1;
            }
          });
        } else if (opt.primary) {
          const item = map.get(opt.primary);
          if (item) item.qCount += 1;
        }
      });
    });
    draft.syncWords.forEach((w) => {
      const item = map.get(w.sheetId);
      if (item) item.wCount += 1;
    });
    return map;
  }, [draft]);

  const bulkPreview = useMemo(() => {
    if (!bulkText.trim()) return [];
    return parseSheetsFromSingleDocument(bulkText, bulkSplitMode, bulkFormat);
  }, [bulkText, bulkSplitMode, bulkFormat]);

  if (!draft) return null;

  const safeSheetIdx = Math.min(activeSheetIdx, Math.max(draft.sheets.length - 1, 0));
  const activeSheet: OracleSheet | undefined = draft.sheets[safeSheetIdx];

  const updateSheet = (idx: number, patch: Partial<OracleSheet>) => {
    const next = [...draft.sheets];
    next[idx] = { ...next[idx], ...patch };
    setDraft({ ...draft, sheets: next });
  };

  const addSheet = () => {
    if (draft.sheets.length >= MAX_SHEETS) return;
    const n = draft.sheets.length + 1;
    const id = `ficha_${Date.now().toString(36).slice(-4)}_${n}`;
    const nextSheet: OracleSheet = {
      id,
      name: `Ficha ${n}`,
      origin: '',
      subtitle: '',
      summary: '',
      revealNarrative: '',
      unexpectedNarrative: '',
      themeColor: '#FF8C00',
      contentFormat: 'markdown',
      body: '',
      attachment: null,
      useSharedDocument: false,
      sharedPageRange: '',
      attributes: [],
      derivedStats: [],
      traits: [],
      abilities: [],
      flavorFields: [],
    };
    setDraft({ ...draft, sheets: [...draft.sheets, nextSheet] });
    setActiveSheetIdx(draft.sheets.length);
  };

  const removeSheet = (idx: number) => {
    if (draft.sheets.length <= 2) return;
    const removedId = draft.sheets[idx].id;
    const remaining = draft.sheets.filter((_, i) => i !== idx);
    const fallbackId = remaining[0].id;
    const nextQuestions = draft.questions.map((q) => ({
      ...q,
      options: q.options.map((o) => {
        const nextPrimary = o.primary === removedId ? fallbackId : o.primary;
        const nextSec =
          o.secondary === removedId || o.secondary === nextPrimary ? null : o.secondary;
        let nextWeights = o.weights;
        if (nextWeights && removedId in nextWeights) {
          const cloned = { ...nextWeights };
          delete cloned[removedId];
          nextWeights = Object.keys(cloned).length > 0 ? cloned : null;
        }
        return { ...o, primary: nextPrimary, secondary: nextSec, weights: nextWeights };
      }),
    }));
    const nextWords = draft.syncWords.map((w) =>
      w.sheetId === removedId ? { ...w, sheetId: fallbackId } : w,
    );
    setDraft({
      ...draft,
      sheets: remaining,
      questions: nextQuestions,
      syncWords: nextWords,
    });
    setActiveSheetIdx(Math.max(0, idx - 1));
  };

  const renameSheetId = (idx: number, newIdRaw: string) => {
    const oldId = draft.sheets[idx].id;
    const nextId = slugifyOracleId(newIdRaw, oldId);
    if (nextId === oldId || draft.sheets.some((s, i) => i !== idx && s.id === nextId)) return;

    const nextSheets = draft.sheets.map((s, i) => (i === idx ? { ...s, id: nextId } : s));
    const nextQuestions = draft.questions.map((q) => ({
      ...q,
      options: q.options.map((o) => {
        let nextWeights = o.weights;
        if (nextWeights && oldId in nextWeights) {
          const cloned = { ...nextWeights };
          cloned[nextId] = cloned[oldId];
          delete cloned[oldId];
          nextWeights = cloned;
        }
        return {
          ...o,
          primary: o.primary === oldId ? nextId : o.primary,
          secondary: o.secondary === oldId ? nextId : o.secondary,
          weights: nextWeights,
        };
      }),
    }));
    const nextWords = draft.syncWords.map((w) =>
      w.sheetId === oldId ? { ...w, sheetId: nextId } : w,
    );
    setDraft({
      ...draft,
      sheets: nextSheets,
      questions: nextQuestions,
      syncWords: nextWords,
    });
  };

  const handleUploadSharedDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingKey('shared');
    try {
      const doc = await oracleService.uploadDocument(file, draft.id);
      setDraft({ ...draft, sharedDocument: doc });
      toast.success(t('oracle.editor.uploadOk'));
    } catch (err) {
      console.error('[OracleTemplateEditor] shared upload failed:', err);
      toast.error(t('oracle.editor.uploadFail'));
    } finally {
      setUploadingKey(null);
    }
  };

  const handleUploadSheetDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !activeSheet) return;
    setUploadingKey(`sheet:${activeSheet.id}`);
    try {
      const doc = await oracleService.uploadDocument(file, draft.id);
      updateSheet(safeSheetIdx, { attachment: doc });
      toast.success(t('oracle.editor.uploadOk'));
    } catch (err) {
      console.error('[OracleTemplateEditor] sheet upload failed:', err);
      toast.error(t('oracle.editor.uploadFail'));
    } finally {
      setUploadingKey(null);
    }
  };

  const handleLoadSheetTextFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !activeSheet) return;
    try {
      const text = await file.text();
      const fmt: SheetContentFormat = file.name.toLowerCase().endsWith('.txt') ? 'plain' : 'markdown';
      updateSheet(safeSheetIdx, { body: text, contentFormat: fmt });
      toast.success(t('oracle.editor.textFileLoaded', { name: file.name }));
    } catch {
      toast.error(t('oracle.editor.uploadFail'));
    }
  };

  const handleLoadBulkFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      setBulkText(text);
      if (file.name.toLowerCase().endsWith('.txt')) setBulkFormat('plain');
      else setBulkFormat('markdown');
    } catch {
      toast.error(t('oracle.editor.uploadFail'));
    }
  };

  const applyBulkImport = (replaceAll: boolean) => {
    const existingIds = replaceAll ? [] : draft.sheets.map((s) => s.id);
    const parsed = parseSheetsFromSingleDocument(bulkText, bulkSplitMode, bulkFormat, existingIds);
    if (parsed.length === 0) return;

    const nextSheets = replaceAll
      ? parsed.slice(0, MAX_SHEETS)
      : [...draft.sheets, ...parsed].slice(0, MAX_SHEETS);

    if (nextSheets.length < 2) {
      toast.error(t('oracle.editor.errSheetCount'));
      return;
    }

    const validIds = new Set(nextSheets.map((s) => s.id));
    const fallbackId = nextSheets[0].id;
    const repairedQuestions = draft.questions.map((q) => ({
      ...q,
      options: q.options.map((o) => ({
        ...o,
        primary: o.primary && validIds.has(o.primary) ? o.primary : fallbackId,
        secondary: o.secondary && validIds.has(o.secondary) ? o.secondary : null,
        weights: o.weights
          ? Object.fromEntries(Object.entries(o.weights).filter(([k]) => validIds.has(k)))
          : null,
      })),
    }));
    const repairedWords = draft.syncWords.map((w) =>
      validIds.has(w.sheetId) ? w : { ...w, sheetId: fallbackId },
    );

    setDraft({
      ...draft,
      sheets: nextSheets,
      questions: repairedQuestions,
      syncWords: repairedWords,
    });
    setActiveSheetIdx(0);
    setBulkOpen(false);
    setBulkText('');
    toast.success(t('oracle.editor.bulkImported', { count: parsed.length }));
  };

  const validateAndSave = async () => {
    if (!draft.name.trim()) {
      toast.error(t('oracle.editor.errName'));
      setTab('general');
      return;
    }
    if (isCoGm && (draft.campaignIds === 'global' || draft.campaignIds.length === 0)) {
      toast.error(t('oracle.editor.errCoGmScope'));
      setTab('general');
      return;
    }
    if (draft.sheets.length < 2 || draft.sheets.length > MAX_SHEETS) {
      toast.error(t('oracle.editor.errSheetCount'));
      setTab('sheets');
      return;
    }
    if (draft.questions.length === 0 && draft.scoringRules.requiredWordCount === 0) {
      toast.error(t('oracle.editor.errNeedQuestionsOrWords'));
      setTab('quiz');
      return;
    }
    if (draft.scoringRules.requiredWordCount > draft.syncWords.length) {
      toast.error(t('oracle.editor.errWordCount'));
      setTab('quiz');
      return;
    }
    for (const q of draft.questions) {
      if (!q.prompt.trim() || q.options.length < 2) {
        toast.error(t('oracle.editor.errQuestion'));
        setTab('quiz');
        return;
      }
      for (const opt of q.options) {
        const hasWeights = opt.weights && Object.values(opt.weights).some((v) => Number(v) !== 0);
        if (!opt.text.trim() || (!opt.primary && !hasWeights)) {
          toast.error(t('oracle.editor.errOption'));
          setTab('quiz');
          return;
        }
      }
    }

    setSaving(true);
    try {
      await onSave(draft);
      onClose();
    } catch (err) {
      console.error('[OracleTemplateEditor] save failed:', err);
      toast.error(t('oracle.toast.saveFail'));
    } finally {
      setSaving(false);
    }
  };

  // Helpers de pergunta e alternativa
  const updateQuestion = (qIdx: number, patch: Partial<OracleQuestion>) => {
    const next = [...draft.questions];
    next[qIdx] = { ...next[qIdx], ...patch };
    setDraft({ ...draft, questions: next });
  };

  const updateOption = (qIdx: number, oIdx: number, patch: Partial<OracleQuestionOption>) => {
    const next = [...draft.questions];
    const opts = [...next[qIdx].options];
    opts[oIdx] = { ...opts[oIdx], ...patch };
    next[qIdx] = { ...next[qIdx], options: opts };
    setDraft({ ...draft, questions: next });
  };

  const toggleAdvancedOptionWeights = (qIdx: number, oIdx: number) => {
    const opt = draft.questions[qIdx].options[oIdx];
    if (opt.weights) {
      const sorted = Object.entries(opt.weights)
        .filter(([, v]) => v > 0)
        .sort((a, b) => b[1] - a[1]);
      updateOption(qIdx, oIdx, {
        weights: null,
        primary: sorted[0]?.[0] || draft.sheets[0]?.id || null,
        secondary: sorted[1]?.[0] || null,
      });
    } else {
      const initial: Record<string, number> = {};
      if (opt.primary) initial[opt.primary] = draft.scoringRules.questionPrimaryPoints;
      if (opt.secondary) initial[opt.secondary] = draft.scoringRules.questionSecondaryPoints;
      updateOption(qIdx, oIdx, { weights: initial });
    }
  };

  const addQuestion = () => {
    const qId = `q_${Date.now().toString(36).slice(-4)}_${draft.questions.length + 1}`;
    const firstId = draft.sheets[0]?.id || 'ficha_1';
    const secondId = draft.sheets[1]?.id || firstId;
    setDraft({
      ...draft,
      questions: [
        ...draft.questions,
        {
          id: qId,
          prompt: '',
          weight: 1,
          options: [
            { id: `${qId}_a`, text: '', primary: firstId, secondary: null, weights: null },
            { id: `${qId}_b`, text: '', primary: secondId, secondary: null, weights: null },
          ],
        },
      ],
    });
  };

  const addSyncWord = () => {
    const id = `w_${Date.now().toString(36).slice(-4)}_${draft.syncWords.length + 1}`;
    const nextWord: OracleSyncWord = {
      id,
      label: '',
      sheetId: draft.sheets[0]?.id || 'ficha_1',
      weight: null,
    };
    setDraft({ ...draft, syncWords: [...draft.syncWords, nextWord] });
  };

  return (
    <OverlayPortal open={open} onClose={saving ? undefined : onClose} withExitAnimation>
      <AnimatePresence>
        {open && (
          <motion.div
            variants={overlayFade}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-surface-scrim"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget && !saving) onClose();
            }}
          >
            <motion.div
              variants={dialogPop}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="w-full max-w-5xl max-h-[92dvh] flex flex-col bg-surface-container-low rounded-panel shadow-panel overflow-hidden"
            >
              {/* Cabeçalho do modal */}
              <header className="px-5 py-4 border-b border-border-subtle flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="min-w-0">
                  <h2 className="font-display font-bold text-base sm:text-lg text-bone uppercase tracking-wide truncate">
                    {draft.name || t('oracle.editor.untitled')}
                  </h2>
                  <p className="text-[11px] font-mono text-ash-400">
                    {draft.sheets.length} {t('oracle.editor.tabSheets').toLowerCase()} ·{' '}
                    {draft.questions.length} {t('oracle.editor.questionsCount')} ·{' '}
                    {draft.syncWords.length} {t('oracle.editor.wordsCount')}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={onClose}
                    className="lmb-btn h-9 px-3.5"
                  >
                    {t('common:cancel')}
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void validateAndSave()}
                    className="lmb-btn lmb-btn-solid h-9 px-4"
                  >
                    {saving ? <RetroSpinner size="sm" /> : t('common:save')}
                  </button>
                </div>
              </header>

              {/* Navegação de abas */}
              <div className="px-5 py-2.5 border-b border-border-subtle flex flex-wrap gap-1.5 shrink-0 bg-surface-container-lowest/40">
                {(
                  [
                    ['general', 'oracle.editor.tabGeneral'],
                    ['intake', 'oracle.editor.tabIntake'],
                    ['sheets', 'oracle.editor.tabSheets'],
                    ['quiz', 'oracle.editor.tabQuiz'],
                  ] as [EditorTab, string][]
                ).map(([id, key]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTab(id)}
                    className={`h-8 px-3.5 rounded-inset text-[11px] font-display font-bold uppercase tracking-[0.12em] transition ${
                      tab === id ? 'bg-accent-10 text-primary' : 'text-ash-400 hover:text-bone'
                    }`}
                  >
                    {t(key)}
                  </button>
                ))}
              </div>

              {/* Corpo rolável */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
                {/* ── ABA 1: GERAL & PONTUAÇÃO ─────────────────────────────── */}
                {tab === 'general' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <label className="block space-y-1.5">
                        <span className="lmb-eyebrow block">{t('oracle.editor.name')}</span>
                        <input
                          type="text"
                          value={draft.name}
                          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                          maxLength={140}
                          className={FIELD}
                        />
                      </label>

                      <label className="block space-y-1.5">
                        <span className="lmb-eyebrow block">{t('oracle.editor.rpgSystem')}</span>
                        <input
                          type="text"
                          value={draft.rpgSystem}
                          onChange={(e) => setDraft({ ...draft, rpgSystem: e.target.value })}
                          maxLength={120}
                          className={FIELD}
                        />
                      </label>

                      <label className="block space-y-1.5 sm:col-span-2">
                        <span className="lmb-eyebrow block">{t('oracle.editor.description')}</span>
                        <textarea
                          rows={2}
                          value={draft.description}
                          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                          maxLength={1200}
                          className={FIELD}
                        />
                      </label>

                      <label className="block space-y-1.5">
                        <span className="lmb-eyebrow block">{t('oracle.editor.codePrefix')}</span>
                        <input
                          type="text"
                          value={draft.codePrefix}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              codePrefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8),
                            })
                          }
                          maxLength={8}
                          className={`${FIELD} font-mono uppercase`}
                        />
                      </label>

                      <div>
                        <CampaignBindingPicker
                          label={t('oracle.editor.campaigns')}
                          value={draft.campaignIds}
                          campaigns={campaigns}
                          onChange={(next) => setDraft({ ...draft, campaignIds: next })}
                        />
                      </div>
                    </div>

                    {/* PDF compartilhado da mesa (documento único) */}
                    <div className="bg-surface-sunken rounded-panel p-4 space-y-3 shadow-pressed">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="text-xs font-display font-bold uppercase tracking-wider text-bone">
                            {t('oracle.editor.sharedDocTitle')}
                          </h3>
                          <p className="text-[11px] text-ash-400">
                            {t('oracle.editor.sharedDocHint')}
                          </p>
                        </div>
                        <input
                          ref={sharedPdfRef}
                          type="file"
                          accept=".pdf,application/pdf,.md,.txt,text/plain,text/markdown"
                          className="hidden"
                          onChange={(e) => void handleUploadSharedDoc(e)}
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={uploadingKey === 'shared'}
                            onClick={() => sharedPdfRef.current?.click()}
                            className="lmb-btn h-8 px-3 text-xs"
                          >
                            {uploadingKey === 'shared' ? (
                              <RetroSpinner size="sm" />
                            ) : (
                              <>
                                <MIcon name="upload_file" className="text-sm" />
                                <span>{t('oracle.editor.uploadDoc')}</span>
                              </>
                            )}
                          </button>
                          {draft.sharedDocument && (
                            <button
                              type="button"
                              onClick={() => setDraft({ ...draft, sharedDocument: null })}
                              className="lmb-btn lmb-btn-ghost h-8 px-2.5 text-xs text-red-400"
                            >
                              {t('oracle.editor.removeDoc')}
                            </button>
                          )}
                        </div>
                      </div>
                      {draft.sharedDocument && (
                        <div className="text-xs font-mono text-phosphor-400 flex items-center gap-2">
                          <MIcon name="description" className="text-sm" />
                          <a
                            href={draft.sharedDocument.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline truncate"
                          >
                            {draft.sharedDocument.fileName}
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Motor de pontuação com 4 casas decimais */}
                    <div className="bg-surface-sunken rounded-panel p-4 space-y-4 shadow-pressed">
                      <div>
                        <h3 className="text-xs font-display font-bold uppercase tracking-wider text-bone">
                          {t('oracle.editor.scoringTitle')}
                        </h3>
                        <p className="text-[11px] text-ash-400 mt-0.5">
                          {t('oracle.editor.scoringHint')}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <label className="block space-y-1">
                          <span className="lmb-eyebrow block">{t('oracle.editor.ptsPrimary')}</span>
                          <input
                            type="number"
                            step="0.0001"
                            min={0}
                            max={100}
                            value={draft.scoringRules.questionPrimaryPoints}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                scoringRules: {
                                  ...draft.scoringRules,
                                  questionPrimaryPoints: toNum(e.target.value, 2),
                                },
                              })
                            }
                            className={`${FIELD} font-mono`}
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="lmb-eyebrow block">{t('oracle.editor.ptsSecondary')}</span>
                          <input
                            type="number"
                            step="0.0001"
                            min={0}
                            max={100}
                            value={draft.scoringRules.questionSecondaryPoints}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                scoringRules: {
                                  ...draft.scoringRules,
                                  questionSecondaryPoints: toNum(e.target.value, 0.75),
                                },
                              })
                            }
                            className={`${FIELD} font-mono`}
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="lmb-eyebrow block">{t('oracle.editor.ptsWord')}</span>
                          <input
                            type="number"
                            step="0.0001"
                            min={0}
                            max={100}
                            value={draft.scoringRules.wordMatchPoints}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                scoringRules: {
                                  ...draft.scoringRules,
                                  wordMatchPoints: toNum(e.target.value, 1),
                                },
                              })
                            }
                            className={`${FIELD} font-mono`}
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="lmb-eyebrow block">{t('oracle.editor.ptsWordPair')}</span>
                          <input
                            type="number"
                            step="0.0001"
                            min={0}
                            max={100}
                            value={draft.scoringRules.wordPairSyncBonus}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                scoringRules: {
                                  ...draft.scoringRules,
                                  wordPairSyncBonus: toNum(e.target.value, 0.5),
                                },
                              })
                            }
                            className={`${FIELD} font-mono`}
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="lmb-eyebrow block">{t('oracle.editor.ptsSpecificity')}</span>
                          <input
                            type="number"
                            step="0.0001"
                            min={0}
                            max={10}
                            value={draft.scoringRules.specificityBonus}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                scoringRules: {
                                  ...draft.scoringRules,
                                  specificityBonus: toNum(e.target.value, 0.15),
                                },
                              })
                            }
                            className={`${FIELD} font-mono`}
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="lmb-eyebrow block">{t('oracle.editor.ptsCoherence')}</span>
                          <input
                            type="number"
                            step="0.0001"
                            min={0}
                            max={20}
                            value={draft.scoringRules.coherenceBonus}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                scoringRules: {
                                  ...draft.scoringRules,
                                  coherenceBonus: toNum(e.target.value, 0.35),
                                },
                              })
                            }
                            className={`${FIELD} font-mono`}
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="lmb-eyebrow block">{t('oracle.editor.reqWords')}</span>
                          <input
                            type="number"
                            min={0}
                            max={draft.syncWords.length}
                            value={draft.scoringRules.requiredWordCount}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                scoringRules: {
                                  ...draft.scoringRules,
                                  requiredWordCount: Math.max(0, Math.floor(toNum(e.target.value, 0))),
                                },
                              })
                            }
                            className={`${FIELD} font-mono`}
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="lmb-eyebrow block">{t('oracle.editor.unexpectedThreshold')}</span>
                          <input
                            type="number"
                            step="0.0001"
                            min={0}
                            max={100}
                            value={draft.scoringRules.unexpectedThreshold}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                scoringRules: {
                                  ...draft.scoringRules,
                                  unexpectedThreshold: toNum(e.target.value, 0),
                                },
                              })
                            }
                            className={`${FIELD} font-mono`}
                          />
                        </label>
                      </div>

                      <label className="flex items-center gap-2.5 text-xs text-ash-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={draft.scoringRules.normalizeScores}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              scoringRules: {
                                ...draft.scoringRules,
                                normalizeScores: e.target.checked,
                              },
                            })
                          }
                          className="accent-accent"
                        />
                        <span>{t('oracle.editor.normalizeScores')}</span>
                      </label>
                    </div>

                    {/* Textos customizáveis das etapas */}
                    <div className="space-y-3">
                      <h3 className="text-xs font-display font-bold uppercase tracking-wider text-bone">
                        {t('oracle.editor.copyTitle')}
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {(
                          [
                            ['intakePhaseTitle', 'oracle.editor.copyIntake'],
                            ['quizPhaseTitle', 'oracle.editor.copyQuiz'],
                            ['wordsPhaseTitle', 'oracle.editor.copyWords'],
                            ['waitPhaseTitle', 'oracle.editor.copyWait'],
                            ['dossierPhaseTitle', 'oracle.editor.copyDossier'],
                            ['unexpectedBadge', 'oracle.editor.copyUnexpected'],
                          ] as const
                        ).map(([fieldKey, labelKey]) => (
                          <label key={fieldKey} className="block space-y-1">
                            <span className="lmb-eyebrow block">{t(labelKey)}</span>
                            <input
                              type="text"
                              value={draft.copy[fieldKey] || ''}
                              onChange={(e) =>
                                setDraft({
                                  ...draft,
                                  copy: { ...draft.copy, [fieldKey]: e.target.value },
                                })
                              }
                              className={FIELD}
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── ABA 2: IDENTIFICAÇÃO (0+ CAMPOS) ─────────────────────── */}
                {tab === 'intake' && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-ash-400">{t('oracle.editor.intakeHint')}</p>
                      <button
                        type="button"
                        onClick={() => {
                          const next: OracleIntakeField = {
                            id: `campo_${draft.intakeFields.length + 1}`,
                            label: `Campo ${draft.intakeFields.length + 1}`,
                            type: 'text',
                            required: false,
                            placeholder: '',
                            maxLength: 200,
                          };
                          setDraft({ ...draft, intakeFields: [...draft.intakeFields, next] });
                        }}
                        className="lmb-btn h-8 px-3 text-xs"
                      >
                        <MIcon name="add" className="text-sm" />
                        <span>{t('oracle.editor.addField')}</span>
                      </button>
                    </div>

                    {draft.intakeFields.length === 0 ? (
                      <div className="bg-surface-sunken rounded-panel p-6 text-center text-xs text-ash-500">
                        {t('oracle.editor.intakeEmpty')}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {draft.intakeFields.map((field, idx) => (
                          <div
                            key={`${field.id}-${idx}`}
                            className="bg-surface-sunken rounded-card p-3.5 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end"
                          >
                            <label className="sm:col-span-3 space-y-1">
                              <span className="lmb-eyebrow block">ID</span>
                              <input
                                type="text"
                                value={field.id}
                                onChange={(e) => {
                                  const next = [...draft.intakeFields];
                                  next[idx] = { ...field, id: slugifyOracleId(e.target.value, field.id) };
                                  setDraft({ ...draft, intakeFields: next });
                                }}
                                className={`${FIELD} font-mono`}
                              />
                            </label>
                            <label className="sm:col-span-3 space-y-1">
                              <span className="lmb-eyebrow block">{t('oracle.editor.fieldLabel')}</span>
                              <input
                                type="text"
                                value={field.label}
                                onChange={(e) => {
                                  const next = [...draft.intakeFields];
                                  next[idx] = { ...field, label: e.target.value };
                                  setDraft({ ...draft, intakeFields: next });
                                }}
                                className={FIELD}
                              />
                            </label>
                            <label className="sm:col-span-2 space-y-1">
                              <span className="lmb-eyebrow block">{t('oracle.editor.fieldType')}</span>
                              <select
                                value={field.type}
                                onChange={(e) => {
                                  const next = [...draft.intakeFields];
                                  next[idx] = { ...field, type: e.target.value as OracleIntakeField['type'] };
                                  setDraft({ ...draft, intakeFields: next });
                                }}
                                className={FIELD}
                              >
                                <option value="text">Texto</option>
                                <option value="textarea">Parágrafo</option>
                                <option value="number">Número</option>
                              </select>
                            </label>
                            <label className="sm:col-span-2 space-y-1">
                              <span className="lmb-eyebrow block">Placeholder</span>
                              <input
                                type="text"
                                value={field.placeholder}
                                onChange={(e) => {
                                  const next = [...draft.intakeFields];
                                  next[idx] = { ...field, placeholder: e.target.value };
                                  setDraft({ ...draft, intakeFields: next });
                                }}
                                className={FIELD}
                              />
                            </label>
                            <div className="sm:col-span-2 flex items-center justify-between gap-2 pb-1">
                              <label className="flex items-center gap-1.5 text-[11px] text-ash-300 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={field.required}
                                  onChange={(e) => {
                                    const next = [...draft.intakeFields];
                                    next[idx] = { ...field, required: e.target.checked };
                                    setDraft({ ...draft, intakeFields: next });
                                  }}
                                  className="accent-accent"
                                />
                                <span>{t('oracle.editor.required')}</span>
                              </label>
                              <button
                                type="button"
                                onClick={() =>
                                  setDraft({
                                    ...draft,
                                    intakeFields: draft.intakeFields.filter((_, i) => i !== idx),
                                  })
                                }
                                className="lmb-btn lmb-btn-ghost lmb-btn-icon h-8 w-8 text-red-400"
                                aria-label={t('oracle.templates.delete')}
                              >
                                <MIcon name="delete" className="text-sm" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── ABA 3: FICHAS HÍBRIDAS (2 A 64) ──────────────────────── */}
                {tab === 'sheets' && (
                  <div className="space-y-5">
                    {/* Importador de documento único (.md / .txt) */}
                    <div className="bg-surface-sunken rounded-panel p-4 space-y-3 shadow-pressed">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="text-xs font-display font-bold uppercase tracking-wider text-bone">
                            {t('oracle.editor.bulkTitle')}
                          </h3>
                          <p className="text-[11px] text-ash-400">{t('oracle.editor.bulkHint')}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setBulkOpen((prev) => !prev)}
                          className="lmb-btn h-8 px-3 text-xs"
                        >
                          <MIcon name={bulkOpen ? 'expand_less' : 'article'} className="text-sm" />
                          <span>{bulkOpen ? t('common:close') : t('oracle.editor.bulkOpen')}</span>
                        </button>
                      </div>

                      {bulkOpen && (
                        <div className="space-y-3 pt-2 border-t border-border-subtle">
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              ref={bulkFileRef}
                              type="file"
                              accept=".md,.txt,text/markdown,text/plain"
                              className="hidden"
                              onChange={(e) => void handleLoadBulkFile(e)}
                            />
                            <button
                              type="button"
                              onClick={() => bulkFileRef.current?.click()}
                              className="lmb-btn h-8 px-3 text-xs"
                            >
                              <MIcon name="upload_file" className="text-sm" />
                              <span>{t('oracle.editor.bulkLoadFile')}</span>
                            </button>

                            <select
                              value={bulkSplitMode}
                              onChange={(e) => setBulkSplitMode(e.target.value as DocumentSplitMode)}
                              className="lmb-field h-8 px-2.5 text-xs text-bone rounded-sm"
                            >
                              <option value="auto">{t('oracle.editor.splitAuto')}</option>
                              <option value="hr">{t('oracle.editor.splitHr')}</option>
                              <option value="heading">{t('oracle.editor.splitHeading')}</option>
                            </select>

                            <select
                              value={bulkFormat}
                              onChange={(e) => setBulkFormat(e.target.value as SheetContentFormat)}
                              className="lmb-field h-8 px-2.5 text-xs text-bone rounded-sm"
                            >
                              <option value="markdown">Markdown (.md)</option>
                              <option value="plain">{t('oracle.editor.formatPlain')}</option>
                            </select>
                          </div>

                          <textarea
                            rows={6}
                            value={bulkText}
                            onChange={(e) => setBulkText(e.target.value)}
                            placeholder={t('oracle.editor.bulkPlaceholder')}
                            className={`${FIELD} font-mono`}
                          />

                          {bulkPreview.length > 0 && (
                            <div className="space-y-2">
                              <div className="text-[11px] font-mono text-phosphor-400">
                                {t('oracle.editor.bulkDetected', { count: bulkPreview.length })}:{' '}
                                {bulkPreview.map((s) => s.name).join(' · ')}
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => applyBulkImport(false)}
                                  className="lmb-btn h-8 px-3 text-xs"
                                >
                                  {t('oracle.editor.bulkAppend')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => applyBulkImport(true)}
                                  className="lmb-btn lmb-btn-primary h-8 px-3 text-xs"
                                >
                                  {t('oracle.editor.bulkReplace')}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Barra de seleção de fichas */}
                    <div className="flex flex-wrap items-center gap-2">
                      {draft.sheets.map((s, idx) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setActiveSheetIdx(idx)}
                          className={`h-8 px-3 rounded-inset text-xs font-display font-bold flex items-center gap-2 transition ${
                            idx === safeSheetIdx
                              ? 'bg-accent-10 text-bone shadow-hairline'
                              : 'bg-surface-sunken text-ash-400 hover:text-bone'
                          }`}
                        >
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: s.themeColor || '#FF8C00' }}
                          />
                          <span className="truncate max-w-36">{s.name || s.id}</span>
                        </button>
                      ))}
                      {draft.sheets.length < MAX_SHEETS && (
                        <button
                          type="button"
                          onClick={addSheet}
                          className="lmb-btn h-8 px-3 text-xs"
                        >
                          <MIcon name="add" className="text-sm" />
                          <span>{t('oracle.editor.addSheet')}</span>
                        </button>
                      )}
                    </div>

                    {/* Editor da ficha selecionada */}
                    {activeSheet && (
                      <div className="bg-surface-sunken rounded-panel p-4 sm:p-5 space-y-5 shadow-pressed">
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border-subtle">
                          <span className="text-xs font-mono text-accent">
                            {t('oracle.editor.editingSheet', { n: safeSheetIdx + 1, total: draft.sheets.length })}
                          </span>
                          {draft.sheets.length > 2 && (
                            <button
                              type="button"
                              onClick={() => removeSheet(safeSheetIdx)}
                              className="lmb-btn lmb-btn-ghost h-8 px-2.5 text-xs text-red-400"
                            >
                              <MIcon name="delete" className="text-sm" />
                              <span>{t('oracle.editor.removeSheet')}</span>
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <label className="space-y-1">
                            <span className="lmb-eyebrow block">{t('oracle.editor.sheetName')}</span>
                            <input
                              type="text"
                              value={activeSheet.name}
                              onChange={(e) => updateSheet(safeSheetIdx, { name: e.target.value })}
                              className={FIELD}
                            />
                          </label>
                          <label className="space-y-1">
                            <span className="lmb-eyebrow block">ID</span>
                            <input
                              type="text"
                              value={activeSheet.id}
                              onChange={(e) => renameSheetId(safeSheetIdx, e.target.value)}
                              className={`${FIELD} font-mono`}
                            />
                          </label>
                          <label className="space-y-1">
                            <span className="lmb-eyebrow block">{t('oracle.editor.sheetColor')}</span>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={activeSheet.themeColor || '#FF8C00'}
                                onChange={(e) => updateSheet(safeSheetIdx, { themeColor: e.target.value })}
                                className="h-8 w-10 rounded-sm bg-transparent cursor-pointer"
                              />
                              <input
                                type="text"
                                value={activeSheet.themeColor || '#FF8C00'}
                                onChange={(e) => updateSheet(safeSheetIdx, { themeColor: e.target.value })}
                                className={`${FIELD} font-mono`}
                              />
                            </div>
                          </label>
                          <label className="space-y-1">
                            <span className="lmb-eyebrow block">{t('oracle.editor.sheetSubtitle')}</span>
                            <input
                              type="text"
                              value={activeSheet.subtitle || ''}
                              onChange={(e) => updateSheet(safeSheetIdx, { subtitle: e.target.value })}
                              className={FIELD}
                            />
                          </label>
                          <label className="space-y-1">
                            <span className="lmb-eyebrow block">{t('oracle.editor.sheetOrigin')}</span>
                            <input
                              type="text"
                              value={activeSheet.origin || ''}
                              onChange={(e) => updateSheet(safeSheetIdx, { origin: e.target.value })}
                              className={FIELD}
                            />
                          </label>
                          <label className="space-y-1">
                            <span className="lmb-eyebrow block">{t('oracle.editor.sheetSummary')}</span>
                            <input
                              type="text"
                              value={activeSheet.summary || ''}
                              onChange={(e) => updateSheet(safeSheetIdx, { summary: e.target.value })}
                              className={FIELD}
                            />
                          </label>
                        </div>

                        {/* Conteúdo livre (Markdown ou Texto simples) */}
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="lmb-eyebrow">{t('oracle.editor.sheetBodyLabel')}</span>
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                ref={sheetTextFileRef}
                                type="file"
                                accept=".md,.txt,text/markdown,text/plain"
                                className="hidden"
                                onChange={(e) => void handleLoadSheetTextFile(e)}
                              />
                              <button
                                type="button"
                                onClick={() => sheetTextFileRef.current?.click()}
                                className="lmb-btn h-7 px-2.5 text-[11px]"
                              >
                                <MIcon name="upload_file" className="text-sm" />
                                <span>{t('oracle.editor.loadTextFile')}</span>
                              </button>
                              <select
                                value={activeSheet.contentFormat || 'markdown'}
                                onChange={(e) =>
                                  updateSheet(safeSheetIdx, {
                                    contentFormat: e.target.value as SheetContentFormat,
                                  })
                                }
                                className="lmb-field h-7 px-2 text-[11px] text-bone rounded-sm"
                              >
                                <option value="markdown">Markdown (.md)</option>
                                <option value="plain">{t('oracle.editor.formatPlain')}</option>
                              </select>
                            </div>
                          </div>
                          <textarea
                            rows={8}
                            value={activeSheet.body || ''}
                            onChange={(e) => updateSheet(safeSheetIdx, { body: e.target.value })}
                            placeholder={t('oracle.editor.sheetBodyPlaceholder')}
                            className={`${FIELD} font-mono`}
                          />
                        </div>

                        {/* Anexo PDF individual ou vínculo ao PDF compartilhado */}
                        <div className="bg-surface-container-low rounded-card p-3.5 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="lmb-eyebrow">{t('oracle.editor.sheetPdfTitle')}</span>
                            <div className="flex items-center gap-2">
                              <input
                                ref={sheetPdfRef}
                                type="file"
                                accept=".pdf,application/pdf,.md,.txt,text/markdown,text/plain"
                                className="hidden"
                                onChange={(e) => void handleUploadSheetDoc(e)}
                              />
                              <button
                                type="button"
                                disabled={uploadingKey === `sheet:${activeSheet.id}`}
                                onClick={() => sheetPdfRef.current?.click()}
                                className="lmb-btn h-8 px-3 text-xs"
                              >
                                {uploadingKey === `sheet:${activeSheet.id}` ? (
                                  <RetroSpinner size="sm" />
                                ) : (
                                  <>
                                    <MIcon name="picture_as_pdf" className="text-sm" />
                                    <span>{t('oracle.editor.uploadDoc')}</span>
                                  </>
                                )}
                              </button>
                              {activeSheet.attachment && (
                                <button
                                  type="button"
                                  onClick={() => updateSheet(safeSheetIdx, { attachment: null })}
                                  className="lmb-btn lmb-btn-ghost h-8 px-2.5 text-xs text-red-400"
                                >
                                  {t('oracle.editor.removeDoc')}
                                </button>
                              )}
                            </div>
                          </div>

                          {activeSheet.attachment && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                              <a
                                href={activeSheet.attachment.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-mono text-phosphor-400 underline truncate"
                              >
                                {activeSheet.attachment.fileName}
                              </a>
                              <input
                                type="text"
                                value={activeSheet.attachment.pageRange || ''}
                                onChange={(e) =>
                                  updateSheet(safeSheetIdx, {
                                    attachment: {
                                      ...activeSheet.attachment!,
                                      pageRange: e.target.value,
                                    },
                                  })
                                }
                                placeholder={t('oracle.editor.pageRangePlaceholder')}
                                className={FIELD}
                              />
                            </div>
                          )}

                          {draft.sharedDocument && !activeSheet.attachment && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center pt-1">
                              <label className="flex items-center gap-2 text-xs text-ash-300 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={Boolean(activeSheet.useSharedDocument)}
                                  onChange={(e) =>
                                    updateSheet(safeSheetIdx, { useSharedDocument: e.target.checked })
                                  }
                                  className="accent-accent"
                                />
                                <span>
                                  {t('oracle.editor.useSharedDoc', { name: draft.sharedDocument.fileName })}
                                </span>
                              </label>
                              {activeSheet.useSharedDocument && (
                                <input
                                  type="text"
                                  value={activeSheet.sharedPageRange || ''}
                                  onChange={(e) =>
                                    updateSheet(safeSheetIdx, { sharedPageRange: e.target.value })
                                  }
                                  placeholder={t('oracle.editor.pageRangePlaceholder')}
                                  className={FIELD}
                                />
                              )}
                            </div>
                          )}
                        </div>

                        {/* Blocos estruturados opcionais (colapsáveis) */}
                        <details className="bg-surface-container-low rounded-card p-3.5 space-y-4">
                          <summary className="text-xs font-display font-bold uppercase tracking-wider text-bone cursor-pointer select-none">
                            {t('oracle.editor.optionalBlocksSummary', {
                              attrs: activeSheet.attributes.length,
                              stats: activeSheet.derivedStats.length,
                              traits: activeSheet.traits.length,
                              abilities: activeSheet.abilities.length,
                              flavor: activeSheet.flavorFields.length,
                            })}
                          </summary>

                          <div className="space-y-5 pt-3 border-t border-border-subtle">
                            {/* Narrativas opcionais */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <label className="space-y-1">
                                <span className="lmb-eyebrow block">{t('oracle.editor.revealNarrative')}</span>
                                <textarea
                                  rows={2}
                                  value={activeSheet.revealNarrative || ''}
                                  onChange={(e) =>
                                    updateSheet(safeSheetIdx, { revealNarrative: e.target.value })
                                  }
                                  className={FIELD}
                                />
                              </label>
                              <label className="space-y-1">
                                <span className="lmb-eyebrow block">{t('oracle.editor.unexpectedNarrative')}</span>
                                <textarea
                                  rows={2}
                                  value={activeSheet.unexpectedNarrative || ''}
                                  onChange={(e) =>
                                    updateSheet(safeSheetIdx, { unexpectedNarrative: e.target.value })
                                  }
                                  className={FIELD}
                                />
                              </label>
                            </div>

                            {/* Atributos */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="lmb-eyebrow">{t('oracle.editor.attributes')}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next: OracleStatEntry = {
                                      id: `attr_${activeSheet.attributes.length + 1}`,
                                      label: '',
                                      value: '',
                                      note: '',
                                    };
                                    updateSheet(safeSheetIdx, {
                                      attributes: [...activeSheet.attributes, next],
                                    });
                                  }}
                                  className="lmb-btn h-7 px-2.5 text-[11px]"
                                >
                                  + {t('oracle.editor.addItem')}
                                </button>
                              </div>
                              {activeSheet.attributes.map((attr, aIdx) => (
                                <div key={aIdx} className="grid grid-cols-12 gap-2">
                                  <input
                                    type="text"
                                    value={attr.label}
                                    onChange={(e) => {
                                      const next = [...activeSheet.attributes];
                                      next[aIdx] = { ...attr, label: e.target.value };
                                      updateSheet(safeSheetIdx, { attributes: next });
                                    }}
                                    placeholder={t('oracle.editor.fieldLabel')}
                                    className={`${FIELD} col-span-4`}
                                  />
                                  <input
                                    type="text"
                                    value={attr.value}
                                    onChange={(e) => {
                                      const next = [...activeSheet.attributes];
                                      next[aIdx] = { ...attr, value: e.target.value };
                                      updateSheet(safeSheetIdx, { attributes: next });
                                    }}
                                    placeholder="Valor"
                                    className={`${FIELD} col-span-3 font-mono`}
                                  />
                                  <input
                                    type="text"
                                    value={attr.note || ''}
                                    onChange={(e) => {
                                      const next = [...activeSheet.attributes];
                                      next[aIdx] = { ...attr, note: e.target.value };
                                      updateSheet(safeSheetIdx, { attributes: next });
                                    }}
                                    placeholder="Obs."
                                    className={`${FIELD} col-span-4`}
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateSheet(safeSheetIdx, {
                                        attributes: activeSheet.attributes.filter((_, i) => i !== aIdx),
                                      })
                                    }
                                    className="lmb-btn lmb-btn-ghost lmb-btn-icon h-8 w-8 text-red-400 col-span-1"
                                  >
                                    <MIcon name="close" className="text-sm" />
                                  </button>
                                </div>
                              ))}
                            </div>

                            {/* Estatísticas Derivadas */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="lmb-eyebrow">{t('oracle.editor.derivedStats')}</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateSheet(safeSheetIdx, {
                                      derivedStats: [
                                        ...activeSheet.derivedStats,
                                        { id: `stat_${activeSheet.derivedStats.length + 1}`, label: '', value: '' },
                                      ],
                                    })
                                  }
                                  className="lmb-btn h-7 px-2.5 text-[11px]"
                                >
                                  + {t('oracle.editor.addItem')}
                                </button>
                              </div>
                              {activeSheet.derivedStats.map((st, sIdx) => (
                                <div key={sIdx} className="grid grid-cols-12 gap-2">
                                  <input
                                    type="text"
                                    value={st.label}
                                    onChange={(e) => {
                                      const next = [...activeSheet.derivedStats];
                                      next[sIdx] = { ...st, label: e.target.value };
                                      updateSheet(safeSheetIdx, { derivedStats: next });
                                    }}
                                    placeholder={t('oracle.editor.fieldLabel')}
                                    className={`${FIELD} col-span-6`}
                                  />
                                  <input
                                    type="text"
                                    value={st.value}
                                    onChange={(e) => {
                                      const next = [...activeSheet.derivedStats];
                                      next[sIdx] = { ...st, value: e.target.value };
                                      updateSheet(safeSheetIdx, { derivedStats: next });
                                    }}
                                    placeholder="Valor"
                                    className={`${FIELD} col-span-5 font-mono`}
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateSheet(safeSheetIdx, {
                                        derivedStats: activeSheet.derivedStats.filter((_, i) => i !== sIdx),
                                      })
                                    }
                                    className="lmb-btn lmb-btn-ghost lmb-btn-icon h-8 w-8 text-red-400 col-span-1"
                                  >
                                    <MIcon name="close" className="text-sm" />
                                  </button>
                                </div>
                              ))}
                            </div>

                            {/* Traços */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="lmb-eyebrow">{t('oracle.editor.traits')}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next: OracleTrait = { name: '', description: '' };
                                    updateSheet(safeSheetIdx, { traits: [...activeSheet.traits, next] });
                                  }}
                                  className="lmb-btn h-7 px-2.5 text-[11px]"
                                >
                                  + {t('oracle.editor.addItem')}
                                </button>
                              </div>
                              {activeSheet.traits.map((tr, tIdx) => (
                                <div key={tIdx} className="grid grid-cols-12 gap-2">
                                  <input
                                    type="text"
                                    value={tr.name}
                                    onChange={(e) => {
                                      const next = [...activeSheet.traits];
                                      next[tIdx] = { ...tr, name: e.target.value };
                                      updateSheet(safeSheetIdx, { traits: next });
                                    }}
                                    placeholder="Nome"
                                    className={`${FIELD} col-span-4`}
                                  />
                                  <input
                                    type="text"
                                    value={tr.description}
                                    onChange={(e) => {
                                      const next = [...activeSheet.traits];
                                      next[tIdx] = { ...tr, description: e.target.value };
                                      updateSheet(safeSheetIdx, { traits: next });
                                    }}
                                    placeholder="Descrição"
                                    className={`${FIELD} col-span-7`}
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateSheet(safeSheetIdx, {
                                        traits: activeSheet.traits.filter((_, i) => i !== tIdx),
                                      })
                                    }
                                    className="lmb-btn lmb-btn-ghost lmb-btn-icon h-8 w-8 text-red-400 col-span-1"
                                  >
                                    <MIcon name="close" className="text-sm" />
                                  </button>
                                </div>
                              ))}
                            </div>

                            {/* Habilidades */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="lmb-eyebrow">{t('oracle.editor.abilities')}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next: OracleAbility = {
                                      id: `ab_${Date.now().toString(36).slice(-4)}`,
                                      name: '',
                                      category: 'Geral',
                                      cost: '',
                                      description: '',
                                    };
                                    updateSheet(safeSheetIdx, {
                                      abilities: [...activeSheet.abilities, next],
                                    });
                                  }}
                                  className="lmb-btn h-7 px-2.5 text-[11px]"
                                >
                                  + {t('oracle.editor.addItem')}
                                </button>
                              </div>
                              {activeSheet.abilities.map((ab, abIdx) => (
                                <div key={ab.id} className="bg-surface-sunken rounded-card p-2.5 space-y-2">
                                  <div className="grid grid-cols-12 gap-2">
                                    <input
                                      type="text"
                                      value={ab.name}
                                      onChange={(e) => {
                                        const next = [...activeSheet.abilities];
                                        next[abIdx] = { ...ab, name: e.target.value };
                                        updateSheet(safeSheetIdx, { abilities: next });
                                      }}
                                      placeholder="Nome"
                                      className={`${FIELD} col-span-5`}
                                    />
                                    <input
                                      type="text"
                                      value={ab.category}
                                      onChange={(e) => {
                                        const next = [...activeSheet.abilities];
                                        next[abIdx] = { ...ab, category: e.target.value };
                                        updateSheet(safeSheetIdx, { abilities: next });
                                      }}
                                      placeholder="Categoria"
                                      className={`${FIELD} col-span-3`}
                                    />
                                    <input
                                      type="text"
                                      value={ab.cost}
                                      onChange={(e) => {
                                        const next = [...activeSheet.abilities];
                                        next[abIdx] = { ...ab, cost: e.target.value };
                                        updateSheet(safeSheetIdx, { abilities: next });
                                      }}
                                      placeholder="Custo"
                                      className={`${FIELD} col-span-3`}
                                    />
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateSheet(safeSheetIdx, {
                                          abilities: activeSheet.abilities.filter((_, i) => i !== abIdx),
                                        })
                                      }
                                      className="lmb-btn lmb-btn-ghost lmb-btn-icon h-8 w-8 text-red-400 col-span-1"
                                    >
                                      <MIcon name="close" className="text-sm" />
                                    </button>
                                  </div>
                                  <textarea
                                    rows={2}
                                    value={ab.description}
                                    onChange={(e) => {
                                      const next = [...activeSheet.abilities];
                                      next[abIdx] = { ...ab, description: e.target.value };
                                      updateSheet(safeSheetIdx, { abilities: next });
                                    }}
                                    placeholder="Descrição"
                                    className={FIELD}
                                  />
                                </div>
                              ))}
                            </div>

                            {/* Campos pós-revelação (100% opcionais — sem codename fixo) */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="lmb-eyebrow">{t('oracle.editor.flavorFields')}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next: OracleFlavorField = {
                                      id: `campo_${activeSheet.flavorFields.length + 1}`,
                                      label: '',
                                      placeholder: '',
                                    };
                                    updateSheet(safeSheetIdx, {
                                      flavorFields: [...activeSheet.flavorFields, next],
                                    });
                                  }}
                                  className="lmb-btn h-7 px-2.5 text-[11px]"
                                >
                                  + {t('oracle.editor.addItem')}
                                </button>
                              </div>
                              {activeSheet.flavorFields.map((ff, fIdx) => (
                                <div key={fIdx} className="grid grid-cols-12 gap-2">
                                  <input
                                    type="text"
                                    value={ff.id}
                                    onChange={(e) => {
                                      const next = [...activeSheet.flavorFields];
                                      next[fIdx] = { ...ff, id: slugifyOracleId(e.target.value, ff.id) };
                                      updateSheet(safeSheetIdx, { flavorFields: next });
                                    }}
                                    placeholder="id"
                                    className={`${FIELD} col-span-3 font-mono`}
                                  />
                                  <input
                                    type="text"
                                    value={ff.label}
                                    onChange={(e) => {
                                      const next = [...activeSheet.flavorFields];
                                      next[fIdx] = { ...ff, label: e.target.value };
                                      updateSheet(safeSheetIdx, { flavorFields: next });
                                    }}
                                    placeholder={t('oracle.editor.fieldLabel')}
                                    className={`${FIELD} col-span-4`}
                                  />
                                  <input
                                    type="text"
                                    value={ff.placeholder}
                                    onChange={(e) => {
                                      const next = [...activeSheet.flavorFields];
                                      next[fIdx] = { ...ff, placeholder: e.target.value };
                                      updateSheet(safeSheetIdx, { flavorFields: next });
                                    }}
                                    placeholder="Placeholder"
                                    className={`${FIELD} col-span-4`}
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateSheet(safeSheetIdx, {
                                        flavorFields: activeSheet.flavorFields.filter((_, i) => i !== fIdx),
                                      })
                                    }
                                    className="lmb-btn lmb-btn-ghost lmb-btn-icon h-8 w-8 text-red-400 col-span-1"
                                  >
                                    <MIcon name="close" className="text-sm" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </details>
                      </div>
                    )}
                  </div>
                )}

                {/* ── ABA 4: PERGUNTAS & PALAVRAS-CHAVE ────────────────────── */}
                {tab === 'quiz' && (
                  <div className="space-y-6">
                    {/* Painel de balanço */}
                    <div className="bg-surface-sunken rounded-card p-3.5 space-y-2 shadow-pressed">
                      <span className="lmb-eyebrow block">{t('oracle.editor.balanceTitle')}</span>
                      <div className="flex flex-wrap gap-2">
                        {draft.sheets.map((s) => {
                          const b = balanceMap.get(s.id) || { qCount: 0, wCount: 0 };
                          return (
                            <span
                              key={s.id}
                              className="px-2.5 py-1 rounded-inset bg-surface-container-low font-mono text-[11px] text-ash-300"
                            >
                              {s.name}: <strong className="text-bone">{b.qCount}P</strong> ·{' '}
                              <strong className="text-accent">{b.wCount}W</strong>
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {/* Perguntas (0+) */}
                    <section className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-xs font-display font-bold uppercase tracking-wider text-bone">
                          {t('oracle.editor.questionsTitle', { count: draft.questions.length })}
                        </h3>
                        <button type="button" onClick={addQuestion} className="lmb-btn h-8 px-3 text-xs">
                          <MIcon name="add" className="text-sm" />
                          <span>{t('oracle.editor.addQuestion')}</span>
                        </button>
                      </div>

                      {draft.questions.map((q, qIdx) => (
                        <div
                          key={q.id}
                          className="bg-surface-sunken rounded-panel p-4 space-y-3 shadow-pressed"
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                            <label className="sm:col-span-8 space-y-1">
                              <span className="lmb-eyebrow block">
                                {t('oracle.editor.questionPrompt', { n: qIdx + 1 })}
                              </span>
                              <input
                                type="text"
                                value={q.prompt}
                                onChange={(e) => updateQuestion(qIdx, { prompt: e.target.value })}
                                className={FIELD}
                              />
                            </label>
                            <label className="sm:col-span-3 space-y-1">
                              <span className="lmb-eyebrow block">{t('oracle.editor.questionWeight')}</span>
                              <input
                                type="number"
                                step="0.0001"
                                min={0.0001}
                                max={100}
                                value={q.weight ?? 1}
                                onChange={(e) =>
                                  updateQuestion(qIdx, { weight: Math.max(0.0001, toNum(e.target.value, 1)) })
                                }
                                className={`${FIELD} font-mono`}
                              />
                            </label>
                            <div className="sm:col-span-1 flex justify-end">
                              <button
                                type="button"
                                onClick={() =>
                                  setDraft({
                                    ...draft,
                                    questions: draft.questions.filter((_, i) => i !== qIdx),
                                  })
                                }
                                className="lmb-btn lmb-btn-ghost lmb-btn-icon h-8 w-8 text-red-400"
                                aria-label={t('oracle.templates.delete')}
                              >
                                <MIcon name="delete" className="text-sm" />
                              </button>
                            </div>
                          </div>

                          <div className="space-y-2 pt-2 border-t border-border-subtle">
                            {q.options.map((opt, oIdx) => {
                              const isAdvanced = Boolean(opt.weights);
                              return (
                                <div
                                  key={opt.id}
                                  className="bg-surface-container-low rounded-card p-2.5 space-y-2"
                                >
                                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                                    <input
                                      type="text"
                                      value={opt.text}
                                      onChange={(e) =>
                                        updateOption(qIdx, oIdx, { text: e.target.value })
                                      }
                                      placeholder={t('oracle.editor.optionPlaceholder', { n: oIdx + 1 })}
                                      className={`${FIELD} sm:col-span-5`}
                                    />
                                    {!isAdvanced ? (
                                      <>
                                        <select
                                          value={opt.primary || ''}
                                          onChange={(e) =>
                                            updateOption(qIdx, oIdx, { primary: e.target.value })
                                          }
                                          className={`${FIELD} sm:col-span-3`}
                                        >
                                          {draft.sheets.map((s) => (
                                            <option key={s.id} value={s.id}>
                                              1ª: {s.name}
                                            </option>
                                          ))}
                                        </select>
                                        <select
                                          value={opt.secondary || ''}
                                          onChange={(e) =>
                                            updateOption(qIdx, oIdx, {
                                              secondary: e.target.value || null,
                                            })
                                          }
                                          className={`${FIELD} sm:col-span-2`}
                                        >
                                          <option value="">2ª: —</option>
                                          {draft.sheets
                                            .filter((s) => s.id !== opt.primary)
                                            .map((s) => (
                                              <option key={s.id} value={s.id}>
                                                2ª: {s.name}
                                              </option>
                                            ))}
                                        </select>
                                      </>
                                    ) : (
                                      <span className="sm:col-span-5 text-[11px] font-mono text-accent">
                                        {t('oracle.editor.customWeightsActive')}
                                      </span>
                                    )}
                                    <div className="sm:col-span-2 flex items-center justify-end gap-1">
                                      <button
                                        type="button"
                                        onClick={() => toggleAdvancedOptionWeights(qIdx, oIdx)}
                                        className={`lmb-btn h-7 px-2 text-[10px] font-mono ${
                                          isAdvanced ? 'lmb-btn-primary' : ''
                                        }`}
                                        title={t('oracle.editor.toggleDecimalWeights')}
                                      >
                                        0.0001
                                      </button>
                                      {q.options.length > 2 && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            updateQuestion(qIdx, {
                                              options: q.options.filter((_, i) => i !== oIdx),
                                            })
                                          }
                                          className="lmb-btn lmb-btn-ghost lmb-btn-icon h-7 w-7 text-red-400"
                                        >
                                          <MIcon name="close" className="text-sm" />
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  {isAdvanced && opt.weights && (
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                                      {draft.sheets.map((s) => (
                                        <label key={s.id} className="space-y-0.5">
                                          <span className="text-[10px] font-mono text-ash-400 truncate block">
                                            {s.name}
                                          </span>
                                          <input
                                            type="number"
                                            step="0.0001"
                                            min={-100}
                                            max={100}
                                            value={opt.weights?.[s.id] ?? 0}
                                            onChange={(e) => {
                                              const nextW = { ...(opt.weights || {}) };
                                              const val = toNum(e.target.value, 0);
                                              if (val === 0) delete nextW[s.id];
                                              else nextW[s.id] = val;
                                              updateOption(qIdx, oIdx, { weights: nextW });
                                            }}
                                            className={`${FIELD} font-mono py-1`}
                                          />
                                        </label>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}

                            <button
                              type="button"
                              onClick={() => {
                                const nextOpt: OracleQuestionOption = {
                                  id: `${q.id}_opt_${Date.now().toString(36).slice(-4)}`,
                                  text: '',
                                  primary: draft.sheets[0]?.id || null,
                                  secondary: null,
                                  weights: null,
                                };
                                updateQuestion(qIdx, { options: [...q.options, nextOpt] });
                              }}
                              className="lmb-btn h-7 px-2.5 text-[11px]"
                            >
                              + {t('oracle.editor.addOption')}
                            </button>
                          </div>
                        </div>
                      ))}
                    </section>

                    {/* Palavras-chave (0+) */}
                    <section className="space-y-3 pt-4 border-t border-border-subtle">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="text-xs font-display font-bold uppercase tracking-wider text-bone">
                            {t('oracle.editor.wordsTitle', { count: draft.syncWords.length })}
                          </h3>
                          <p className="text-[11px] text-ash-400">{t('oracle.editor.wordsHint')}</p>
                        </div>
                        <button type="button" onClick={addSyncWord} className="lmb-btn h-8 px-3 text-xs">
                          <MIcon name="add" className="text-sm" />
                          <span>{t('oracle.editor.addWord')}</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {draft.syncWords.map((w, wIdx) => (
                          <div
                            key={w.id}
                            className="bg-surface-sunken rounded-card p-2.5 grid grid-cols-12 gap-2 items-center"
                          >
                            <input
                              type="text"
                              value={w.label}
                              onChange={(e) => {
                                const next = [...draft.syncWords];
                                next[wIdx] = { ...w, label: e.target.value };
                                setDraft({ ...draft, syncWords: next });
                              }}
                              placeholder={t('oracle.editor.wordPlaceholder')}
                              className={`${FIELD} col-span-5`}
                            />
                            <select
                              value={w.sheetId}
                              onChange={(e) => {
                                const next = [...draft.syncWords];
                                next[wIdx] = { ...w, sheetId: e.target.value };
                                setDraft({ ...draft, syncWords: next });
                              }}
                              className={`${FIELD} col-span-4`}
                            >
                              {draft.sheets.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                            <input
                              type="number"
                              step="0.0001"
                              value={w.weight ?? ''}
                              onChange={(e) => {
                                const next = [...draft.syncWords];
                                next[wIdx] = {
                                  ...w,
                                  weight: e.target.value === '' ? null : toNum(e.target.value, 1),
                                };
                                setDraft({ ...draft, syncWords: next });
                              }}
                              placeholder={String(draft.scoringRules.wordMatchPoints)}
                              title={t('oracle.editor.wordWeightHint')}
                              className={`${FIELD} col-span-2 font-mono`}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const nextWords = draft.syncWords.filter((_, i) => i !== wIdx);
                                setDraft({
                                  ...draft,
                                  syncWords: nextWords,
                                  scoringRules: {
                                    ...draft.scoringRules,
                                    requiredWordCount: Math.min(
                                      draft.scoringRules.requiredWordCount,
                                      nextWords.length,
                                    ),
                                  },
                                });
                              }}
                              className="lmb-btn lmb-btn-ghost lmb-btn-icon h-8 w-8 text-red-400 col-span-1"
                            >
                              <MIcon name="close" className="text-sm" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </OverlayPortal>
  );
}
