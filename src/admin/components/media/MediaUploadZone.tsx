import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import Screw from '../../../components/player/Screw';
import MIcon from '../MIcon';

export interface UploadJob {
  id: string;
  file: File;
  status: 'queued' | 'uploading' | 'done' | 'error';
  progress: number;
  error?: string;
  /** Falhas de validação (tipo, tamanho) não têm "tentar de novo". */
  retryable?: boolean;
  folderIds?: string[];
  /** Lote de origem: o editor de intel abre só para o primeiro sucesso do lote. */
  batchId: string;
  batchSize: number;
}

interface MediaUploadZoneProps {
  /** Fila de envio, um item por arquivo. */
  jobs?: UploadJob[];
  onRetry?: (id: string) => void;
  onClearDone?: () => void;
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
  jobs = [],
  onRetry,
  onClearDone,
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
  const { t } = useTranslation('admin');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length || disabled) return;
    await onUpload(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <>
      {jobs.length > 0 && (
        <div className="rounded-panel bg-surface-container-low shadow-hairline" role="status" aria-live="polite">
          <div className="flex items-center justify-between gap-2 px-3 py-2">
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-primary">
              {t('media.queue.title', { defaultValue: 'Fila de envio' })}
            </span>
            {jobs.some((j) => j.status === 'done') && (
              <button type="button" onClick={onClearDone} className="lmb-btn lmb-btn-ghost">
                {t('media.queue.clearDone', { defaultValue: 'Limpar concluídos' })}
              </button>
            )}
          </div>
          <ul className="max-h-56 overflow-y-auto custom-scrollbar">
            {jobs.map((job) => (
              <li key={job.id} className="px-3 py-2 space-y-1">
                <div className="flex items-center gap-2 min-w-0">
                  <MIcon
                    name={job.status === 'done' ? 'check_circle' : job.status === 'error' ? 'error' : job.status === 'uploading' ? 'sync' : 'schedule'}
                    className={`text-base shrink-0 ${job.status === 'error' ? 'text-red-400' : job.status === 'done' ? 'text-phosphor-400' : 'text-primary'}`}
                  />
                  <span className="text-[11px] font-display font-bold text-bone truncate flex-1">{job.file.name}</span>
                  {job.status === 'done' && (
                    <span className="text-[10px] font-mono uppercase text-phosphor-400">
                      {t('media.queue.done', { defaultValue: 'Enviado' })}
                    </span>
                  )}
                  {job.status === 'error' && job.retryable && (
                    <button type="button" onClick={() => onRetry?.(job.id)} className="lmb-btn lmb-btn-ghost">
                      {t('media.queue.retry', { defaultValue: 'Tentar de novo' })}
                    </button>
                  )}
                </div>
                {job.status === 'error' ? (
                  <p className="text-[10px] text-red-400">{job.error}</p>
                ) : (
                  <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-primary"
                      initial={false}
                      animate={{ width: `${job.status === 'done' ? 100 : job.progress}%` }}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
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
            disabled={disabled}
            className="flex items-center gap-2 bg-primary hover:bg-primary-container text-black px-5 py-2.5 rounded-sm font-display font-bold text-[10px] tracking-wider transition active:translate-y-px glow-orange shadow-lg disabled:opacity-40"
          >
            <MIcon name={uploading ? 'sync' : 'add_circle'} className="text-base" />
            {uploadButtonLabel}
          </button>
        </div>
      )}

      {!hideDropZone && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            handleFiles(e.dataTransfer.files);
          }}
          onClick={() => {
            if (!disabled) fileInputRef.current?.click();
          }}
          className={`relative rounded-sm p-8 text-center transition group overflow-hidden cursor-pointer ${
            isDragOver
              ? 'bg-primary/5'
              : 'bg-black/20 hover:bg-black/40'
          } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
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
            <MIcon name={isDragOver ? 'downloading' : 'cloud_upload'} className={`text-4xl transition duration-300 ${ isDragOver ? 'text-primary scale-110' : 'text-ash-500 group-hover:text-primary/40' }`} />
          </div>
          <p className="text-ash-400 text-[10px] font-display font-bold uppercase tracking-[0.12em] group-hover:text-ash-300">
            {isDragOver ? 'SOLTAR AGORA' : dropHint}
          </p>
          <p className="text-ash-500 text-[10px] font-display uppercase tracking-wider mt-2">
            {dropSubhint}
          </p>
        </div>
      )}
    </>
  );
}
