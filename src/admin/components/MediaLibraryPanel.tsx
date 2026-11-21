import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useIntlLocale } from '../../i18n/dateLocale';
import { motion, AnimatePresence } from 'motion/react';
import { SPRING_SNAP } from '../../lib/motion';
import { collection, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { mediaService } from '../../services/MediaService';
import { mediaFolderService } from '../../services/MediaFolderService';
import { MediaAsset, MediaFolder, MediaType } from '../../types/media';
import type { IntelItem } from '../../types/intel';
import { Campaign } from '../../data/campaigns';
import { useAdminCampaigns } from '../hooks/useAdminCampaigns';
import type { CampaignScopeRequest } from '../lib/adminNavigation';
import type { CampaignScope } from '../lib/campaignResources';
import { useModal } from './ConfirmModal';
import {
  formatFileSize,
  getIntelCatalogStatus,
  intelCatalogStatusClass,
  intelCatalogStatusLabel,
  accessLevelClass,
  accessLevelLabel,
} from '../lib/intelDisplay';
import MediaUploadZone, { type UploadJob } from './media/MediaUploadZone';
import { MAX_UPLOAD_BYTES, validateUploadFile } from '../../services/MediaService';
import MediaFolderSidebar, { FolderFilter } from './media/MediaFolderSidebar';
import MediaFolderAssignModal from './media/MediaFolderAssignModal';
import IntelCatalogPane from './intel/IntelCatalogPane';
import IntelEditorHost from './intel/IntelEditorHost';
import IntelQrModal from './intel/IntelQrModal';
import IntelExportDrawer from './intel/IntelExportDrawer';
import { useIntelCatalog } from '../hooks/useIntelCatalog';
import { useListControls } from '../hooks/useListControls';
import { useSelection } from '../hooks/useSelection';
import { useToast } from './ToastProvider';
import SortSelect from './SortSelect';
import BulkActionBar from './BulkActionBar';
import { campaignService } from '../../services/CampaignService';
import MIcon from './MIcon';

interface MediaLibraryPanelProps {
  onSelect?: (asset: MediaAsset) => void;
  selectionMode?: boolean;
  allowedTypes?: MediaType[];
  /** Compact chrome for modal selector. */
  compact?: boolean;
  /** "Ver no catálogo" vindo da missão: limpa busca e filtros locais do catálogo de intel. */
  scopeRequest?: CampaignScopeRequest | null;
  onScopeConsumed?: () => void;
  /** Dentro de Conteúdo: o título fica no cabeçalho do destino, só a contagem aparece aqui. */
  embedded?: boolean;
  /** Filtro de missão do catálogo de intel (vem do `?mission=` de Conteúdo). */
  campaignScope?: CampaignScope;
}

type MediaSortKey = 'recent' | 'title' | 'type';

const assetTitle = (a: MediaAsset) => a.metadata?.title || a.filename || '';
const MEDIA_SORTERS: Record<MediaSortKey, ((a: MediaAsset, b: MediaAsset) => number) | null> = {
  // A assinatura já entrega os uploads do mais novo para o mais antigo.
  recent: null,
  title: (a, b) => assetTitle(a).localeCompare(assetTitle(b), 'pt-BR'),
  type: (a, b) => (a.type || '').localeCompare(b.type || '', 'pt-BR') || assetTitle(a).localeCompare(assetTitle(b), 'pt-BR'),
};

export default function MediaLibraryPanel({
  onSelect,
  selectionMode = false,
  allowedTypes,
  compact = false,
  embedded = false,
  campaignScope = 'all',
  scopeRequest,
  onScopeConsumed,
}: MediaLibraryPanelProps) {
  const { t } = useTranslation('admin');
  const intlLocale = useIntlLocale();
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignsReady, setCampaignsReady] = useState(false);
  const [foldersReady, setFoldersReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const jobsRef = useRef<UploadJob[]>([]);
  const queueRunningRef = useRef(false);
  const openedBatchesRef = useRef(new Set<string>());
  // Busca, ordem e aba de tipo persistem por pasta; o seletor de mídia (modal) tem estado próprio.
  const mediaControls = useListControls<MediaAsset, MediaSortKey>({
    storageKey: selectionMode ? 'media-picker' : 'media',
    defaultSort: 'recent',
    sorters: MEDIA_SORTERS,
    defaultFilters: { type: 'all' },
  });
  const filter = (mediaControls.filters.type || 'all') as MediaType | 'all';
  const setFilter = (v: MediaType | 'all') => mediaControls.setFilter('type', v);
  const [folderFilter, setFolderFilter] = useState<FolderFilter>('all');
  const searchQuery = mediaControls.query;
  const setSearchQuery = mediaControls.setQuery;
  const assetSelection = useSelection<string>();
  const [bulkFolderOpen, setBulkFolderOpen] = useState(false);
  const toast = useToast();
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [assignAsset, setAssignAsset] = useState<MediaAsset | null>(null);
  const [assignFolderIds, setAssignFolderIds] = useState<string[]>([]);
  const { showAlert, showConfirm, modal } = useModal();
  const syncingRef = useRef(false);

  const intel = useIntelCatalog({ campaignScope });
  const intelRef = useRef(intel);
  intelRef.current = intel;
  const { campaigns: campaignsForEditor } = useAdminCampaigns();

  useEffect(() => {
    if (!scopeRequest) return;
    intel.setSearch('');
    intel.setStatusFilter('all');
    intel.setFilterType('ALL');
    onScopeConsumed?.();
  }, [scopeRequest]);

  useEffect(() => {
    const typeFilter =
      filter !== 'all'
        ? filter
        : allowedTypes?.length === 1
          ? allowedTypes[0]
          : undefined;
    const unsub = mediaService.subscribeToMedia(
      (newAssets) => {
        setAssets(newAssets);
        setLoading(false);
      },
      typeFilter,
    );
    return () => unsub();
  }, [filter, allowedTypes]);

  useEffect(() => {
    return mediaFolderService.subscribeFolders((list) => {
      setFolders(list);
      setFoldersReady(true);
    });
  }, []);

  useEffect(() => {
    return campaignService.subscribeToScopedCampaigns(
      (list) => {
        setCampaigns(list);
        setCampaignsReady(true);
      },
      () => setCampaignsReady(true),
    );
  }, []);

  useEffect(() => {
    if (!campaignsReady || !foldersReady) return;
    if (syncingRef.current) return;
    let cancelled = false;
    const run = async () => {
      syncingRef.current = true;
      try {
        if (!cancelled) {
          await mediaFolderService.ensureCampaignFolders(campaigns, folders);
        }
      } catch (err) {
        console.warn('[MediaLibraryPanel] folder sync error:', err);
      } finally {
        syncingRef.current = false;
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [campaigns, folders, campaignsReady, foldersReady]);

  const activeCampaignIds = useMemo(
    () => new Set(campaigns.map((c) => c.id)),
    [campaigns],
  );

  const folderNameById = useMemo(() => {
    const map = new Map<string, string>();
    folders.forEach((f) => map.set(f.id, f.name));
    return map;
  }, [folders]);

  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const asset of assets) {
      for (const tag of asset.metadata?.tags || []) {
        counts[tag] = (counts[tag] || 0) + 1;
      }
    }
    return counts;
  }, [assets]);

  const unfiledCount = useMemo(
    () => assets.filter((a) => !(a.metadata?.tags || []).length).length,
    [assets],
  );

  const patchJob = (id: string, patch: Partial<UploadJob>) => {
    jobsRef.current = jobsRef.current.map((j) => (j.id === id ? { ...j, ...patch } : j));
    setJobs(jobsRef.current);
  };

  /** Processa a fila um arquivo por vez; novos lotes entram no fim enquanto roda. */
  const runQueue = async () => {
    if (queueRunningRef.current) return;
    queueRunningRef.current = true;
    setUploading(true);
    try {
      for (;;) {
        const job = jobsRef.current.find((j) => j.status === 'queued');
        if (!job) break;
        patchJob(job.id, { status: 'uploading', progress: 0, error: undefined });
        try {
          const asset = await mediaService.uploadMedia(
            job.file,
            auth.currentUser?.uid || auth.currentUser?.email || 'admin',
            {
              folderIds: job.folderIds,
              onProgress: (progress) => patchJob(job.id, { progress }),
            },
          );
          patchJob(job.id, { status: 'done', progress: 100 });
          // Fluxo unificado: o editor abre só para o primeiro envio bem-sucedido do lote.
          if (!selectionMode && !openedBatchesRef.current.has(job.batchId)) {
            openedBatchesRef.current.add(job.batchId);
            const cur = intelRef.current;
            cur.openEditorFromAsset(asset);
            cur.setFeedback({
              type: 'success',
              text:
                job.batchSize === 1
                  ? '✓ Arquivo enviado. Complete os metadados da intel.'
                  : t('media.toast.uploadOk', { n: job.batchSize }),
            });
          }
        } catch (error) {
          console.error('Upload error:', error);
          patchJob(job.id, {
            status: 'error',
            retryable: true,
            error: error instanceof Error ? error.message : t('media.alert.uploadFail'),
          });
        }
      }
    } finally {
      queueRunningRef.current = false;
      setUploading(false);
    }
  };

  const handleUpload = async (files: FileList) => {
    if (files.length === 0) return;
    const folderIds =
      folderFilter !== 'all' && folderFilter !== 'unfiled' ? [folderFilter] : undefined;
    const batchId = `b${Date.now()}`;
    const picked = Array.from(files);
    const newJobs: UploadJob[] = picked.map((file, i) => {
      const rejection =
        validateUploadFile(file) ??
        (allowedTypes && !allowedTypes.some((ty) => file.type.startsWith(ty)) ? 'badType' : null);
      const base = { id: `${batchId}-${i}`, file, progress: 0, folderIds, batchId, batchSize: picked.length };
      if (rejection === 'tooLarge') {
        return {
          ...base,
          status: 'error' as const,
          error: t('media.queue.tooLarge', {
            max: Math.round(MAX_UPLOAD_BYTES / (1024 * 1024)),
            defaultValue: 'Maior que o limite de {{max}} MB',
          }),
        };
      }
      if (rejection === 'badType') {
        return {
          ...base,
          status: 'error' as const,
          error: t('media.queue.badType', { defaultValue: 'Tipo não permitido (áudio, imagem, vídeo ou PDF)' }),
        };
      }
      return { ...base, status: 'queued' as const, retryable: true };
    });
    jobsRef.current = [...jobsRef.current, ...newJobs];
    setJobs(jobsRef.current);
    await runQueue();
  };

  const handleRetryJob = (id: string) => {
    patchJob(id, { status: 'queued', progress: 0, error: undefined });
    void runQueue();
  };

  const handleClearDoneJobs = () => {
    jobsRef.current = jobsRef.current.filter((j) => j.status !== 'done');
    setJobs(jobsRef.current);
  };

  const handleDelete = async (asset: MediaAsset) => {
    const confirmed = await showConfirm(
      'DELETAR ARQUIVO',
      `Tem certeza que deseja remover permanentemente "${asset.filename}"? Isso pode quebrar links existentes.`,
    );
    if (confirmed) {
      try {
        await mediaService.deleteMedia(asset);
      } catch {
        showAlert('Erro', t('media.alert.deleteFail'));
      }
    }
  };

  const handleCreateFolder = async (name: string) => {
    try {
      await mediaFolderService.createFolder(name);
    } catch {
      showAlert('Erro', t('media.alert.createFolderFail'));
    }
  };

  const handleRenameFolder = async (folder: MediaFolder, name: string) => {
    try {
      await mediaFolderService.renameFolder(folder.id, name);
    } catch {
      showAlert('Erro', t('media.alert.renameFolderFail'));
    }
  };

  const handleDeleteFolder = async (folder: MediaFolder) => {
    const confirmed = await showConfirm(
      'APAGAR PASTA',
      t('media.confirm.deleteFolder', { name: folder.name }),
    );
    if (!confirmed) return;
    try {
      await mediaFolderService.deleteFolder(folder);
      if (folderFilter === folder.id) setFolderFilter('all');
    } catch (err) {
      showAlert('Erro', err instanceof Error ? err.message : t('media.alert.deleteFolderFail'));
    }
  };

  const filteredAssets = useMemo(() => {
    const base = assets.filter((a) => {
      if (allowedTypes?.length && !allowedTypes.includes(a.type)) return false;
      const tags = a.metadata?.tags || [];
      if (folderFilter === 'unfiled' && tags.length > 0) return false;
      if (folderFilter !== 'all' && folderFilter !== 'unfiled' && !tags.includes(folderFilter)) {
        return false;
      }
      return true;
    });
    return mediaControls.apply(base, (a, q) => {
      const tags = a.metadata?.tags || [];
      const folderNames = tags
        .map((id) => folderNameById.get(id) || '')
        .join(' ')
        .toLowerCase();
      return (
        a.filename.toLowerCase().includes(q) ||
        (a.metadata.title || '').toLowerCase().includes(q) ||
        folderNames.includes(q)
      );
    });
  }, [assets, allowedTypes, folderFilter, mediaControls.apply, folderNameById]);

  // Trocar busca, aba ou pasta limpa a seleção; remoções descartam o que sumiu (M03).
  useEffect(() => {
    assetSelection.clear();
  }, [searchQuery, filter, folderFilter, assetSelection.clear]);
  useEffect(() => {
    assetSelection.prune(filteredAssets.map((a) => a.id));
  }, [filteredAssets, assetSelection.prune]);

  const selectedAssets = filteredAssets.filter((a) => assetSelection.isSelected(a.id));

  const reportBulk = (ok: number, failed: number, total: number) => {
    if (failed === 0) {
      toast.success(t('bulk.result', { ok, total, defaultValue: '{{ok}} de {{total}} itens processados' }));
    } else {
      toast.error(t('bulk.resultPartial', { ok, failed, defaultValue: '{{ok}} processados, {{failed}} falharam' }));
    }
  };

  /** Remove os arquivos marcados com uma única confirmação (mesmo caminho de `handleDelete`). */
  const handleBulkDelete = async () => {
    const targets = selectedAssets;
    if (targets.length === 0) return;
    const confirmed = await showConfirm(
      t('bulk.remove', { defaultValue: 'Remover itens' }),
      t('bulk.removeFilesBody', {
        count: targets.length,
        defaultValue: 'Remover permanentemente {{count}} arquivos? Isso pode quebrar links existentes.',
      }),
      t('bulk.remove', { defaultValue: 'Remover' }),
    );
    if (!confirmed) return;
    let ok = 0;
    let failed = 0;
    for (const asset of targets) {
      try {
        await mediaService.deleteMedia(asset);
        ok++;
      } catch {
        failed++;
      }
    }
    assetSelection.clear();
    reportBulk(ok, failed, targets.length);
  };

  /** Soma as pastas escolhidas às que cada arquivo já tem. */
  const handleBulkFolders = async (folderIds: string[]) => {
    const targets = selectedAssets;
    let ok = 0;
    let failed = 0;
    for (const asset of targets) {
      try {
        await mediaFolderService.setAssetFolders(asset.id, [...(asset.metadata?.tags || []), ...folderIds]);
        ok++;
      } catch {
        failed++;
      }
    }
    assetSelection.clear();
    reportBulk(ok, failed, targets.length);
  };

  const handleAssetClick = (asset: MediaAsset) => {
    if (selectionMode) {
      onSelect?.(asset);
      return;
    }
    setSelectedAssetId(asset.id);
    intel.focusAsset(asset.id);
  };

  const playIntelAudio = (item: IntelItem) => {
    if (item.mediaUrl) {
      const a = new Audio(item.mediaUrl);
      void a.play();
    }
  };

  const showCatalog = !selectionMode;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-5"
    >
      {intel.modal}
      {modal}

      {!compact && (
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {!embedded && (
              <div
                className={`w-1 h-9 bg-accent shrink-0 ${uploading ? 'animate-led' : ''}`}
              />
            )}
            <div>
              {!embedded && (
                <h2 className="font-display font-bold uppercase tracking-wider text-xl text-bone">
                  {t('media.title')}
                </h2>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative group flex-1 min-w-[160px] max-w-xs">
              <MIcon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-ash-500 text-base group-focus-within:text-primary transition-colors" />
              <input
                type="text"
                placeholder={t('media.search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-surface-container-lowest text-[10px] font-display font-bold uppercase tracking-[0.1em] w-full placeholder:text-ash-500 text-bone pl-10 pr-4 py-2.5 outline-none rounded-sm transition focus:bg-accent-10"
              />
            </div>
            {showCatalog && (
              <>
                <button
                  type="button"
                  onClick={() => intel.setShowExport(true)}
                  className="bg-surface-container-high text-ash-400 px-4 py-2.5 text-[10px] font-display font-bold uppercase hover:bg-white/5 transition rounded-sm active:translate-y-px flex items-center gap-2"
                >
                  <MIcon name="download" className="text-base" />
                  {t('accounts.export')}
                </button>
                <UnifiedIntelCreateButton
                  uploading={uploading}
                  onCreateBlank={intel.handleNewItem}
                  onPickFiles={(files) => void handleUpload(files)}
                />
              </>
            )}
          </div>
        </div>
      )}

      {showCatalog && intel.feedback && (
        <div
          className={`p-3 text-[10px] font-display font-bold uppercase tracking-[0.1em] rounded-sm ${
            intel.feedback.type === 'success'
              ? 'text-phosphor-400 bg-phosphor-500/5'
              : 'text-red-400 bg-red-500/5'
          }`}
        >
          {intel.feedback.text}
        </div>
      )}

      {!selectionMode && (
        <MediaUploadZone
          onUpload={handleUpload}
          uploading={uploading}
          uploadProgress={0}
          jobs={jobs}
          onRetry={handleRetryJob}
          onClearDone={handleClearDoneJobs}
          hideUploadButton
        />
      )}

      {selectionMode && (
        <MediaUploadZone
          onUpload={handleUpload}
          uploading={uploading}
          uploadProgress={0}
          jobs={jobs}
          onRetry={handleRetryJob}
          onClearDone={handleClearDoneJobs}
          hideDropZone
          uploadButtonLabel="UPLOAD"
        />
      )}

      <div
        className={`flex flex-col gap-4 items-stretch ${
          showCatalog ? 'xl:flex-row xl:min-h-[560px]' : 'md:flex-row'
        }`}
      >
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={SPRING_SNAP}
          className={`flex flex-col md:flex-row gap-4 min-w-0 ${showCatalog ? 'xl:flex-[1.15]' : 'flex-1'}`}
        >
          <MediaFolderSidebar
            folders={folders}
            selected={folderFilter}
            onSelect={setFolderFilter}
            counts={folderCounts}
            unfiledCount={unfiledCount}
            totalCount={assets.length}
            activeCampaignIds={activeCampaignIds}
            selectionMode={selectionMode}
            onCreate={handleCreateFolder}
            onRename={handleRenameFolder}
            onDelete={handleDeleteFolder}
          />

          <div className="flex-1 min-w-0 space-y-4">
            <div className="flex border-b border-primary/10 overflow-x-auto">
              <FilterTab label={t('hardware.filter.all')} active={filter === 'all'} onClick={() => setFilter('all')} icon="grid_view" />
              <FilterTab label={t('intel.type.audio')} active={filter === 'audio'} onClick={() => setFilter('audio')} icon="audiotrack" />
              <FilterTab label={t('media.filter.images')} active={filter === 'image'} onClick={() => setFilter('image')} icon="image" />
              <FilterTab label={t('media.filter.videos')} active={filter === 'video'} onClick={() => setFilter('video')} icon="videocam" />
            </div>

            <SortSelect
              value={mediaControls.sortKey}
              onChange={mediaControls.setSortKey}
              options={[
                { value: 'recent', label: t('list.sort.recent', { defaultValue: 'Mais recentes' }) },
                { value: 'title', label: t('list.sort.title', { defaultValue: 'Título (A-Z)' }) },
                { value: 'type', label: t('list.sort.type', { defaultValue: 'Tipo' }) },
              ]}
              className="max-w-xs"
            />

            {!selectionMode && (
              <BulkActionBar
                count={assetSelection.count}
                onClear={assetSelection.clear}
                onSelectAll={() => assetSelection.selectAll(filteredAssets.map((a) => a.id))}
                allSelected={assetSelection.allSelected(filteredAssets.map((a) => a.id))}
              >
                <button type="button" onClick={() => setBulkFolderOpen(true)} className="lmb-btn">
                  <MIcon name="folder" className="text-base" />
                  {t('bulk.moveToFolder', { defaultValue: 'Mover para pasta' })}
                </button>
                <button type="button" onClick={() => void handleBulkDelete()} className="lmb-btn lmb-btn-danger">
                  <MIcon name="delete" className="text-base" />
                  {t('bulk.remove', { defaultValue: 'Remover' })}
                </button>
              </BulkActionBar>
            )}

            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center py-20 gap-4"
                >
                  <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                  <p className="text-[10px] font-display font-bold text-primary/40 uppercase tracking-[0.12em]">
                    {t('media.indexing')}
                  </p>
                </motion.div>
              ) : filteredAssets.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center py-20 bg-black/10"
                >
                  <MIcon name="folder_off" className="text-4xl text-ash-700 mb-2" />
                  <p className="text-[10px] font-display font-bold text-ash-500 uppercase tracking-[0.12em]">
                    {t('media.empty')}
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key={`${folderFilter}-${filter}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className={`grid gap-3 ${
                    showCatalog
                      ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 2xl:grid-cols-4'
                      : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'
                  }`}
                >
                  <AnimatePresence mode="popLayout">
                    {filteredAssets.map((asset, index) => {
                      const tags = asset.metadata?.tags || [];
                      const intelItem = intel.allItems.find((i) => i.id === asset.id);
                      const catalogStatus = intelItem
                        ? getIntelCatalogStatus(intelItem, asset)
                        : null;
                      const selected = selectedAssetId === asset.id;
                      return (
                        <motion.div
                          layout
                          initial={{ opacity: 0, scale: 0.92 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.92 }}
                          transition={{ delay: Math.min(index * 0.025, 0.25) }}
                          key={asset.id}
                          className={`group relative aspect-square bg-surface-container-low overflow-hidden transition cursor-pointer ${
                            selected
                              ? 'shadow-[0_0_20px_rgba(255,140,0,0.15)] bg-accent-10'
                              : 'bg-accent-10 hover:bg-accent-10'
                          }`}
                          onClick={() => handleAssetClick(asset)}
                        >
                          <div className="absolute inset-0 z-0">
                            {asset.type === 'image' ? (
                              <img
                                src={asset.url}
                                alt={asset.filename}
                                className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center bg-black/40">
                                <MIcon name={asset.type === 'audio'
                                    ? 'audiotrack'
                                    : asset.type === 'video'
                                      ? 'videocam'
                                      : 'description'} className="text-4xl text-primary/20 group-hover:text-primary/60 transition-colors" />
                              </div>
                            )}
                          </div>

                          {!selectionMode && (
                            <input
                              type="checkbox"
                              checked={assetSelection.isSelected(asset.id)}
                              onClick={(e) => e.stopPropagation()}
                              onChange={() => assetSelection.toggle(asset.id)}
                              aria-label={asset.metadata.title || asset.filename}
                              className={`absolute bottom-8 left-1 z-30 h-4 w-4 cursor-pointer accent-primary transition-opacity ${
                                assetSelection.isSelected(asset.id) || assetSelection.count > 0
                                  ? 'opacity-100'
                                  : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
                              }`}
                            />
                          )}

                          {catalogStatus && !selectionMode && (
                            <div className="absolute top-1 right-1 z-20 flex flex-col items-end gap-0.5">
                              <span
                                className={`text-[10px] font-display font-bold uppercase tracking-wider px-1 py-0.5 rounded-sm bg-black/70 ${intelCatalogStatusClass(catalogStatus)}`}
                              >
                                {intelCatalogStatusLabel(catalogStatus)}
                              </span>
                              {intelItem && (
                                <span
                                  className={`text-[10px] font-display font-bold uppercase tracking-wider px-1 py-0.5 rounded-sm bg-black/70 ${accessLevelClass(intelItem.level)}`}
                                >
                                  {accessLevelLabel(intelItem.level)}
                                </span>
                              )}
                            </div>
                          )}

                          {tags.length > 0 && (
                            <div className="absolute top-1 left-1 z-20 flex flex-wrap gap-0.5 max-w-[70%]">
                              {tags.slice(0, 2).map((tid) => (
                                <span
                                  key={tid}
                                  className="px-1 py-0.5 bg-black/70 text-[10px] font-display font-bold text-primary uppercase tracking-wider truncate max-w-18"
                                >
                                  {folderNameById.get(tid) || '…'}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="absolute inset-0 z-10 bg-linear-to-t from-black via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-2 flex flex-col justify-end">
                            <p className="text-[10px] font-display font-bold text-bone uppercase truncate tracking-wider">
                              {asset.metadata.title || asset.filename}
                            </p>
                            <p className="text-[10px] font-display text-ash-400 uppercase tracking-wider">
                              {formatFileSize(asset.size)}
                            </p>
                          </div>

                          {!selectionMode && (
                            <div className="absolute bottom-1 right-1 z-20 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                              <button
                                type="button"
                                title={t('media.foldersTitle')}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAssignFolderIds([...(asset.metadata?.tags || [])]);
                                  setAssignAsset(asset);
                                }}
                                className="p-1 bg-primary/20 hover:bg-primary text-primary hover:text-black rounded-sm transition"
                              >
                                <MIcon name="folder" className="text-sm" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleDelete(asset);
                                }}
                                className="p-1 bg-red-500/20 hover:bg-red-500 text-red-500 hover:text-bone rounded-sm transition"
                              >
                                <MIcon name="delete" className="text-sm" />
                              </button>
                            </div>
                          )}

                          {asset.type === 'audio' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const a = new Audio(asset.url);
                                void a.play();
                              }}
                              className="absolute z-20 bottom-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-primary/20 hover:bg-primary text-primary hover:text-black rounded-sm"
                            >
                              <MIcon name="play_arrow" className="text-sm" />
                            </button>
                          )}
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {showCatalog && (
          <div className="xl:w-[min(420px,38%)] xl:shrink-0 min-h-[420px] xl:min-h-0 xl:h-auto flex flex-col">
            <IntelCatalogPane
              items={intel.filteredItems}
              mediaAssetMap={intel.mediaAssetMap}
              focusedId={intel.focusedIntelId}
              search={intel.search}
              filterType={intel.filterType}
              statusFilter={intel.statusFilter}
              campaignScope={intel.campaignScope}
              campaigns={campaignsForEditor}
              isLoading={intel.isLoading}
              onSearch={intel.setSearch}
              onFilterType={intel.setFilterType}
              onStatusFilter={intel.setStatusFilter}
              onEdit={intel.handleEditItem}
              onDelete={(item) => void intel.handleDeleteItem(item)}
              sortKey={intel.sortKey}
              onSortKey={intel.setSortKey}
              onDuplicate={intel.handleDuplicateItem}
              selection={intel.selection}
              bulkBusy={intel.bulkBusy}
              onBulkDelete={(items) => void intel.handleBulkDelete(items)}
              onBulkLink={(items, campaignId) => void intel.handleBulkLink(items, campaignId)}
              onDeleteFile={(item) => void intel.handleDeleteFileOnly(item)}
              onQr={intel.setQrCodeModal}
              onPlayAudio={playIntelAudio}
            />
          </div>
        )}
      </div>

      {showCatalog && (
        <>
          <IntelEditorHost intel={intel} campaigns={campaignsForEditor} />
          <IntelQrModal
            item={intel.qrCodeModal}
            onClose={() => intel.setQrCodeModal(null)}
            onFeedback={intel.setFeedback}
          />
          <IntelExportDrawer
            open={intel.showExport}
            exportJSON={intel.exportJSON}
            itemCount={intel.allItems.length}
            onClose={() => intel.setShowExport(false)}
            onCopied={() => {
              intel.setFeedback({ type: 'success', text: '✓ JSON REGISTRY COPIADO' });
              intel.setShowExport(false);
            }}
          />
        </>
      )}

      <MediaFolderAssignModal
        open={bulkFolderOpen}
        folders={folders}
        selectedIds={[]}
        assetTitle={t('bulk.selected', { count: assetSelection.count })}
        onClose={() => setBulkFolderOpen(false)}
        onSave={handleBulkFolders}
      />

      <MediaFolderAssignModal
        open={!!assignAsset}
        folders={folders}
        selectedIds={assignFolderIds}
        assetTitle={assignAsset?.metadata?.title || assignAsset?.filename || ''}
        onClose={() => {
          setAssignAsset(null);
          setAssignFolderIds([]);
        }}
        onSave={async (folderIds) => {
          if (!assignAsset) return;
          try {
            await mediaFolderService.setAssetFolders(assignAsset.id, folderIds);
          } catch {
            showAlert('Erro', t('media.alert.updateFoldersFail'));
          }
        }}
      />
    </motion.div>
  );
}

function UnifiedIntelCreateButton({
  uploading,
  onCreateBlank,
  onPickFiles,
}: {
  uploading: boolean;
  onCreateBlank: () => void;
  onPickFiles: (files: FileList) => void;
}) {
  const { t } = useTranslation('admin');
  const [menuOpen, setMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  return (
    <div ref={rootRef} className="relative flex">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/*,image/*,video/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) onPickFiles(e.target.files);
          e.target.value = '';
          setMenuOpen(false);
        }}
      />
      <button
        type="button"
        disabled={uploading}
        onClick={() => setMenuOpen((v) => !v)}
        className="bg-primary text-black pl-4 pr-3 py-2.5 text-[10px] font-display font-bold uppercase hover:bg-primary-container transition rounded-sm active:translate-y-px glow-orange shadow-lg flex items-center gap-2 disabled:opacity-40"
      >
        <MIcon name={uploading ? 'sync' : 'add_circle'} className="text-base" />
        NOVA INTEL
        <MIcon name={menuOpen ? 'expand_less' : 'expand_more'} className="text-sm opacity-70" />
      </button>
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 z-50 min-w-[220px] bg-surface-container-low shadow-panel rounded-sm overflow-hidden"
          >
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onCreateBlank();
              }}
              className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-primary/10 transition-colors border-b border-border-subtle"
            >
              <MIcon name="edit_note" className="text-primary text-base" />
              <span className="flex flex-col">
                <span className="text-[10px] font-display font-bold uppercase tracking-wider text-bone">
                  Entrada em branco
                </span>
                <span className="text-[10px] font-display text-ash-500 uppercase tracking-wider">
                  Texto, meta ou preencher depois
                </span>
              </span>
            </button>
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-primary/10 transition-colors disabled:opacity-40"
            >
              <MIcon name="upload_file" className="text-primary text-base" />
              <span className="flex flex-col">
                <span className="text-[10px] font-display font-bold uppercase tracking-wider text-bone">
                  {t('media.uploadFile')}
                </span>
                <span className="text-[10px] font-display text-ash-500 uppercase tracking-wider">
                  Áudio, imagem ou vídeo → editor
                </span>
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FilterTab({
  label,
  active,
  onClick,
  icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex flex-1 items-center justify-center gap-2 px-3 2xl:px-6 py-3 text-[10px] font-display font-bold tracking-[0.16em] transition border-r last:border-r-0 border-primary/10 uppercase whitespace-nowrap ${
        active
          ? 'bg-primary/10 text-primary border-b-2 border-b-primary'
          : 'text-ash-400 hover:bg-primary/5 hover:text-primary'
      }`}
    >
      <MIcon name={icon} className="text-base" />
      {label}
    </button>
  );
}
