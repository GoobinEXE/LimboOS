import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react';

/**
 * Pilha de overlays abertos (F6): modais, gavetas e leitores que se fecham por cima
 * da tela atual. Quem abre por último fica no topo.
 *
 * Consumidores: o botão voltar do Android fecha o topo antes de navegar (P09),
 * atalhos de teclado não agem por baixo de um diálogo (J05) e o leitor de evidência
 * libera o zoom do viewport enquanto está aberto (P07, `allowZoom`).
 */

export interface OverlayEntry {
  /** Identificador para depuração; não precisa ser único. */
  readonly id: string;
  /** Pedido de fechamento. O overlay sai da pilha quando o componente desmonta ou fecha. */
  readonly close: () => void;
  /** Enquanto aberto, libera o zoom por pinça no player (leitor de evidência). */
  readonly allowZoom: boolean;
}

export interface OpenOverlayOptions {
  id?: string;
  close: () => void;
  allowZoom?: boolean;
}

let stack: readonly OverlayEntry[] = [];
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** Empilha um overlay. Devolve a função que o tira da pilha (idempotente). */
export function openOverlay(options: OpenOverlayOptions): () => void {
  const entry: OverlayEntry = {
    id: options.id ?? 'overlay',
    close: options.close,
    allowZoom: options.allowZoom ?? false,
  };
  stack = [...stack, entry];
  emit();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const next = stack.filter((item) => item !== entry);
    if (next.length === stack.length) return;
    stack = next;
    emit();
  };
}

/**
 * Pede ao overlay do topo que feche. Devolve `true` se havia um (o gesto foi consumido,
 * mesmo que o overlay recuse fechar, como um editor com rascunho pedindo confirmação).
 */
export function closeTopOverlay(): boolean {
  const top = stack[stack.length - 1];
  if (!top) return false;
  top.close();
  return true;
}

export function hasOpenOverlay(): boolean {
  return stack.length > 0;
}

export function getTopOverlay(): OverlayEntry | null {
  return stack[stack.length - 1] ?? null;
}

/** Algum overlay aberto pede zoom livre. */
export function overlayAllowsZoom(): boolean {
  return stack.some((item) => item.allowZoom);
}

/** Lista imutável (nova referência a cada mudança), para `useSyncExternalStore`. */
export function getOverlaySnapshot(): readonly OverlayEntry[] {
  return stack;
}

export function subscribeOverlays(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getServerSnapshot = (): readonly OverlayEntry[] => [];

/** Pilha atual; re-renderiza quando algo abre ou fecha. */
export function useOverlayStack(): readonly OverlayEntry[] {
  return useSyncExternalStore(subscribeOverlays, getOverlaySnapshot, getServerSnapshot);
}

/** `true` enquanto houver qualquer overlay aberto. */
export function useHasOpenOverlay(): boolean {
  return useOverlayStack().length > 0;
}

/**
 * Registra um modal ou leitor na pilha enquanto `open` for verdadeiro.
 * `onClose` pode mudar a cada render: a pilha sempre chama a versão mais recente.
 *
 *   useOverlay(isOpen, onClose);                                   // modal comum
 *   useOverlay(true, onClose, { id: 'evidence', allowZoom: true }); // componente que só existe aberto
 */
export function useOverlay(
  open: boolean,
  onClose: () => void,
  options?: { id?: string; allowZoom?: boolean },
): void {
  const closeRef = useRef(onClose);
  useLayoutEffect(() => {
    closeRef.current = onClose;
  });
  const id = options?.id;
  const allowZoom = options?.allowZoom ?? false;

  useEffect(() => {
    if (!open) return;
    return openOverlay({ id, allowZoom, close: () => closeRef.current() });
  }, [open, id, allowZoom]);
}
