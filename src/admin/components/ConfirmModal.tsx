import React, { useState, useCallback, useRef, useEffect, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'motion/react';
import Screw from '../../components/player/Screw';
import { dialogPop, overlayFade } from '../lib/motion';
import OverlayPortal from './OverlayPortal';

type ModalVariant = 'confirm' | 'alert';
interface ModalState {
  open: boolean;
  variant: ModalVariant;
  title: string;
  message: string;
  confirmLabel?: string;
  resolve?: (v: boolean) => void;
}
interface ConfirmModalProps {
  state: ModalState;
  onConfirm: () => void;
  onCancel: () => void;
}

const DANGER_TERMS = ['atenção', 'attention', 'delete', 'apagar', 'zerar', 'reset', 'excluir', 'remover'];

export function ConfirmModal({ state, onConfirm, onCancel }: ConfirmModalProps) {
  const { t } = useTranslation('admin');
  const titleLower = state.title.toLowerCase();
  const isDanger = DANGER_TERMS.some((term) => titleLower.includes(term));
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const messageId = useId();

  // Ação destrutiva nunca recebe o foco inicial: Enter acidental cancela em vez de apagar
  useEffect(() => {
    if (!state.open) return;
    const id = window.setTimeout(() => {
      const target = isDanger && state.variant === 'confirm' ? cancelRef.current : confirmRef.current;
      target?.focus();
    }, 30);
    return () => window.clearTimeout(id);
  }, [state.open, isDanger, state.variant]);

  return (
    <OverlayPortal open={state.open} onClose={onCancel} withExitAnimation>
    <AnimatePresence>
      {state.open && (
        <motion.div
          variants={overlayFade}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed inset-0 z-9999 flex items-center justify-center bg-surface-scrim p-4"
          onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
        >
          <motion.div
            variants={dialogPop}
            initial="hidden"
            animate="visible"
            exit="exit"
            role={state.variant === 'confirm' ? 'alertdialog' : 'dialog'}
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={messageId}
            className="relative w-full max-w-md bg-surface-container-low border border-seam rounded-panel shadow-2xl machined-edge overflow-hidden"
          >
            <Screw size="xs" className="top-2.5 left-2.5" />
            <Screw size="xs" className="top-2.5 right-2.5 -rotate-90" />
            <Screw size="xs" className="bottom-2.5 left-2.5 -rotate-90" />
            <Screw size="xs" className="bottom-2.5 right-2.5" />

            {/* Placa de identificação */}
            <div
              className={`relative flex items-center gap-3 px-7 h-14 border-b ${
                isDanger ? 'border-red-500/20 bg-red-500/[0.04]' : 'border-seam bg-surface-container-lowest'
              }`}
            >
              <span
                className={`material-symbols-outlined text-[18px] ${isDanger ? 'text-red-400' : 'text-accent'}`}
                aria-hidden
              >
                {isDanger ? 'report' : 'info'}
              </span>
              <h2
                id={titleId}
                className={`font-display font-bold text-[11px] uppercase tracking-[0.22em] ${isDanger ? 'text-red-300' : 'text-bone'}`}
              >
                {state.title}
              </h2>
            </div>

            <div className="px-7 py-6">
              <p id={messageId} className="text-ash-300 text-sm leading-relaxed text-pretty">
                {state.message}
              </p>
            </div>

            <div className="flex justify-end gap-2 px-7 pb-6">
              {state.variant === 'confirm' && (
                <button ref={cancelRef} type="button" onClick={onCancel} className="lmb-btn lmb-btn-ghost">
                  {t('confirm.abort')}
                </button>
              )}
              <button
                ref={confirmRef}
                type="button"
                onClick={onConfirm}
                className={`lmb-btn min-w-28 ${isDanger ? 'lmb-btn-danger' : 'lmb-btn-solid'}`}
              >
                {state.confirmLabel ?? (state.variant === 'confirm' ? t('confirm.confirm') : t('confirm.understood'))}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </OverlayPortal>
  );
}

export function useModal() {
  const [modalState, setModalState] = useState<ModalState>({
    open: false,
    variant: 'alert',
    title: '',
    message: '',
  });
  const resolveRef = useRef<((v: boolean) => void) | null>(null);
  const showConfirm = useCallback((title: string, message: string, confirmLabel?: string): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setModalState({ open: true, variant: 'confirm', title, message, confirmLabel });
    });
  }, []);
  const showAlert = useCallback((title: string, message: string): Promise<void> => {
    return new Promise((resolve) => {
      resolveRef.current = (v: boolean) => { resolve(); };
      setModalState({ open: true, variant: 'alert', title, message });
    });
  }, []);
  const handleConfirm = useCallback(() => {
    setModalState((s) => ({ ...s, open: false }));
    resolveRef.current?.(true);
  }, []);
  const handleCancel = useCallback(() => {
    setModalState((s) => ({ ...s, open: false }));
    resolveRef.current?.(false);
  }, []);
  const modal = (
    <ConfirmModal state={modalState} onConfirm={handleConfirm} onCancel={handleCancel} />
  );
  return { showConfirm, showAlert, modal };
}
