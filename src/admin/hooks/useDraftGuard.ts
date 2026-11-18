import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useModal } from '../components/ConfirmModal';
import { modalDraftKey, setUnsavedChanges } from '../lib/unsavedChanges';

export interface DraftGuardOptions {
  /** Identifica o modal no registro de rascunhos (ex.: 'intel-editor'). */
  key: string;
  /** O modal está aberto. O snapshot inicial é tirado quando vira true. */
  open: boolean;
  /** Estado do formulário; comparado por JSON com o snapshot inicial. */
  value: unknown;
  /** Alterações fora do formulário (arquivo escolhido, upload em andamento). */
  extraDirty?: boolean;
  /** Enquanto true, requestClose não fecha nada (salvando). */
  saving?: boolean;
}

export interface DraftGuard {
  dirty: boolean;
  /** Fecha direto se limpo; sujo, pede confirmação e só então chama `close`. */
  requestClose: (close: () => void) => Promise<void>;
  /** Chame após salvar com sucesso: limpa o registro e refaz o snapshot. */
  markSaved: () => void;
  /** Refaz o snapshot com o `value` atual (ex.: depois de carregar o item no formulário). */
  rebase: () => void;
  /** Elemento do diálogo de confirmação: renderize-o junto do modal. */
  modal: ReactNode;
}

/**
 * Protege modais de edição contra perda de rascunho. Registra o estado sujo em
 * `unsavedChanges` (beforeunload e saída para o modo jogador) e confirma antes de
 * descartar ao fechar por Esc, fundo, X ou Cancelar.
 */
export function useDraftGuard({ key, open, value, extraDirty = false, saving = false }: DraftGuardOptions): DraftGuard {
  const { t } = useTranslation('admin');
  const { showConfirmWithOption, modal } = useModal();
  const snapshotRef = useRef<string | null>(null);
  const serialized = open ? safeStringify(value) : null;

  if (!open) snapshotRef.current = null;
  else if (snapshotRef.current === null) snapshotRef.current = serialized;

  const dirty = open && (serialized !== snapshotRef.current || extraDirty);

  useEffect(() => {
    const id = modalDraftKey(key);
    setUnsavedChanges(id, dirty);
    return () => setUnsavedChanges(id, false);
  }, [key, dirty]);

  const serializedRef = useRef(serialized);
  serializedRef.current = serialized;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const savingRef = useRef(saving);
  savingRef.current = saving;

  const requestClose = useCallback(
    async (close: () => void) => {
      if (savingRef.current) return;
      if (!dirtyRef.current) {
        close();
        return;
      }
      const { confirmed } = await showConfirmWithOption(
        t('draft.title'),
        t('draft.body'),
        t('draft.discard'),
        { cancelLabel: t('draft.keep'), danger: true },
      );
      if (!confirmed) return;
      setUnsavedChanges(modalDraftKey(key), false);
      close();
    },
    [key, showConfirmWithOption, t],
  );

  const rebase = useCallback(() => {
    snapshotRef.current = serializedRef.current;
  }, []);
  const markSaved = useCallback(() => {
    snapshotRef.current = serializedRef.current;
    setUnsavedChanges(modalDraftKey(key), false);
  }, [key]);

  return { dirty, requestClose, markSaved, rebase, modal };
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return String(Math.random());
  }
}
