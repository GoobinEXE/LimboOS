import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import MediaLibraryPanel from './MediaLibraryPanel';
import { MediaAsset, MediaType } from '../../types/media';
import Screw from '../../components/player/Screw';
import OverlayPortal from './OverlayPortal';

interface MediaSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (asset: MediaAsset) => void;
  title?: string;
  allowedTypes?: MediaType[];
}

export default function MediaSelectorModal({
  isOpen,
  onClose,
  onSelect,
  title,
  allowedTypes,
}: MediaSelectorModalProps) {
  const { t } = useTranslation('admin');
  const resolvedTitle = title ?? t('media.selectMedia');
  return (
    <OverlayPortal open={isOpen} onClose={onClose} withExitAnimation>
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/90 backdrop-blur-sm"
              onClick={onClose}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className="relative w-full max-w-4xl max-h-[85vh] bg-surface-container-low border border-primary/20 shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="absolute top-2 left-2 opacity-40">
                <Screw size="xs" />
              </div>
              <div className="absolute top-2 right-2 opacity-40">
                <Screw size="xs" />
              </div>

              <div className="px-6 py-4 border-b border-primary/10 flex items-center justify-between bg-black/30 shrink-0">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary text-lg">perm_media</span>
                  <h3 className="font-display font-bold text-bone uppercase tracking-widest text-sm">
                    {resolvedTitle}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center text-industrial-silver/40 hover:text-primary transition-colors"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4 custom-scrollbar min-h-0">
                <MediaLibraryPanel
                  selectionMode
                  compact
                  allowedTypes={allowedTypes}
                  onSelect={(asset) => {
                    onSelect(asset);
                    onClose();
                  }}
                />
              </div>

              <div className="px-6 py-3 border-t border-primary/10 bg-black/20 flex justify-end shrink-0">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 text-[10px] font-display font-bold text-industrial-silver/40 hover:text-bone uppercase tracking-widest transition-colors"
                >
                  {t('accounts.cancel')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </OverlayPortal>
  );
}
