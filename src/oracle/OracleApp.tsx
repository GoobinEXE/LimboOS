import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { normalizeOracleCode, oracleService } from '../services/OracleService';
import { isNetworkError } from '../lib/connectivity';
import type { PublicOracleSlotResponse } from '../types/oracle';
import RetroLoading from '../components/player/RetroLoading';
import SlotAccessStep from './components/SlotAccessStep';
import OracleQuestionnaireFlow from './components/OracleQuestionnaireFlow';
import OracleWaitStep from './components/OracleWaitStep';
import OracleDossierStep from './components/OracleDossierStep';

const DRAFT_KEY_PREFIX = 'limboos.oracle.draft.';

interface LocalDraft {
  intakeData: Record<string, string>;
  answers: Record<string, string>;
  selectedWordIds: string[];
}

function readDraft(code: string): LocalDraft {
  try {
    const raw = window.localStorage.getItem(`${DRAFT_KEY_PREFIX}${code}`);
    if (!raw) return { intakeData: {}, answers: {}, selectedWordIds: [] };
    const parsed = JSON.parse(raw) as Partial<LocalDraft>;
    return {
      intakeData: parsed.intakeData || {},
      answers: parsed.answers || {},
      selectedWordIds: Array.isArray(parsed.selectedWordIds) ? parsed.selectedWordIds : [],
    };
  } catch {
    return { intakeData: {}, answers: {}, selectedWordIds: [] };
  }
}

function writeDraft(code: string, draft: LocalDraft): void {
  try {
    window.localStorage.setItem(`${DRAFT_KEY_PREFIX}${code}`, JSON.stringify(draft));
  } catch {
    /* storage indisponível */
  }
}

function clearDraft(code: string): void {
  try {
    window.localStorage.removeItem(`${DRAFT_KEY_PREFIX}${code}`);
  } catch {
    /* noop */
  }
}

export default function OracleApp() {
  const { slotCode: rawParam } = useParams<{ slotCode?: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation('common');

  const paramCode = rawParam ? normalizeOracleCode(rawParam) : '';
  const [slot, setSlot] = useState<PublicOracleSlotResponse | null>(null);
  const [loading, setLoading] = useState(Boolean(paramCode));
  const [refreshing, setRefreshing] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);

  const [intakeData, setIntakeData] = useState<Record<string, string>>({});
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selectedWordIds, setSelectedWordIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const loadSlot = useCallback(
    async (code: string, background = false) => {
      if (!code) {
        setSlot(null);
        setLoading(false);
        return;
      }
      if (!background) setLoading(true);
      else setRefreshing(true);
      setAccessError(null);

      try {
        const res = await oracleService.getSlot(code);
        if (!res.found) {
          setSlot(null);
          setAccessError(t('oracle.access.notFound'));
        } else {
          setSlot(res);
          if (res.status === 'pending') {
            const draft = readDraft(code);
            setIntakeData(draft.intakeData);
            setAnswers(draft.answers);
            setSelectedWordIds(draft.selectedWordIds);
          } else {
            clearDraft(code);
          }
        }
      } catch (err) {
        console.error('[OracleApp] getSlot failed:', err);
        setAccessError(
          isNetworkError(err) ? t('oracle.error.network') : t('oracle.error.unexpected'),
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [t],
  );

  useEffect(() => {
    void loadSlot(paramCode);
  }, [paramCode, loadSlot]);

  useEffect(() => {
    if (slot?.status !== 'pending' || !slot.slotCode) return;
    writeDraft(slot.slotCode, { intakeData, answers, selectedWordIds });
  }, [slot?.status, slot?.slotCode, intakeData, answers, selectedWordIds]);

  const handleOpenCode = (code: string) => {
    navigate(`/oraculo/${encodeURIComponent(code)}`);
  };

  const handleSwitchCode = () => {
    setSlot(null);
    setAccessError(null);
    setSubmitError(null);
    navigate('/oraculo');
  };

  const handleSubmit = async () => {
    if (!slot?.slotCode || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const updated = await oracleService.submitSlot({
        slotCode: slot.slotCode,
        intakeData,
        answers,
        selectedWordIds,
      });
      clearDraft(slot.slotCode);
      setSlot(updated);
    } catch (err: unknown) {
      console.error('[OracleApp] submitSlot failed:', err);
      const code = (err as { code?: string })?.code || '';
      if (code.includes('already-exists')) {
        clearDraft(slot.slotCode);
        await loadSlot(slot.slotCode);
      } else {
        setSubmitError(
          (err as { message?: string })?.message || t('oracle.error.submitFail'),
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !slot) {
    return <RetroLoading fullScreen message={t('oracle.loading')} />;
  }

  return (
    <div className="min-h-dvh w-full bg-surface relative overflow-y-auto flex flex-col items-center justify-start sm:justify-center p-4 sm:p-6 safe-area-pad [--safe-pad:1rem]">
      <div className="noise-overlay" />
      <div className="scanlines" />
      <div className="vignette" />

      <main className="relative z-10 w-full flex flex-col items-center">
        {!slot || !slot.found ? (
          <SlotAccessStep
            initialCode={paramCode}
            loading={loading}
            error={accessError}
            onSubmitCode={handleOpenCode}
          />
        ) : slot.status === 'pending' ? (
          <OracleQuestionnaireFlow
            slot={slot}
            intakeData={intakeData}
            onIntakeChange={setIntakeData}
            answers={answers}
            onAnswersChange={setAnswers}
            selectedWordIds={selectedWordIds}
            onWordsChange={setSelectedWordIds}
            submitting={submitting}
            submitError={submitError}
            onConfirmSubmit={() => void handleSubmit()}
          />
        ) : slot.status === 'submitted' ? (
          <OracleWaitStep
            slot={slot}
            refreshing={refreshing}
            onRefresh={() => {
              if (slot.slotCode) void loadSlot(slot.slotCode, true);
            }}
            onSwitchCode={handleSwitchCode}
          />
        ) : (
          <OracleDossierStep
            slot={slot}
            onFlavorSaved={(customFlavor) =>
              setSlot((prev) => (prev ? { ...prev, customFlavor } : prev))
            }
            onSwitchCode={handleSwitchCode}
          />
        )}
      </main>
    </div>
  );
}
