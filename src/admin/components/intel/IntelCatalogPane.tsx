import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { SPRING_SNAP } from '../../../lib/motion';
import type { IntelItem, IntelType } from '../../../types/intel';
import { MediaAsset } from '../../../types/media';
import {
  INTEL_TYPE_OPTIONS,
  INTEL_STATUS_FILTER_LABELS,
  accessLevelClass,
  accessLevelLabel,
  formatFileSize,
  getIntelCatalogStatus,
  intelCatalogStatusClass,
  intelCatalogStatusLabel,
  type IntelStatusFilter,
} from '../../lib/intelDisplay';

interface IntelCatalogPaneProps {
  items: IntelItem[];
  mediaAssetMap: Record<string, MediaAsset>;
  focusedId: string | null;
  search: string;
  filterType: IntelType | 'ALL';
  statusFilter: IntelStatusFilter;
  isLoading?: boolean;
  onSearch: (v: string) => void;
  onFilterType: (v: IntelType | 'ALL') => void;
  onStatusFilter: (v: IntelStatusFilter) => void;
  onEdit: (item: IntelItem) => void;
  onDelete: (item: IntelItem) => void;
  onDeleteFile: (item: IntelItem) => void;
  onQr: (item: IntelItem) => void;
  onPlayAudio: (item: IntelItem) => void;
}

export default function IntelCatalogPane({
  items,
  mediaAssetMap,
  focusedId,
  search,
  filterType,
  statusFilter,
  isLoading,
  onSearch,
  onFilterType,
  onStatusFilter,
  onEdit,
  onDelete,
  onDeleteFile,
  onQr,
  onPlayAudio,
}: IntelCatalogPaneProps) {
  const { t } = useTranslation('admin');
  const listRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!focusedId) return;
    const el = rowRefs.current[focusedId];
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [focusedId, items]);

  return (
    <motion.aside
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={SPRING_SNAP}
      className="flex flex-col min-h-0 h-full bg-surface-container-low border border-primary/15 overflow-hidden"
    >
      <div className="px-4 py-3 border-b border-primary/10 bg-black/30 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="material-symbols-outlined text-primary text-base">hub</span>
          <div className="min-w-0">
            <p className="font-display font-bold text-[11px] text-bone uppercase tracking-widest truncate">
              Catálogo Intel
            </p>
            <p className="text-[9px] font-display font-bold text-ash-500 uppercase tracking-[0.2em]">
              {items.length} visíveis
              {isLoading ? ' · sync…' : ''}
            </p>
          </div>
        </div>
      </div>

      <div className="p-3 space-y-2 border-b border-primary/5 shrink-0">
        <div className="flex flex-wrap gap-1">
          {(Object.keys(INTEL_STATUS_FILTER_LABELS) as IntelStatusFilter[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => onStatusFilter(key)}
              className={`px-2.5 py-1 text-[9px] font-display font-bold uppercase tracking-widest border transition rounded-sm ${
                statusFilter === key
                  ? 'border-amber-500/50 text-amber-400 bg-amber-500/10'
                  : 'border-border-subtle text-ash-600 hover:text-ash-400'
              }`}
            >
              {INTEL_STATUS_FILTER_LABELS[key]}
            </button>
          ))}
        </div>
        <div className="relative group">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-ash-600 text-sm group-focus-within:text-primary">
            search
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="BUSCAR INTEL…"
            className="w-full bg-surface-container-lowest border border-border-subtle text-[10px] font-display font-bold uppercase tracking-[0.15em] pl-8 pr-3 py-2 text-bone outline-none focus:border-primary/40 rounded-sm"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => onFilterType('ALL')}
            className={`px-2 py-1 text-[9px] font-display font-bold uppercase tracking-widest border rounded-sm ${
              filterType === 'ALL'
                ? 'border-primary text-primary bg-primary/10'
                : 'border-border-subtle text-ash-600'
            }`}
          >
            {t('hardware.filter.all')}
          </button>
          {INTEL_TYPE_OPTIONS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => onFilterType(t.value)}
              title={t.label}
              className={`px-2 py-1 text-[9px] font-display font-bold uppercase tracking-widest border rounded-sm flex items-center gap-1 ${
                filterType === t.value
                  ? 'border-primary text-primary bg-primary/10'
                  : 'border-border-subtle text-ash-600'
              }`}
            >
              <span className="material-symbols-outlined text-xs">{t.icon}</span>
            </button>
          ))}
        </div>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
        <AnimatePresence mode="popLayout">
          {items.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-10 text-center text-ash-600 text-[10px] font-display font-bold uppercase tracking-[0.3em]"
            >
              Nenhum sinal de intel
            </motion.div>
          ) : (
            items.map((item, index) => {
              const asset = mediaAssetMap[item.id];
              const catalogStatus = getIntelCatalogStatus(item, asset);
              const isOrphan = catalogStatus === 'orphan';
              const focused = focusedId === item.id;
              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: Math.min(index * 0.02, 0.2) }}
                  ref={(el) => {
                    rowRefs.current[item.id] = el;
                  }}
                  className={`px-3 py-3 border-b border-border-subtle group transition-colors ${
                    focused
                      ? 'bg-primary/10 border-l-2 border-l-primary'
                      : 'hover:bg-white/5 border-l-2 border-l-transparent'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-base text-ash-600 group-hover:text-primary mt-0.5">
                      {INTEL_TYPE_OPTIONS.find((t) => t.value === item.type)?.icon || 'description'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-display font-bold text-bone uppercase tracking-wide truncate">
                        {item.title}
                      </p>
                      <p className="text-[9px] font-mono text-ash-600 truncate uppercase">
                        {item.id}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        <span
                          className={`text-[7px] font-display font-bold uppercase tracking-widest px-1.5 py-0.5 border rounded-sm ${intelCatalogStatusClass(catalogStatus)}`}
                        >
                          {intelCatalogStatusLabel(catalogStatus)}
                        </span>
                        <span
                          className={`text-[7px] font-display font-bold uppercase tracking-widest px-1.5 py-0.5 border rounded-sm ${accessLevelClass(item.level)}`}
                        >
                          {accessLevelLabel(item.level)}
                        </span>
                        {asset?.size ? (
                          <span className="text-[7px] font-mono text-ash-500 uppercase px-1">
                            {formatFileSize(asset.size)}
                          </span>
                        ) : null}
                      </div>
                      {isOrphan && (
                        <button
                          type="button"
                          onClick={() => onEdit(item)}
                          className="mt-1.5 text-[9px] font-display font-bold uppercase tracking-widest text-primary hover:text-primary-container"
                        >
                          Completar metadados →
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end gap-0.5 mt-2 opacity-70 group-hover:opacity-100">
                    {item.type === 'AUDIO' && item.mediaUrl && (
                      <IconBtn icon="play_arrow" title={t('intel.catalog.preview')} onClick={() => onPlayAudio(item)} />
                    )}
                    <IconBtn icon="qr_code_2" title="QR" onClick={() => onQr(item)} />
                    <IconBtn icon="edit_note" title="Editar" onClick={() => onEdit(item)} />
                    {asset?.storagePath && (
                      <IconBtn icon="folder_delete" title="Remover arquivo" onClick={() => onDeleteFile(item)} tone="amber" />
                    )}
                    <IconBtn icon="delete" title={t('jukebox.removeAction')} onClick={() => onDelete(item)} tone="red" />
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </motion.aside>
  );
}

function IconBtn({
  icon,
  title,
  onClick,
  tone,
}: {
  icon: string;
  title: string;
  onClick: () => void;
  tone?: 'amber' | 'red';
}) {
  const toneClass =
    tone === 'red'
      ? 'hover:text-red-400 hover:bg-red-500/10'
      : tone === 'amber'
        ? 'hover:text-amber-400 hover:bg-amber-500/10'
        : 'hover:text-primary hover:bg-primary/10';
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`p-1.5 text-ash-600 rounded-sm transition material-symbols-outlined text-base ${toneClass}`}
    >
      {icon}
    </button>
  );
}
