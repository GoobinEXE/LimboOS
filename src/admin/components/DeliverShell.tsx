import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import OverlayPortal from './OverlayPortal';
import Screw from '../../components/player/Screw';
import { ADMIN_SPRING, overlayFade } from '../lib/motion';

/**
 * Gaveta lateral das entregas (intel, conquista, SMS, vídeo): cabeçalho com
 * título e alvos, saída animada, Esc e clique fora fecham. `onClose` ausente
 * trava o fechamento (envio em andamento).
 */
export default function DeliverShell({
  title,
  targets = [],
  subtitle,
  onClose,
  children,
}: {
  title: string;
  targets?: { label: string }[];
  /** Substitui a linha "N alvo(s): ..." do cabeçalho. */
  subtitle?: React.ReactNode;
  onClose?: () => void;
  children: React.ReactNode;
}) {
  const [visible, setVisible] = useState(true);

  const requestClose = () => {
    if (!onClose) return;
    setVisible(false);
  };

  return (
    <OverlayPortal open onClose={onClose ? requestClose : undefined}>
      <AnimatePresence onExitComplete={() => { if (!visible) onClose?.(); }}>
        {visible && (
          <motion.div
            key="deliver-backdrop"
            variants={overlayFade}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-[120] flex justify-end bg-surface-scrim"
            onClick={() => requestClose()}
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={ADMIN_SPRING}
              className="bg-surface-container-low border-l border-seam w-full max-w-xl flex flex-col h-full relative overflow-hidden font-display"
              onClick={(e) => e.stopPropagation()}
            >
              <Screw className="top-4 left-4" />
              <Screw className="top-4 right-4 -rotate-90" />
              <div className="noise-overlay" />
              <div className="scanlines" />

              <div className="p-6 border-b-4 border-seam bg-black/40 relative z-10 flex justify-between items-start gap-4">
                <div className="min-w-0">
                  <h3 className="font-black text-xl text-bone uppercase tracking-wider truncate">{title}</h3>
                  <p className="text-[10px] text-ash-500 font-bold uppercase tracking-wider mt-1 truncate">
                    {subtitle ?? `${targets.length} alvo(s): ${targets.map((t) => t.label).join(', ')}`}
                  </p>
                </div>
                {onClose && (
                  <button
                    type="button"
                    onClick={requestClose}
                    className="p-2 text-ash-600 hover:text-bone material-symbols-outlined shrink-0"
                  >
                    close
                  </button>
                )}
              </div>

              <div className="flex-1 flex flex-col min-h-0 relative z-10">{children}</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </OverlayPortal>
  );
}
