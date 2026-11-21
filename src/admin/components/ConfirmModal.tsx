import React, { useState, useCallback, useRef, useEffect, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'motion/react';
import Screw from '../../components/player/Screw';
import { dialogPop, overlayFade } from '../lib/motion';
import OverlayPortal from './OverlayPortal';
import MIcon from './MIcon';

type ModalVariant = 'confirm' | 'alert';
interface ModalState {
  open: boolean;
  variant: ModalVariant;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Força (ou desliga) o visual de ação destrutiva; sem isto vale a heurística do título. */
  danger?: boolean;
  /** Caixa de seleção opcional acima dos botões (M14). */
  checkbox?: ConfirmCheckbox;
  checked: boolean;
}
export interface ConfirmCheckbox {
  label: string;
  defaultChecked: boolean;
  /** Aviso curto abaixo da caixa (ex.: arquivo compartilhado com outro item). */
  hint?: string;
}
export interface ConfirmOptions {
  checkbox?: ConfirmCheckbox;
  /** Texto do botão de cancelar (padrão: ABORTAR). */
  cancelLabel?: string;
  danger?: boolean;
}
export interface ConfirmResult {
  confirmed: boolean;
  /** Valor da caixa de seleção na confirmação; false quando não há caixa. */
  checked: boolean;
}
interface ConfirmModalProps {
  state: ModalState;
  onConfirm: () => void;
  onCancel: () => void;
  onToggleChecked?: (checked: boolean) => void;
}

const DANGER_TERMS = ['atenção', 'attention', 'delete', 'apagar', 'zerar', 'reset', 'excluir', 'remover'];

export function ConfirmModal({ state, onConfirm, onCancel, onToggleChecked }: ConfirmModalProps) {
  const { t } = useTranslation('admin');
  const titleLower = state.title.toLowerCase();
  const isDanger = state.danger ?? DANGER_TERMS.some((term) => titleLower.includes(term));
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
            className="relative w-full max-w-md bg-surface-container-low rounded-panel shadow-panel machined-edge overflow-hidden"
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
              <MIcon name={isDanger ? 'report' : 'info'} className={`text-[18px] ${isDanger ? 'text-red-400' : 'text-accent'}`} />
              <h2
                id={titleId}
                className={`font-display font-bold text-[11px] uppercase tracking-[0.22em] ${isDanger ? 'text-red-300' : 'text-bone'}`}
              >
                {state.title}
              </h2>
            </div>

            <div className="px-7 py-6">
              {/* pre-line: mensagens com várias linhas (ex.: o que perde vínculo ao apagar missão) */}
              <p id={messageId} className="text-ash-300 text-sm leading-relaxed text-pretty whitespace-pre-line">
                {state.message}
              </p>
              {state.checkbox && (
                <div className="mt-4">
                  <label className="flex items-start gap-2.5 cursor-pointer text-sm text-bone">
                    <input
                      type="checkbox"
                      checked={state.checked}
                      onChange={(e) => onToggleChecked?.(e.target.checked)}
                      className="mt-0.5 size-4 shrink-0 accent-accent"
                    />
                    <span className="text-pretty">{state.checkbox.label}</span>
                  </label>
                  {state.checkbox.hint && (
                    <p className="mt-1.5 pl-6.5 text-[12px] leading-snug text-ash-500 text-pretty">{state.checkbox.hint}</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 px-7 pb-6">
              {state.variant === 'confirm' && (
                <button ref={cancelRef} type="button" onClick={onCancel} className="lmb-btn lmb-btn-ghost">
                  {state.cancelLabel ?? t('confirm.abort')}
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
    checked: false,
  });
  const resolveRef = useRef<((r: ConfirmResult) => void) | null>(null);
  const checkedRef = useRef(false);

  /** Confirmação com caixa de seleção opcional; resolve `{ confirmed, checked }`. */
  const showConfirmWithOption = useCallback(
    (title: string, message: string, confirmLabel?: string, options?: ConfirmOptions): Promise<ConfirmResult> => {
      return new Promise((resolve) => {
        resolveRef.current = resolve;
        const checked = options?.checkbox?.defaultChecked ?? false;
        checkedRef.current = checked;
        setModalState({
          open: true,
          variant: 'confirm',
          title,
          message,
          confirmLabel,
          cancelLabel: options?.cancelLabel,
          danger: options?.danger,
          checkbox: options?.checkbox,
          checked,
        });
      });
    },
    [],
  );
  const showConfirm = useCallback(
    (title: string, message: string, confirmLabel?: string): Promise<boolean> =>
      showConfirmWithOption(title, message, confirmLabel).then((r) => r.confirmed),
    [showConfirmWithOption],
  );
  const showAlert = useCallback((title: string, message: string): Promise<void> => {
    return new Promise((resolve) => {
      resolveRef.current = () => { resolve(); };
      checkedRef.current = false;
      setModalState({ open: true, variant: 'alert', title, message, checked: false });
    });
  }, []);
  const handleConfirm = useCallback(() => {
    setModalState((s) => ({ ...s, open: false }));
    resolveRef.current?.({ confirmed: true, checked: checkedRef.current });
  }, []);
  const handleCancel = useCallback(() => {
    setModalState((s) => ({ ...s, open: false }));
    resolveRef.current?.({ confirmed: false, checked: false });
  }, []);
  const handleToggleChecked = useCallback((checked: boolean) => {
    checkedRef.current = checked;
    setModalState((s) => ({ ...s, checked }));
  }, []);
  const modal = (
    <ConfirmModal
      state={modalState}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
      onToggleChecked={handleToggleChecked}
    />
  );
  return { showConfirm, showConfirmWithOption, showAlert, modal };
}
