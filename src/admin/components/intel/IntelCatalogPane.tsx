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
import type { Campaign } from '../../../data/campaigns';
import type { CampaignScope } from '../../lib/campaignResources';
import CampaignScopeSelect from '../CampaignScopeSelect';
import MIcon from '../MIcon';

interface IntelCatalogPaneProps {
  items: IntelItem[];
  mediaAssetMap: Record<string, MediaAsset>;
  focusedId: string | null;
  search: string;
  filterType: IntelType | 'ALL';
  statusFilter: IntelStatusFilter;
  campaignScope: CampaignScope;
  campaigns: Campaign[];
  /** Sem handler, o filtro de missão fica no cabeçalho de quem hospeda o catálogo. */
  onCampaignScope?: (scope: CampaignScope) => void;
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
  campaignScope,
  campaigns,
  onCampaignScope,
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
      className="flex flex-col min-h-0 h-full bg-surface-container-low overflow-hidden"
    >
      <div className="px-4 py-3 border-b border-primary/10 bg-black/30 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <MIcon name="hub" className="text-primary text-base" />
          <div className="min-w-0">
            <p className="font-display font-bold text-[11px] text-bone uppercase tracking-wider truncate">
              Catálogo Intel
            </p>
            <p className="text-[10px] font-display font-bold text-ash-500 uppercase tracking-[0.1em]">
              {items.length} visíveis
              {isLoading ? ' · sync…' : ''}
            </p>
          </div>
        </div>
      </div>

      <div className="p-3 space-y-2 border-b border-primary/5 shrink-0">
        {onCampaignScope && (
          <CampaignScopeSelect value={campaignScope} onChange={onCampaignScope} campaigns={campaigns} />
        )}
        <div className="flex flex-wrap gap-1">
          {(Object.keys(INTEL_STATUS_FILTER_LABELS) as IntelStatusFilter[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => onStatusFilter(key)}
              className={`px-2.5 py-1 text-[10px] font-display font-bold uppercase tracking-wider transition rounded-sm ${
                statusFilter === key
                  ? 'text-amber-400 bg-amber-500/10'
                  : 'text-ash-500 hover:text-ash-400'
              }`}
            >
              {INTEL_STATUS_FILTER_LABELS[key]}
            </button>
          ))}
        </div>
        <div className="relative group">
          <MIcon name="search" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ash-500 text-sm group-focus-within:text-primary" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="BUSCAR INTEL…"
            className="w-full bg-surface-container-lowest text-[10px] font-display font-bold uppercase tracking-[0.15em] pl-8 pr-3 py-2 text-bone outline-none rounded-sm focus:bg-accent-10"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => onFilterType('ALL')}
            className={`px-2 py-1 text-[10px] font-display font-bold uppercase tracking-wider rounded-sm ${
              filterType === 'ALL'
                ? 'text-primary bg-primary/10'
                : 'text-ash-500'
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
              className={`px-2 py-1 text-[10px] font-display font-bold uppercase tracking-wider rounded-sm flex items-center gap-1 ${
                filterType === t.value
                  ? 'text-primary bg-primary/10'
                  : 'text-ash-500'
              }`}
            >
              <MIcon name={t.icon} className="text-xs" />
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
              className="p-10 text-center text-ash-500 text-[10px] font-display font-bold uppercase tracking-[0.12em]"
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
                      ? 'bg-primary/10 border-l-primary'
                      : 'hover:bg-white/5 border-l-transparent'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <MIcon name={INTEL_TYPE_OPTIONS.find((t) => t.value === item.type)?.icon || 'description'} className=" text-base text-ash-500 group-hover:text-primary mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-display font-bold text-bone uppercase tracking-wide truncate">
                        {item.title}
                      </p>
                      <p className="text-[10px] font-mono text-ash-500 truncate uppercase">
                        {item.id}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        <span
                          className={`text-[10px] font-display font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm ${intelCatalogStatusClass(catalogStatus)}`}
                        >
                          {intelCatalogStatusLabel(catalogStatus)}
                        </span>
                        <span
                          className={`text-[10px] font-display font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm ${accessLevelClass(item.level)}`}
                        >
                          {accessLevelLabel(item.level)}
                        </span>
                        {item.campaignId && campaignScope === 'all' && (
                          <span className="text-[10px] font-display font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm text-primary/80 truncate max-w-[10rem] bg-accent-10">
                            {campaigns.find((c) => c.id === item.campaignId)?.name || item.campaignId}
                          </span>
                        )}
                        {asset?.size ? (
                          <span className="text-[10px] font-mono text-ash-500 uppercase px-1">
                            {formatFileSize(asset.size)}
                          </span>
                        ) : null}
                      </div>
                      {isOrphan && (
                        <button
                          type="button"
                          onClick={() => onEdit(item)}
                          className="mt-1.5 text-[10px] font-display font-bold uppercase tracking-wider text-primary hover:text-primary-container"
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
      className={`p-1.5 text-ash-500 rounded-sm transition text-base ${toneClass}`}
    ><MIcon name={icon} /></button>
  );
}
