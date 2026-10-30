import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';
import RetroSpinner from '../../../components/player/RetroSpinner';
import Screw from '../../../components/player/Screw';
import OverlayPortal from '../OverlayPortal';

interface MediaUploadZoneProps {
  onUpload: (files: FileList) => Promise<void>;
  uploading: boolean;
  uploadProgress: number;
  disabled?: boolean;
  /** Oculta a zona de drag-and-drop (ex.: modo seleção no modal). */
  hideDropZone?: boolean;
  /** Oculta o botão de upload (CTA unificado no header). */
  hideUploadButton?: boolean;
  /** Texto do botão de upload rápido. */
  uploadButtonLabel?: string;
  /** Texto principal da zona de drop. */
  dropHint?: string;
  /** Texto secundário da zona de drop. */
  dropSubhint?: string;
}

export default function MediaUploadZone({
  onUpload,
  uploading,
  uploadProgress,
  disabled = false,
  hideDropZone = false,
  hideUploadButton = false,
  uploadButtonLabel = 'NOVO UPLOAD',
  dropHint = 'ARRASTAR E SOLTAR PARA CRIAR INTEL',
  dropSubhint = 'O editor abre automaticamente com o arquivo vinculado',
}: MediaUploadZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length || disabled || uploading) return;
    await onUpload(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <>
      {uploading && (
        <OverlayPortal open={uploading}>
          <div className="fixed inset-0 bg-surface-scrim z-[200] flex flex-col items-center justify-center gap-6 animate-fade-in" role="status" aria-live="polite">
            <RetroSpinner />
            <div className="space-y-2 text-center">
              <div className="text-primary font-display font-bold uppercase tracking-[0.4em] animate-pulse text-lg">
                Transferindo Dados...
              </div>
              <div className="w-64 h-1 bg-white/5 rounded-full overflow-hidden border border-primary/10">
                <motion.div
                  className="h-full bg-primary glow-orange"
                  initial={{ width: 0 }}
                  animate={{ width: `${uploadProgress}%` }}
                />
              </div>
              <div className="text-[10px] font-display font-bold text-ash-500 tracking-widest uppercase">
                {Math.round(uploadProgress)}% COMPLETO
              </div>
            </div>
          </div>
        </OverlayPortal>
      )}

      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => handleFiles(e.target.files)}
        multiple
        accept="audio/*,image/*,video/*,application/pdf"
        className="hidden"
      />

      {!hideUploadButton && (
        <div className="flex flex-wrap items-center gap-3 justify-end">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || uploading}
            className="flex items-center gap-2 bg-primary hover:bg-primary-container text-black px-5 py-2.5 rounded-sm font-display font-bold text-[10px] tracking-widest transition active:scale-[0.97] glow-orange shadow-lg disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-base">
              {uploading ? 'sync' : 'add_circle'}
            </span>
            {uploadButtonLabel}
          </button>
        </div>
      )}

      {!hideDropZone && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled && !uploading) setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            handleFiles(e.dataTransfer.files);
          }}
          onClick={() => {
            if (!disabled && !uploading) fileInputRef.current?.click();
          }}
          className={`relative border-2 border-dashed rounded-sm p-8 text-center transition group overflow-hidden cursor-pointer ${
            isDragOver
              ? 'border-primary bg-primary/5'
              : 'border-primary/10 bg-black/20 hover:border-primary/20 hover:bg-black/40'
          } ${disabled || uploading ? 'opacity-50 pointer-events-none' : ''}`}
        >
          <div className="absolute top-2 left-2 opacity-20">
            <Screw size="xs" />
          </div>
          <div className="absolute top-2 right-2 opacity-20">
            <Screw size="xs" />
          </div>
          <div className="absolute bottom-2 left-2 opacity-20">
            <Screw size="xs" />
          </div>
          <div className="absolute bottom-2 right-2 opacity-20">
            <Screw size="xs" />
          </div>

          <div className="relative inline-block mb-3">
            <span
              className={`material-symbols-outlined text-4xl transition duration-300 ${
                isDragOver ? 'text-primary scale-110' : 'text-ash-600 group-hover:text-primary/40'
              }`}
            >
              {isDragOver ? 'downloading' : 'cloud_upload'}
            </span>
          </div>
          <p className="text-ash-400 text-[10px] font-display font-bold uppercase tracking-[0.3em] group-hover:text-ash-300">
            {isDragOver ? 'SOLTAR AGORA' : dropHint}
          </p>
          <p className="text-ash-600 text-[9px] font-display uppercase tracking-widest mt-2">
            {dropSubhint}
          </p>
        </div>
      )}
    </>
  );
}
