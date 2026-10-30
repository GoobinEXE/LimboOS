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
import { Campaign, campaigns as localCampaigns } from '../../data/campaigns';
import { useModal } from './ConfirmModal';
import {
  formatFileSize,
  getIntelCatalogStatus,
  intelCatalogStatusClass,
  intelCatalogStatusLabel,
  accessLevelClass,
  accessLevelLabel,
} from '../lib/intelDisplay';
import MediaUploadZone from './media/MediaUploadZone';
import MediaFolderSidebar, { FolderFilter } from './media/MediaFolderSidebar';
import MediaFolderAssignModal from './media/MediaFolderAssignModal';
import MediaSelectorModal from './MediaSelectorModal';
import IntelCatalogPane from './intel/IntelCatalogPane';
import IntelEditorModal from './intel/IntelEditorModal';
import IntelQrModal from './intel/IntelQrModal';
import IntelExportDrawer from './intel/IntelExportDrawer';
import { useIntelCatalog } from '../hooks/useIntelCatalog';

interface MediaLibraryPanelProps {
  onSelect?: (asset: MediaAsset) => void;
  selectionMode?: boolean;
  allowedTypes?: MediaType[];
  /** Compact chrome for modal selector. */
  compact?: boolean;
}

export default function MediaLibraryPanel({
  onSelect,
  selectionMode = false,
  allowedTypes,
  compact = false,
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
  const [uploadProgress, setUploadProgress] = useState(0);
  const [filter, setFilter] = useState<MediaType | 'all'>('all');
  const [folderFilter, setFolderFilter] = useState<FolderFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [assignAsset, setAssignAsset] = useState<MediaAsset | null>(null);
  const [assignFolderIds, setAssignFolderIds] = useState<string[]>([]);
  const { showAlert, showConfirm, modal } = useModal();
  const syncingRef = useRef(false);

  const intel = useIntelCatalog();

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
    return onSnapshot(
      collection(db, 'campaigns'),
      (snap) => {
        setCampaigns(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Campaign)));
        setCampaignsReady(true);
      },
      (err) => console.warn('[MediaLibraryPanel] campaigns listener error:', err),
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

  /** Campanhas remotas + seed local (sem duplicar), para o select do editor. */
  const campaignsForEditor = useMemo(() => {
    const byId = new Map<string, Campaign>();
    localCampaigns.forEach((c) => byId.set(c.id, c));
    campaigns.forEach((c) => byId.set(c.id, c));
    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name, intlLocale));
  }, [campaigns]);

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

  const handleUpload = async (files: FileList) => {
    if (files.length === 0) return;
    setUploading(true);
    setUploadProgress(0);

    const folderIds =
      folderFilter !== 'all' && folderFilter !== 'unfiled' ? [folderFilter] : undefined;

    try {
      const uploaded: MediaAsset[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const mimeOk =
          file.type.startsWith('audio/') ||
          file.type.startsWith('image/') ||
          file.type.startsWith('video/') ||
          file.type === 'application/pdf';
        if (!mimeOk) continue;
        if (allowedTypes && !allowedTypes.some((t) => file.type.startsWith(t))) {
          continue;
        }
        const asset = await mediaService.uploadMedia(
          file,
          auth.currentUser?.uid || auth.currentUser?.email || 'admin',
          {
            folderIds,
            onProgress: (progress) => setUploadProgress(progress),
          },
        );
        uploaded.push(asset);
      }

      if (uploaded.length === 0) {
        showAlert(t('media.alert.upload'), t('media.alert.noValidFiles'));
        return;
      }

      // Fluxo unificado: abre o editor com o primeiro arquivo; demais ficam no catálogo.
      if (!selectionMode) {
        const primary = uploaded[0];
        intel.openEditorFromAsset(primary);
        intel.setFeedback({
          type: 'success',
          text:
            uploaded.length === 1
              ? '✓ Arquivo enviado. Complete os metadados da intel.'
              : t('media.toast.uploadOk', { n: uploaded.length }),
        });
      } else {
        intel.setFeedback({
          type: 'success',
          text: `✓ ${uploaded.length} arquivo(s) enviado(s).`,
        });
      }
    } catch (error) {
      console.error('Upload error:', error);
      showAlert(t('media.alert.uploadError'), t('media.alert.uploadFail'));
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
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

  const filteredAssets = assets.filter((a) => {
    if (allowedTypes?.length && !allowedTypes.includes(a.type)) return false;

    const tags = a.metadata?.tags || [];
    if (folderFilter === 'unfiled' && tags.length > 0) return false;
    if (folderFilter !== 'all' && folderFilter !== 'unfiled' && !tags.includes(folderFilter)) {
      return false;
    }

    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const title = (a.metadata.title || '').toLowerCase();
    const filename = a.filename.toLowerCase();
    const folderNames = tags
      .map((id) => folderNameById.get(id) || '')
      .join(' ')
      .toLowerCase();
    return filename.includes(q) || title.includes(q) || folderNames.includes(q);
  });

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
            <div
              className={`w-1 h-9 bg-accent shrink-0 ${uploading ? 'animate-pulse' : ''}`}
            />
            <div>
              <h2 className="font-display font-bold uppercase tracking-widest text-xl text-bone">
                {t('media.title')}
              </h2>
              <p className="text-[10px] font-display font-bold text-ash-500 tracking-[0.2em] uppercase">
                {t('media.subtitle', {
                  files: filteredAssets.length,
                  folders: folders.length,
                  intel: showCatalog ? intel.typeStats.total : 0,
                })}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative group flex-1 min-w-[160px] max-w-xs">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-ash-600 text-base group-focus-within:text-primary transition-colors">
                search
              </span>
              <input
                type="text"
                placeholder={t('media.search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-surface-container-lowest border border-primary/10 text-[10px] font-display font-bold uppercase tracking-[0.2em] focus:border-primary/50 w-full placeholder:text-ash-600 text-bone pl-10 pr-4 py-2.5 outline-none rounded-sm transition"
              />
            </div>
            {showCatalog && (
              <>
                <button
                  type="button"
                  onClick={() => intel.setShowExport(true)}
                  className="bg-surface-container-high text-ash-400 px-4 py-2.5 text-[10px] font-display font-bold border border-border-subtle uppercase hover:bg-white/5 transition rounded-sm active:scale-[0.97] flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-base">download</span>
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
          className={`p-3 border text-[10px] font-display font-bold uppercase tracking-[0.2em] rounded-sm ${
            intel.feedback.type === 'success'
              ? 'border-phosphor-500/30 text-phosphor-400 bg-phosphor-500/5'
              : 'border-red-500/30 text-red-400 bg-red-500/5'
          }`}
        >
          {intel.feedback.text}
        </div>
      )}

      {!selectionMode && (
        <MediaUploadZone
          onUpload={handleUpload}
          uploading={uploading}
          uploadProgress={uploadProgress}
          hideUploadButton
        />
      )}

      {selectionMode && (
        <MediaUploadZone
          onUpload={handleUpload}
          uploading={uploading}
          uploadProgress={uploadProgress}
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
                  <p className="text-[10px] font-display font-bold text-primary/40 uppercase tracking-[0.4em]">
                    {t('media.indexing')}
                  </p>
                </motion.div>
              ) : filteredAssets.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center py-20 border border-primary/5 bg-black/10"
                >
                  <span className="material-symbols-outlined text-4xl text-ash-700 mb-2">
                    folder_off
                  </span>
                  <p className="text-[10px] font-display font-bold text-ash-600 uppercase tracking-[0.3em]">
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
                          className={`group relative aspect-square bg-surface-container-low border overflow-hidden transition cursor-pointer ${
                            selected
                              ? 'border-primary ring-2 ring-primary/40 shadow-[0_0_20px_rgba(255,140,0,0.15)]'
                              : 'border-primary/10 hover:border-primary/50'
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
                                <span className="material-symbols-outlined text-4xl text-primary/20 group-hover:text-primary/60 transition-colors">
                                  {asset.type === 'audio'
                                    ? 'audiotrack'
                                    : asset.type === 'video'
                                      ? 'videocam'
                                      : 'description'}
                                </span>
                              </div>
                            )}
                          </div>

                          {catalogStatus && !selectionMode && (
                            <div className="absolute top-1 right-1 z-20 flex flex-col items-end gap-0.5">
                              <span
                                className={`text-[7px] font-display font-bold uppercase tracking-widest px-1 py-0.5 border rounded-sm bg-black/70 ${intelCatalogStatusClass(catalogStatus)}`}
                              >
                                {intelCatalogStatusLabel(catalogStatus)}
                              </span>
                              {intelItem && (
                                <span
                                  className={`text-[7px] font-display font-bold uppercase tracking-widest px-1 py-0.5 border rounded-sm bg-black/70 ${accessLevelClass(intelItem.level)}`}
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
                                  className="px-1 py-0.5 bg-black/70 text-[7px] font-display font-bold text-primary uppercase tracking-wider truncate max-w-18"
                                >
                                  {folderNameById.get(tid) || '…'}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="absolute inset-0 z-10 bg-linear-to-t from-black via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-2 flex flex-col justify-end">
                            <p className="text-[9px] font-display font-bold text-bone uppercase truncate tracking-widest">
                              {asset.metadata.title || asset.filename}
                            </p>
                            <p className="text-[9px] font-display text-ash-400 uppercase tracking-widest">
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
                                <span className="material-symbols-outlined text-sm">folder</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleDelete(asset);
                                }}
                                className="p-1 bg-red-500/20 hover:bg-red-500 text-red-500 hover:text-bone rounded-sm transition"
                              >
                                <span className="material-symbols-outlined text-sm">delete</span>
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
                              <span className="material-symbols-outlined text-sm">play_arrow</span>
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
              isLoading={intel.isLoading}
              onSearch={intel.setSearch}
              onFilterType={intel.setFilterType}
              onStatusFilter={intel.setStatusFilter}
              onEdit={intel.handleEditItem}
              onDelete={(item) => void intel.handleDeleteItem(item)}
              onDeleteFile={(item) => void intel.handleDeleteFileOnly(item)}
              onQr={intel.setQrCodeModal}
              onPlayAudio={playIntelAudio}
            />
          </div>
        )}
      </div>

      {showCatalog && (
        <>
          <MediaSelectorModal
            isOpen={intel.isMediaSelectorOpen}
            onClose={() => intel.setIsMediaSelectorOpen(false)}
            onSelect={intel.handleMediaSelect}
            allowedTypes={intel.formData.type === 'VIDEO' ? ['video'] : undefined}
            title={intel.formData.type === 'VIDEO' ? t('media.selectVideo') : t('media.selectMedia')}
          />
          <IntelEditorModal
            open={intel.showEditor}
            editingItem={intel.editingItem}
            formData={intel.formData}
            campaigns={campaignsForEditor}
            youtubeInput={intel.youtubeInput}
            mediaUploading={intel.mediaUploading}
            mediaFileInputRef={intel.mediaFileInputRef}
            videoFileInputRef={intel.videoFileInputRef}
            onClose={() => intel.setShowEditor(false)}
            onSave={() => void intel.handleSave()}
            onUpdateField={intel.updateField}
            onUpdateMeta={intel.updateMeta}
            onYoutubeInput={intel.setYoutubeInput}
            onApplyYoutube={intel.handleApplyYoutubeLink}
            onMediaUpload={(files) => void intel.handleMediaFileUpload(files)}
            onOpenLibrary={() => intel.setIsMediaSelectorOpen(true)}
          />
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
        className="bg-primary text-black pl-4 pr-3 py-2.5 text-[10px] font-display font-bold border border-primary/20 uppercase hover:bg-primary-container transition rounded-sm active:scale-[0.97] glow-orange shadow-lg flex items-center gap-2 disabled:opacity-40"
      >
        <span className="material-symbols-outlined text-base">
          {uploading ? 'sync' : 'add_circle'}
        </span>
        NOVA INTEL
        <span className="material-symbols-outlined text-sm opacity-70">
          {menuOpen ? 'expand_less' : 'expand_more'}
        </span>
      </button>
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 z-50 min-w-[220px] bg-surface-container-low border border-primary/30 shadow-2xl rounded-sm overflow-hidden"
          >
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onCreateBlank();
              }}
              className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-primary/10 transition-colors border-b border-border-subtle"
            >
              <span className="material-symbols-outlined text-primary text-base">edit_note</span>
              <span className="flex flex-col">
                <span className="text-[10px] font-display font-bold uppercase tracking-widest text-bone">
                  Entrada em branco
                </span>
                <span className="text-[9px] font-display text-ash-500 uppercase tracking-wider">
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
              <span className="material-symbols-outlined text-primary text-base">upload_file</span>
              <span className="flex flex-col">
                <span className="text-[10px] font-display font-bold uppercase tracking-widest text-bone">
                  {t('media.uploadFile')}
                </span>
                <span className="text-[9px] font-display text-ash-500 uppercase tracking-wider">
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
      <span className="material-symbols-outlined text-base">{icon}</span>
      {label}
    </button>
  );
}
