import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * Renderiza overlays (drawers/modais) diretamente em document.body via portal.
 * Necessário porque ancestrais com backdrop-filter/transform criam um novo
 * containing block, quebrando o `position: fixed` (gaveta ficava presa na
 * área rolável em vez de ancorar na viewport). Também trava o scroll do body,
 * fecha o overlay com a tecla Esc (quando onClose é fornecido) e devolve o
 * foco ao elemento que abriu o overlay quando ele fecha.
 *
 * `withExitAnimation`: mantém o portal montado mesmo fechado, para que um
 * <AnimatePresence> interno consiga tocar a animação de saída. Só use quando
 * o conteúdo já é condicionado a `open` dentro do AnimatePresence.
 */
export default function OverlayPortal({
  open,
  onClose,
  withExitAnimation = false,
  children,
}: {
  open: boolean;
  onClose?: () => void;
  withExitAnimation?: boolean;
  children: React.ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  // Ref evita re-executar o efeito a cada render (chamadores passam arrow inline);
  // senão o cleanup devolveria o foco ao gatilho enquanto o usuário digita no modal.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current?.();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
      // Devolve o foco só se ele está no body ou ainda dentro deste overlay
      // (não rouba o foco de outro overlay que tenha aberto por cima)
      const active = document.activeElement;
      const focusLost = active === null || active === document.body || Boolean(rootRef.current?.contains(active));
      if (trigger?.isConnected && focusLost) {
        trigger.focus({ preventScroll: true });
      }
    };
  }, [open]);

  if (typeof document === 'undefined') return null;
  if (!open && !withExitAnimation) return null;
  return createPortal(
    <div ref={rootRef} className="contents">
      {children}
    </div>,
    document.body
  );
}
