import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Screw from '../../../components/player/Screw';
import OverlayPortal from '../OverlayPortal';
import { ADMIN_SPRING } from '../../lib/motion';

interface IntelExportDrawerProps {
  open: boolean;
  exportJSON: string;
  itemCount: number;
  onClose: () => void;
  onCopied: () => void;
}

export default function IntelExportDrawer({
  open,
  exportJSON,
  itemCount,
  onClose,
  onCopied,
}: IntelExportDrawerProps) {
  return (
    <OverlayPortal open={open} onClose={onClose} withExitAnimation>
      <AnimatePresence>
        {open && (
          <div
            className="fixed inset-0 z-[120] flex justify-end bg-surface-scrim"
            onClick={onClose}
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={ADMIN_SPRING}
              className="bg-surface-container-low border-l border-primary/20 w-full max-w-4xl shadow-2xl flex flex-col h-full relative overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <Screw className="top-4 left-4" />
              <Screw className="top-4 right-4 -rotate-90" />
              <Screw className="bottom-4 left-4 -rotate-90" />
              <Screw className="bottom-4 right-4" />

              <div className="p-8 border-b border-primary/10 flex justify-between items-center bg-black/40 relative z-10">
                <div className="mt-2">
                  <h3 className="font-display font-bold text-2xl text-bone uppercase tracking-tighter">
                    Exportar <span className="text-primary">Registro Mestre</span>
                  </h3>
                  <p className="text-[10px] font-display font-bold text-ash-500 uppercase tracking-widest mt-1">
                    Cópia do IntelRegistry ({itemCount} entradas)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-3 text-ash-500 hover:text-bone material-symbols-outlined rounded-sm"
                >
                  close
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 bg-black/20 custom-scrollbar relative z-10">
                <pre className="bg-black/60 border border-primary/10 p-8 text-[11px] font-mono text-primary/70 whitespace-pre-wrap break-all rounded-sm leading-relaxed">
                  {exportJSON}
                </pre>
              </div>

              <div className="p-8 border-t border-primary/10 flex justify-end gap-6 bg-black/40 relative z-10 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(exportJSON);
                    onCopied();
                  }}
                  className="w-full sm:w-auto bg-primary text-black px-12 py-4 text-[11px] font-display font-bold uppercase tracking-widest hover:bg-primary-container transition rounded-sm active:scale-[0.97] glow-orange shadow-lg flex items-center justify-center gap-3"
                >
                  <span className="material-symbols-outlined text-base">content_copy</span>
                  COPIAR PARA ÁREA DE TRANSFERÊNCIA
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </OverlayPortal>
  );
}
