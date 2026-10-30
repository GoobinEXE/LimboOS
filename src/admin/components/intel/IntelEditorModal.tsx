import React, { RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { VideoFormat } from '../../../types/intel';
import type { Campaign } from '../../../data/campaigns';
import OverlayPortal from '../OverlayPortal';
import {
  TYPE_OPTIONS,
  LEVEL_OPTIONS,
  CATEGORY_OPTIONS,
  slugifyIntelId,
  type IntelFormData,
} from './intelFormUtils';
import type { IntelItem } from '../../../types/intel';

const SELECT_CLASS =
  'w-full bg-surface-container-lowest border border-white/5 py-4 px-4 text-white font-display font-bold text-sm tracking-widest outline-none uppercase cursor-pointer appearance-none focus:border-primary/40 transition rounded-sm';

const INPUT_CLASS =
  'w-full bg-surface-container-lowest border border-transparent focus:border-primary/30 py-4 px-4 text-white outline-none transition rounded-sm';

interface IntelEditorModalProps {
  open: boolean;
  editingItem: IntelItem | null;
  formData: IntelFormData;
  campaigns: Campaign[];
  youtubeInput: string;
  mediaUploading: boolean;
  mediaFileInputRef: RefObject<HTMLInputElement | null>;
  videoFileInputRef: RefObject<HTMLInputElement | null>;
  onClose: () => void;
  onSave: () => void;
  onUpdateField: (field: string, value: unknown) => void;
  onUpdateMeta: (field: string, value: unknown) => void;
  onYoutubeInput: (v: string) => void;
  onApplyYoutube: () => void;
  onMediaUpload: (files: FileList | null) => void;
  onOpenLibrary: () => void;
}

export default function IntelEditorModal({
  open,
  editingItem,
  formData,
  campaigns,
  youtubeInput,
  mediaUploading,
  mediaFileInputRef,
  videoFileInputRef,
  onClose,
  onSave,
  onUpdateField,
  onUpdateMeta,
  onYoutubeInput,
  onApplyYoutube,
  onMediaUpload,
  onOpenLibrary,
}: IntelEditorModalProps) {
  const { t } = useTranslation('admin');
  const isNew = !editingItem;
  const activeCampaigns = campaigns.filter((c) => c.status !== 'Arquivada');
  const needsMedia = formData.type === 'AUDIO' || formData.type === 'VISUAL' || formData.type === 'VIDEO';

  return (
    <OverlayPortal open={open} onClose={onClose}>
      {open && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
          <div className="bg-surface-container-low border border-primary/30 w-full max-w-2xl rounded-sm shadow-2xl flex flex-col max-h-[90vh] relative">
            <div className="absolute -top-3 left-6 bg-primary px-2 py-0.5 text-[10px] font-display font-bold text-black tracking-widest uppercase">
              {editingItem ? 'ATUALIZAÇÃO-DE-REGISTRO' : 'NOVA-ENTRADA-DE-INTEL'}
            </div>

            <div className="p-8 border-b border-white/5 flex justify-between items-center bg-black/40">
              <div className="mt-2">
                <h3 className="font-display font-bold text-2xl text-white uppercase tracking-tighter">
                  {editingItem ? 'Ajustar' : 'Injetar'}{' '}
                  <span className="text-primary">{t('intel.editor.properties')}</span>
                </h3>
                <p className="text-[10px] font-display font-bold text-industrial-silver/40 uppercase tracking-widest mt-1">
                  {editingItem
                    ? `Ponto de Acesso: ${editingItem.id}`
                    : 'Upload e metadados no mesmo fluxo'}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-3 text-industrial-silver/20 hover:text-white transition rounded-sm material-symbols-outlined"
              >
                close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
              {/* 1. Essenciais */}
              <Field label={t('intel.editor.title')}>
                <input
                  value={formData.title}
                  onChange={(e) => onUpdateField('title', e.target.value)}
                  className={`${INPUT_CLASS} font-display font-bold text-sm tracking-widest uppercase`}
                  placeholder="NOME DA ENTRADA"
                  autoFocus={isNew && !formData.mediaUrl}
                />
              </Field>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Field label={t('intel.editor.campaign')}>
                  <div className="relative">
                    <select
                      value={formData.campaignId || ''}
                      onChange={(e) =>
                        onUpdateField('campaignId', e.target.value || undefined)
                      }
                      className={SELECT_CLASS}
                    >
                      <option value="">— Sem vínculo —</option>
                      {activeCampaigns.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                          {c.status === 'Bloqueada' ? ' (bloqueada)' : ''}
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-industrial-silver/30 text-base">
                      expand_more
                    </span>
                  </div>
                  {formData.campaignId && (
                    <p className="mt-1.5 text-[8px] font-mono text-industrial-silver/30 truncate">
                      id: {formData.campaignId}
                    </p>
                  )}
                </Field>

                <Field label="Identificador ID (Permanente)">
                  <div className="flex gap-2">
                    <input
                      value={formData.id}
                      onChange={(e) => onUpdateField('id', e.target.value)}
                      disabled={!!editingItem}
                      className={`${INPUT_CLASS} font-mono text-sm tracking-widest disabled:opacity-20 uppercase flex-1`}
                      placeholder="intel_nome_do_item"
                    />
                    {isNew && (
                      <button
                        type="button"
                        title={t('intel.editor.generateId')}
                        disabled={!formData.title.trim()}
                        onClick={() => onUpdateField('id', slugifyIntelId(formData.title))}
                        className="shrink-0 px-3 border border-white/10 bg-black/30 text-industrial-silver/50 hover:text-primary hover:border-primary/30 transition rounded-sm disabled:opacity-30"
                      >
                        <span className="material-symbols-outlined text-base">auto_fix</span>
                      </button>
                    )}
                  </div>
                </Field>
              </div>

              {/* 2. Tipo e nível */}
              <div className="space-y-3">
                <label className="text-[9px] font-display font-bold text-industrial-silver/40 uppercase tracking-[0.2em] block">
                  Classificação de Tipo
                </label>
                <div className="flex flex-wrap gap-2">
                  {TYPE_OPTIONS.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => onUpdateField('type', t.value)}
                      className={`flex-1 min-w-[4.5rem] py-3.5 text-[10px] font-display font-bold uppercase tracking-widest border transition flex items-center justify-center gap-2 rounded-sm ${
                        formData.type === t.value
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-white/5 bg-black/20 text-industrial-silver/30 hover:border-white/10'
                      }`}
                    >
                      <span className="material-symbols-outlined text-base">{t.icon}</span>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[9px] font-display font-bold text-industrial-silver/40 uppercase tracking-[0.2em] block">
                  Nível de Autorização
                </label>
                <div className="flex flex-wrap gap-2">
                  {LEVEL_OPTIONS.map((l) => (
                    <button
                      key={l.value}
                      type="button"
                      onClick={() => onUpdateField('level', l.value)}
                      className={`flex-1 py-3.5 text-[10px] font-display font-bold uppercase tracking-widest border transition rounded-sm ${
                        formData.level === l.value
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-white/5 bg-black/20 text-industrial-silver/30 hover:border-white/10'
                      }`}
                    >
                      <span className="block text-[8px] opacity-50 mb-0.5">N{l.value}</span>
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>

              <Field label={t('intel.editor.summary')}>
                <textarea
                  value={formData.description}
                  onChange={(e) => onUpdateField('description', e.target.value)}
                  rows={2}
                  className={`${INPUT_CLASS} font-sans text-sm resize-none`}
                  placeholder={t('intel.editor.summaryPlaceholder')}
                />
              </Field>

              {formData.type === 'TEXT' && (
                <Field label="Corpo do Documento Digital">
                  <textarea
                    value={formData.textContent || ''}
                    onChange={(e) => onUpdateField('textContent', e.target.value)}
                    rows={8}
                    className={`${INPUT_CLASS} text-primary font-mono text-sm resize-none`}
                    placeholder={t('intel.editor.textPlaceholder')}
                  />
                </Field>
              )}

              {/* 3. Mídia — unificado com criação */}
              {needsMedia && (
                <div className="space-y-4 border border-primary/15 bg-primary/5 p-5 rounded-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[9px] font-display font-bold text-primary/80 uppercase tracking-[0.2em]">
                      Mídia —{' '}
                      {formData.type === 'AUDIO'
                        ? t('intel.type.audio')
                        : formData.type === 'VIDEO'
                          ? t('intel.type.video')
                          : 'Imagem'}
                    </p>
                    {formData.mediaUrl && (
                      <span className="text-[8px] font-mono text-phosphor-400/80 uppercase tracking-wider">
                        Arquivo vinculado
                      </span>
                    )}
                  </div>

                  <input
                    ref={mediaFileInputRef}
                    type="file"
                    accept={formData.type === 'AUDIO' ? 'audio/*' : 'image/*'}
                    className="hidden"
                    onChange={(e) => onMediaUpload(e.target.files)}
                  />
                  <input
                    ref={videoFileInputRef}
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(e) => onMediaUpload(e.target.files)}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button
                      type="button"
                      disabled={mediaUploading}
                      onClick={() =>
                        (formData.type === 'VIDEO'
                          ? videoFileInputRef
                          : mediaFileInputRef
                        ).current?.click()
                      }
                      className="py-4 border border-primary/30 bg-primary/10 text-primary hover:bg-primary hover:text-black transition rounded-sm flex items-center justify-center gap-2 font-display font-bold text-[9px] uppercase tracking-widest disabled:opacity-40"
                    >
                      <span className="material-symbols-outlined text-base">upload_file</span>
                      {mediaUploading
                        ? 'Enviando...'
                        : formData.mediaUrl
                          ? 'Trocar Arquivo'
                          : 'Upload de Arquivo'}
                    </button>
                    <button
                      type="button"
                      onClick={onOpenLibrary}
                      className="py-4 border border-white/10 bg-black/30 text-industrial-silver/60 hover:text-white transition rounded-sm flex items-center justify-center gap-2 font-display font-bold text-[9px] uppercase tracking-widest"
                    >
                      <span className="material-symbols-outlined text-base">perm_media</span>
                      {t('media.title')}
                    </button>
                  </div>

                  {formData.type === 'VIDEO' && (
                    <div className="flex gap-2">
                      <input
                        value={youtubeInput}
                        onChange={(e) => onYoutubeInput(e.target.value)}
                        className={`${INPUT_CLASS} flex-1 font-mono text-xs py-3`}
                        placeholder="https://youtube.com/watch?v=..."
                      />
                      <button
                        type="button"
                        onClick={onApplyYoutube}
                        className="px-4 border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition rounded-sm font-display font-bold text-[9px] uppercase tracking-widest shrink-0"
                      >
                        YouTube
                      </button>
                    </div>
                  )}

                  <input
                    value={formData.mediaUrl || ''}
                    onChange={(e) => onUpdateField('mediaUrl', e.target.value)}
                    className={`${INPUT_CLASS} font-mono text-sm`}
                    placeholder="Ou cole a URL do arquivo..."
                  />

                  {formData.mediaUrl && formData.type === 'VIDEO' && (
                    <>
                      <div className="text-[9px] font-mono text-industrial-silver/40 truncate pt-1 border-t border-white/5">
                        {formData.metadata?.videoSource === 'youtube' ? (
                          <span className="text-red-400/80">[YOUTUBE]</span>
                        ) : (
                          <span className="text-primary/80">[UPLOAD]</span>
                        )}{' '}
                        {formData.mediaUrl}
                      </div>
                      {formData.metadata?.videoSource !== 'youtube' && (
                        <div className="aspect-video bg-black border border-white/10 overflow-hidden max-h-48">
                          <video
                            src={formData.mediaUrl}
                            controls
                            className="w-full h-full object-contain"
                            preload="metadata"
                          />
                        </div>
                      )}
                      {formData.metadata?.youtubeId && (
                        <div className="aspect-video bg-black border border-red-500/20 overflow-hidden max-h-48">
                          <iframe
                            src={`https://www.youtube.com/embed/${formData.metadata.youtubeId}`}
                            title="Preview YouTube"
                            className="w-full h-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* 4. Metadados */}
              <div className="border-t border-white/5 pt-8">
                <p className="text-[10px] font-display font-bold text-industrial-silver/60 uppercase tracking-[0.3em] mb-6">
                  Metadados Sistêmicos
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <MetaField label={t('intel.editor.npc')}>
                    <input
                      value={formData.metadata?.npc || ''}
                      onChange={(e) => onUpdateMeta('npc', e.target.value)}
                      className={`${INPUT_CLASS} font-display font-bold text-[10px] py-3 px-3`}
                      placeholder="Ex: Nil, LR..."
                    />
                  </MetaField>
                  <MetaField label="AUTOR / ORIGEM">
                    <input
                      value={formData.metadata?.artist || ''}
                      onChange={(e) => onUpdateMeta('artist', e.target.value)}
                      className={`${INPUT_CLASS} font-display font-bold text-[10px] py-3 px-3`}
                      placeholder="Fonte ou artista"
                    />
                  </MetaField>
                  <MetaField label={t('intel.editor.chapter')}>
                    <input
                      value={formData.metadata?.chapter || ''}
                      onChange={(e) => onUpdateMeta('chapter', e.target.value)}
                      className={`${INPUT_CLASS} font-display font-bold text-[10px] py-3 px-3`}
                      placeholder="Ex: Cap. 03"
                    />
                  </MetaField>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                  {formData.type === 'AUDIO' && (
                    <MetaField label={t('intel.editor.duration')}>
                      <input
                        type="number"
                        value={formData.metadata?.duration || ''}
                        onChange={(e) => onUpdateMeta('duration', parseInt(e.target.value) || 0)}
                        className={`${INPUT_CLASS} font-mono font-bold text-[10px] py-3 px-3`}
                        placeholder="0"
                      />
                    </MetaField>
                  )}
                  {formData.type === 'VIDEO' && (
                    <>
                      <MetaField label={t('intel.editor.format')}>
                        <select
                          value={formData.metadata?.videoFormat || 'VHS'}
                          onChange={(e) =>
                            onUpdateMeta('videoFormat', e.target.value as VideoFormat)
                          }
                          className={`${SELECT_CLASS} text-primary text-[10px] py-3 px-3`}
                        >
                          <option value="VHS">VHS (Fita)</option>
                          <option value="DVD">DVD (Disco)</option>
                        </select>
                      </MetaField>
                      <MetaField label={t('intel.editor.duration')}>
                        <input
                          type="number"
                          value={formData.metadata?.duration || ''}
                          onChange={(e) =>
                            onUpdateMeta('duration', parseInt(e.target.value) || 0)
                          }
                          className={`${INPUT_CLASS} font-mono font-bold text-[10px] py-3 px-3`}
                          placeholder="0"
                        />
                      </MetaField>
                    </>
                  )}
                  {formData.type === 'VISUAL' && (
                    <MetaField label="CATEGORIA VISUAL">
                      <select
                        value={formData.metadata?.visualCategory || ''}
                        onChange={(e) =>
                          onUpdateMeta('visualCategory', e.target.value || undefined)
                        }
                        className={`${SELECT_CLASS} text-primary text-[10px] py-3 px-3`}
                      >
                        <option value="">— SELECIONAR —</option>
                        {CATEGORY_OPTIONS.map((c) => (
                          <option key={c} value={c}>
                            {c.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </MetaField>
                  )}
                  <div className="flex items-center gap-4 pt-4 md:pt-6">
                    <label className="flex items-center gap-4 cursor-pointer group">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={formData.metadata?.isSecret || false}
                          onChange={(e) => onUpdateMeta('isSecret', e.target.checked)}
                          className="peer hidden"
                        />
                        <div className="w-6 h-6 border border-white/10 bg-black/20 rounded-sm peer-checked:bg-primary peer-checked:border-primary transition flex items-center justify-center">
                          <span className="material-symbols-outlined text-black text-sm font-black opacity-0 peer-checked:opacity-100">
                            check
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-display font-bold text-industrial-silver/40 uppercase tracking-widest group-hover:text-primary">
                        Sinal Sigiloso
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8 border-t border-white/5 flex flex-col sm:flex-row justify-end gap-4 bg-black/40">
              <button
                type="button"
                onClick={onClose}
                className="px-8 py-4 text-[10px] font-display font-bold text-industrial-silver/30 hover:text-white uppercase tracking-[0.3em]"
              >
                Abortar Missão
              </button>
              <button
                type="button"
                onClick={onSave}
                className="bg-primary hover:bg-primary-container text-black px-12 py-4 rounded-sm font-display font-bold text-[11px] tracking-widest uppercase transition active:scale-[0.97] glow-orange shadow-lg flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-base">
                  {editingItem ? 'sync' : 'save'}
                </span>
                {editingItem ? 'SINCRONIZAR ALTERAÇÕES' : 'REGISTRAR DADO'}
              </button>
            </div>
          </div>
        </div>
      )}
    </OverlayPortal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="group">
      <label className="text-[9px] font-display font-bold text-industrial-silver/40 uppercase tracking-[0.2em] mb-2 block group-focus-within:text-primary transition-colors">
        {label}
      </label>
      {children}
      <div className="h-0.5 w-0 bg-primary transition-[width,color,background-color,border-color,opacity,transform,box-shadow] duration-300 group-focus-within:w-full" />
    </div>
  );
}

function MetaField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="group">
      <label className="text-[8px] font-display font-bold text-industrial-silver/30 uppercase block mb-2 tracking-widest group-focus-within:text-primary">
        {label}
      </label>
      {children}
      <div className="h-0.5 w-0 bg-primary transition-[width,color,background-color,border-color,opacity,transform,box-shadow] duration-300 group-focus-within:w-full" />
    </div>
  );
}
