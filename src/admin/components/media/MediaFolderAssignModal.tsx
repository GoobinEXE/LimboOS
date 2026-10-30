import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { MediaFolder } from '../../../types/media';
import OverlayPortal from '../OverlayPortal';
import Screw from '../../../components/player/Screw';

interface MediaFolderAssignModalProps {
  open: boolean;
  folders: MediaFolder[];
  selectedIds: string[];
  assetTitle: string;
  onClose: () => void;
  onSave: (folderIds: string[]) => Promise<void>;
}

export default function MediaFolderAssignModal({
  open,
  folders,
  selectedIds,
  assetTitle,
  onClose,
  onSave,
}: MediaFolderAssignModalProps) {
  const { t } = useTranslation('admin');
  const [draft, setDraft] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const wasOpenRef = useRef(false);

  // Só hidrata o draft ao abrir — não em cada re-render do parent (snapshot Firestore).
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setDraft([...selectedIds]);
    }
    wasOpenRef.current = open;
  }, [open, selectedIds]);

  const toggle = (id: string) => {
    setDraft((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <OverlayPortal open={open} onClose={onClose} withExitAnimation>
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-160 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/90 backdrop-blur-sm"
              onClick={onClose}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="relative w-full max-w-md bg-surface-container-low border border-primary/20 shadow-2xl overflow-hidden"
            >
              <div className="absolute top-2 left-2"><Screw size="xs" /></div>
              <div className="absolute top-2 right-2"><Screw size="xs" /></div>

              <div className="px-6 py-4 border-b border-primary/10 bg-black/20">
                <p className="text-[9px] font-display font-bold text-industrial-silver/40 uppercase tracking-[0.25em]">
                  Atribuir pastas
                </p>
                <h3 className="font-display font-bold text-white uppercase tracking-widest text-sm truncate mt-1">
                  {assetTitle}
                </h3>
              </div>

              <div className="max-h-72 overflow-y-auto custom-scrollbar p-2">
                {folders.length === 0 ? (
                  <p className="px-4 py-8 text-center text-[10px] font-display font-bold text-industrial-silver/30 uppercase tracking-widest">
                    Nenhuma pasta disponível
                  </p>
                ) : (
                  folders.map((folder) => {
                    const checked = draft.includes(folder.id);
                    return (
                      <button
                        key={folder.id}
                        type="button"
                        onClick={() => toggle(folder.id)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                          checked
                            ? 'bg-primary/10 text-primary'
                            : 'text-industrial-silver/60 hover:bg-primary/5 hover:text-primary'
                        }`}
                      >
                        <span className="material-symbols-outlined text-lg">
                          {checked ? 'check_box' : 'check_box_outline_blank'}
                        </span>
                        <span className="material-symbols-outlined text-base opacity-50">
                          {folder.campaignId ? 'flag' : 'folder'}
                        </span>
                        <span className="flex-1 text-[10px] font-display font-bold uppercase tracking-widest truncate">
                          {folder.name}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>

              <div className="px-6 py-4 border-t border-primary/10 bg-black/20 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-[10px] font-display font-bold text-industrial-silver/40 hover:text-white uppercase tracking-widest"
                >
                  {t('accounts.cancel')}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleSave()}
                  className="px-5 py-2 bg-primary text-black text-[10px] font-display font-bold uppercase tracking-widest hover:bg-primary-container disabled:opacity-50"
                >
                  {saving ? 'Salvando…' : 'Salvar'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </OverlayPortal>
  );
}
