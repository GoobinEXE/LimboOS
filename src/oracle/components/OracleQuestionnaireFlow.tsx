import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Check, Lock, ShieldAlert, User, X } from 'lucide-react';
import { dialogPop, overlayFade, panelEnter } from '../../lib/motion';
import type { PublicOracleSlotResponse } from '../../types/oracle';
import RetroSpinner from '../../components/player/RetroSpinner';

export type FlowPhase = 'intake' | 'quiz' | 'words';

interface OracleQuestionnaireFlowProps {
  slot: PublicOracleSlotResponse;
  intakeData: Record<string, string>;
  onIntakeChange: (next: Record<string, string>) => void;
  answers: Record<string, string>;
  onAnswersChange: (next: Record<string, string>) => void;
  selectedWordIds: string[];
  onWordsChange: (next: string[]) => void;
  submitting: boolean;
  submitError: string | null;
  onConfirmSubmit: () => void;
}

export default function OracleQuestionnaireFlow({
  slot,
  intakeData,
  onIntakeChange,
  answers,
  onAnswersChange,
  selectedWordIds,
  onWordsChange,
  submitting,
  submitError,
  onConfirmSubmit,
}: OracleQuestionnaireFlowProps) {
  const { t } = useTranslation('common');
  const intakeFields = slot.intakeFields || [];
  const questions = slot.questions || [];
  const syncWords = slot.syncWords || [];
  const requiredWords = slot.requiredWordCount ?? 0;

  const hasIntakeStep = intakeFields.length > 0;
  const hasQuizStep = questions.length > 0;
  const hasWordsStep = requiredWords > 0 && syncWords.length > 0;

  const steps: FlowPhase[] = useMemo(() => {
    const s: FlowPhase[] = [];
    if (hasIntakeStep) s.push('intake');
    if (hasQuizStep) s.push('quiz');
    if (hasWordsStep) s.push('words');
    return s;
  }, [hasIntakeStep, hasQuizStep, hasWordsStep]);

  const [phase, setPhase] = useState<FlowPhase>(() => steps[0] || 'quiz');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const activePhase = steps.includes(phase) ? phase : steps[0] || 'quiz';
  const stepIdx = steps.indexOf(activePhase);
  const nextPhase = stepIdx >= 0 && stepIdx + 1 < steps.length ? steps[stepIdx + 1] : null;
  const prevPhase = stepIdx > 0 ? steps[stepIdx - 1] : null;

  const intakeValid = useMemo(
    () =>
      !hasIntakeStep
      || intakeFields.every((f) => {
        if (!f.required) return true;
        return Boolean((intakeData[f.id] || '').trim());
      }),
    [hasIntakeStep, intakeFields, intakeData],
  );

  const quizValid = useMemo(
    () => !hasQuizStep || questions.every((q) => Boolean(answers[q.id])),
    [hasQuizStep, questions, answers],
  );

  const wordsValid = !hasWordsStep || selectedWordIds.length === requiredWords;
  const allValid = intakeValid && quizValid && wordsValid;

  const toggleWord = (id: string) => {
    if (selectedWordIds.includes(id)) {
      onWordsChange(selectedWordIds.filter((w) => w !== id));
    } else if (selectedWordIds.length < requiredWords) {
      onWordsChange([...selectedWordIds, id]);
    }
  };

  const wordById = useMemo(
    () => new Map(syncWords.map((w) => [w.id, w])),
    [syncWords],
  );

  const phaseTitle =
    activePhase === 'intake'
      ? slot.copy?.intakePhaseTitle || t('oracle.flow.intakeTitle')
      : activePhase === 'quiz'
        ? slot.copy?.quizPhaseTitle || t('oracle.flow.quizTitle')
        : slot.copy?.wordsPhaseTitle || t('oracle.flow.wordsTitle');

  return (
    <div className="w-full max-w-2xl space-y-6">
      <header className="bg-surface-raised rounded-panel shadow-panel p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="lmb-led text-accent" aria-hidden />
            <span className="font-mono text-xs text-accent tracking-wider">{slot.slotCode}</span>
            {slot.slotLabel && (
              <span className="text-xs text-ash-400">· {slot.slotLabel}</span>
            )}
          </div>
          <span className="text-[11px] font-mono text-ash-400">
            {slot.rpgSystem || slot.sessionTitle}
          </span>
        </div>

        <div>
          <h1 className="text-display text-xl sm:text-2xl text-bone uppercase">
            {slot.sessionTitle}
          </h1>
          <p className="text-xs text-ash-400 mt-1">{phaseTitle}</p>
        </div>

        {steps.length > 1 && (
          <div className="flex gap-1.5" aria-hidden>
            {steps.map((s, idx) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-inset transition-colors ${
                  idx < stepIdx
                    ? 'bg-phosphor-500'
                    : idx === stepIdx
                      ? 'bg-accent'
                      : 'bg-surface-sunken'
                }`}
              />
            ))}
          </div>
        )}
      </header>

      <motion.div
        key={activePhase}
        variants={panelEnter}
        initial="hidden"
        animate="visible"
        className="bg-surface-raised rounded-panel shadow-panel p-5 sm:p-8 space-y-6"
      >
        {activePhase === 'intake' && hasIntakeStep && (
          <div className="space-y-5">
            <div className="flex items-center gap-2 text-xs text-ash-400">
              <User size={14} className="text-accent shrink-0" />
              <span>{t('oracle.flow.intakeGuide')}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {intakeFields.map((field) => {
                const isWide = field.type === 'textarea';
                return (
                  <label
                    key={field.id}
                    className={`block space-y-1.5 ${isWide ? 'sm:col-span-2' : ''}`}
                  >
                    <span className="lmb-eyebrow block">
                      {field.label}
                      {field.required && <span className="text-accent ml-1">*</span>}
                    </span>
                    {field.type === 'textarea' ? (
                      <textarea
                        rows={3}
                        value={intakeData[field.id] || ''}
                        onChange={(e) =>
                          onIntakeChange({ ...intakeData, [field.id]: e.target.value })
                        }
                        maxLength={field.maxLength || 1000}
                        placeholder={field.placeholder}
                        className="lmb-field w-full px-3.5 py-2.5 text-sm resize-y"
                      />
                    ) : (
                      <input
                        type={field.type === 'number' ? 'number' : 'text'}
                        value={intakeData[field.id] || ''}
                        onChange={(e) =>
                          onIntakeChange({ ...intakeData, [field.id]: e.target.value })
                        }
                        maxLength={field.maxLength || 200}
                        placeholder={field.placeholder}
                        className="lmb-field w-full px-3.5 py-2.5 text-sm"
                      />
                    )}
                  </label>
                );
              })}
            </div>

            <div className="pt-2 flex justify-end">
              {nextPhase ? (
                <button
                  type="button"
                  disabled={!intakeValid}
                  onClick={() => setPhase(nextPhase)}
                  className="lmb-btn lmb-btn-solid h-10 px-6 text-xs uppercase tracking-wider"
                >
                  <span>{nextPhase === 'quiz' ? t('oracle.flow.nextQuiz') : t('oracle.flow.nextWords')}</span>
                  <ArrowRight size={15} />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!allValid || submitting}
                  onClick={() => setConfirmOpen(true)}
                  className="lmb-btn lmb-btn-solid h-10 px-6 text-xs uppercase tracking-wider"
                >
                  <Lock size={14} />
                  <span>{t('oracle.flow.finish')}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {activePhase === 'quiz' && hasQuizStep && (
          <div className="space-y-8">
            <p className="text-xs text-ash-400 leading-relaxed">
              {t('oracle.flow.quizGuide')}
            </p>

            <div className="space-y-6">
              {questions.map((q, qIdx) => (
                <fieldset key={q.id} className="space-y-3">
                  <legend className="text-sm font-display font-bold text-bone leading-snug">
                    <span className="font-mono text-accent mr-2">[{qIdx + 1}/{questions.length}]</span>
                    {q.prompt}
                  </legend>
                  <div className="space-y-2 pt-1">
                    {q.options.map((opt) => {
                      const active = answers[q.id] === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => onAnswersChange({ ...answers, [q.id]: opt.id })}
                          className={`w-full text-left px-4 py-3 rounded-control transition-colors flex items-start gap-3 ${
                            active
                              ? 'bg-accent-10 text-bone shadow-hairline'
                              : 'bg-surface-sunken text-ash-300 hover:bg-surface-panel hover:text-bone'
                          }`}
                        >
                          <span
                            className={`mt-0.5 w-4 h-4 rounded-inset shrink-0 flex items-center justify-center ${
                              active ? 'bg-accent text-[#1a0d00]' : 'bg-surface-panel text-transparent'
                            }`}
                          >
                            <Check size={12} strokeWidth={3} />
                          </span>
                          <span className="text-sm leading-relaxed">{opt.text}</span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
            </div>

            {submitError && !nextPhase && (
              <div role="alert" className="bg-error-container/30 rounded-control p-3 text-xs text-error">
                {submitError}
              </div>
            )}

            <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle">
              {prevPhase ? (
                <button
                  type="button"
                  onClick={() => setPhase(prevPhase)}
                  className="lmb-btn h-10 px-4 text-xs uppercase tracking-wider"
                >
                  <ArrowLeft size={14} />
                  <span>{t('back')}</span>
                </button>
              ) : (
                <span />
              )}

              {nextPhase ? (
                <button
                  type="button"
                  disabled={!quizValid}
                  onClick={() => setPhase(nextPhase)}
                  className="lmb-btn lmb-btn-solid h-10 px-6 text-xs uppercase tracking-wider"
                >
                  <span>{t('oracle.flow.nextWords')}</span>
                  <ArrowRight size={15} />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!allValid || submitting}
                  onClick={() => setConfirmOpen(true)}
                  className="lmb-btn lmb-btn-solid h-10 px-6 text-xs uppercase tracking-wider"
                >
                  <Lock size={14} />
                  <span>{t('oracle.flow.finish')}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {activePhase === 'words' && hasWordsStep && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-ash-400 leading-relaxed">
                {t('oracle.flow.wordsGuide', { count: requiredWords })}
              </p>
              <span
                className={`font-mono text-xs px-2.5 py-1 rounded-inset ${
                  wordsValid ? 'bg-phosphor-500/15 text-phosphor-300' : 'bg-surface-sunken text-accent'
                }`}
              >
                {selectedWordIds.length} / {requiredWords}
              </span>
            </div>

            {/* Ordem explícita de seleção (1ª > 2ª > 3ª...) */}
            {selectedWordIds.length > 0 && (
              <div className="bg-surface-sunken rounded-card p-3 shadow-pressed space-y-2">
                <span className="text-[10px] font-display font-bold uppercase tracking-[0.14em] text-ash-400 block">
                  {t('oracle.flow.wordsOrderLabel')}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedWordIds.map((wid, idx) => {
                    const w = wordById.get(wid);
                    if (!w) return null;
                    return (
                      <button
                        key={wid}
                        type="button"
                        onClick={() => toggleWord(wid)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-inset bg-accent-10 text-xs text-bone hover:bg-surface-panel transition-colors"
                      >
                        <span className="font-mono text-[10px] text-accent font-bold">#{idx + 1}</span>
                        <span className="font-display font-bold uppercase tracking-wider text-[11px]">
                          {w.label}
                        </span>
                        <X size={11} className="text-ash-400" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {syncWords.map((word) => {
                const orderIdx = selectedWordIds.indexOf(word.id);
                const selected = orderIdx >= 0;
                const maxed = !selected && selectedWordIds.length >= requiredWords;
                return (
                  <button
                    key={word.id}
                    type="button"
                    aria-pressed={selected}
                    disabled={maxed}
                    onClick={() => toggleWord(word.id)}
                    className={`px-3.5 py-3 rounded-control text-sm font-display font-bold uppercase tracking-wider transition flex items-center justify-between gap-2 ${
                      selected
                        ? 'bg-accent-10 text-primary shadow-hairline'
                        : maxed
                          ? 'bg-surface-sunken text-ash-600 opacity-50 cursor-not-allowed'
                          : 'bg-surface-sunken text-ash-300 hover:bg-surface-panel hover:text-bone'
                    }`}
                  >
                    <span className="truncate">{word.label}</span>
                    {selected && (
                      <span className="font-mono text-[11px] px-1.5 py-0.5 rounded-inset bg-accent text-[#1a0d00] font-bold shrink-0">
                        #{orderIdx + 1}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {submitError && (
              <div role="alert" className="bg-error-container/30 rounded-control p-3 text-xs text-error">
                {submitError}
              </div>
            )}

            <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle">
              {prevPhase ? (
                <button
                  type="button"
                  onClick={() => setPhase(prevPhase)}
                  className="lmb-btn h-10 px-4 text-xs uppercase tracking-wider"
                >
                  <ArrowLeft size={14} />
                  <span>{t('back')}</span>
                </button>
              ) : (
                <span />
              )}

              <button
                type="button"
                disabled={!allValid || submitting}
                onClick={() => setConfirmOpen(true)}
                className="lmb-btn lmb-btn-solid h-10 px-6 text-xs uppercase tracking-wider"
              >
                {submitting ? (
                  <RetroSpinner size="sm" />
                ) : (
                  <>
                    <Lock size={14} />
                    <span>{t('oracle.flow.finish')}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {confirmOpen && (
          <motion.div
            variants={overlayFade}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-scrim"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget && !submitting) setConfirmOpen(false);
            }}
          >
            <motion.div
              role="alertdialog"
              aria-modal="true"
              variants={dialogPop}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="w-full max-w-md bg-surface-container-low rounded-panel shadow-panel p-6 space-y-5"
            >
              <div className="flex items-start gap-3">
                <ShieldAlert size={20} className="text-accent shrink-0 mt-0.5" />
                <div className="space-y-1.5">
                  <h2 className="text-display text-lg text-bone uppercase">
                    {t('oracle.confirm.title')}
                  </h2>
                  <p className="text-xs text-ash-300 leading-relaxed">
                    {t('oracle.confirm.body')}
                  </p>
                </div>
              </div>

              {submitError && (
                <div role="alert" className="bg-error-container/30 rounded-control p-3 text-xs text-error">
                  {submitError}
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setConfirmOpen(false)}
                  className="lmb-btn h-10 px-4 text-xs uppercase tracking-wider"
                >
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => onConfirmSubmit()}
                  className="lmb-btn lmb-btn-solid h-10 px-5 text-xs uppercase tracking-wider"
                >
                  {submitting ? <RetroSpinner size="sm" /> : t('oracle.confirm.action')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
