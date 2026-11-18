import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { intelRegistry } from '../../data/intel_registry';
import { intelService } from '../../services/IntelService';
import type { IntelItem, IntelType } from '../../types/intel';
import { MediaAsset } from '../../types/media';
import { mediaService } from '../../services/MediaService';
import { extractYoutubeId, isYoutubeUrl, youtubeWatchUrl } from '../../lib/youtube';
import { useTranslation } from 'react-i18next';
import { useModal } from '../components/ConfirmModal';
import { useToast } from '../components/ToastProvider';
import { useListControls } from './useListControls';
import { useSelection } from './useSelection';
import { matchesIntelScope, type CampaignScope } from '../lib/campaignResources';
import {
  matchesIntelStatusFilter,
  type IntelStatusFilter,
} from '../lib/intelDisplay';
import {
  EMPTY_ITEM,
  detectTypeFromUrl,
  detectTypeFromUrlWithYoutube,
  type IntelFormData,
} from '../components/intel/intelFormUtils';

export type IntelSortKey = 'default' | 'title' | 'type' | 'id';

const byText = (a: string | undefined, b: string | undefined) => (a || '').localeCompare(b || '', 'pt-BR');
const INTEL_SORTERS: Record<IntelSortKey, ((a: IntelItem, b: IntelItem) => number) | null> = {
  default: null,
  title: (a, b) => byText(a.title, b.title),
  type: (a, b) => byText(a.type, b.type) || byText(a.title, b.title),
  id: (a, b) => byText(a.id, b.id),
};

/** `campaignScope` vem de quem exibe o catálogo (Conteúdo: `?mission=` do URL). */
export function useIntelCatalog({ campaignScope = 'all' }: { campaignScope?: CampaignScope } = {}) {
  const { t } = useTranslation('admin');
  const { t: tc } = useTranslation('common');
  const toast = useToast();
  const { showConfirm, showConfirmWithOption, modal } = useModal();
  const [allItems, setAllItems] = useState<IntelItem[]>(() => intelRegistry.getAll());
  // Busca, ordem e filtros ficam em sessionStorage por pasta (M06, M12).
  const controls = useListControls<IntelItem, IntelSortKey>({
    storageKey: 'intel',
    defaultSort: 'default',
    sorters: INTEL_SORTERS,
    defaultFilters: { type: 'ALL', status: 'all' },
  });
  const search = controls.query;
  const setSearch = controls.setQuery;
  const filterType = (controls.filters.type || 'ALL') as IntelType | 'ALL';
  const setFilterType = useCallback(
    (v: IntelType | 'ALL') => controls.setFilter('type', v),
    [controls.setFilter],
  );
  const statusFilter = (controls.filters.status || 'all') as IntelStatusFilter;
  const setStatusFilter = useCallback(
    (v: IntelStatusFilter) => controls.setFilter('status', v),
    [controls.setFilter],
  );
  const sortKey = controls.sortKey;
  const setSortKey = controls.setSortKey;
  const selection = useSelection<string>();
  const [isSaving, setIsSaving] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  /** Missão do filtro ativo: intel nova (em branco ou via upload) nasce vinculada a ela. */
  const scopedCampaignId =
    campaignScope !== 'all' && campaignScope !== 'global' ? campaignScope : undefined;
  const [mediaAssetMap, setMediaAssetMap] = useState<Record<string, MediaAsset>>({});
  const [showEditor, setShowEditor] = useState(false);
  const [editingItem, setEditingItem] = useState<IntelItem | null>(null);
  const [formData, setFormData] = useState<IntelFormData>({ id: '', ...EMPTY_ITEM });
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [qrCodeModal, setQrCodeModal] = useState<IntelItem | null>(null);
  const [isMediaSelectorOpen, setIsMediaSelectorOpen] = useState(false);
  const [youtubeInput, setYoutubeInput] = useState('');
  const [mediaUploading, setMediaUploading] = useState(false);
  const [focusedIntelId, setFocusedIntelId] = useState<string | null>(null);
  const videoFileInputRef = useRef<HTMLInputElement>(null);
  const mediaFileInputRef = useRef<HTMLInputElement>(null);

  const refreshItems = useCallback(() => {
    setAllItems(intelRegistry.getAll());
  }, []);

  useEffect(() => {
    setIsLoading(true);
    const unsub = intelService.subscribeToIntelRegistry((items) => {
      setAllItems(items);
      setIsLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = mediaService.subscribeToMedia((assets) => {
      const map: Record<string, MediaAsset> = {};
      assets.forEach((a) => {
        map[a.id] = a;
      });
      setMediaAssetMap(map);
    });
    return unsub;
  }, []);

  const filteredItems = useMemo(() => {
    const base = allItems.filter((item) => {
      const asset = mediaAssetMap[item.id];
      const matchesType = filterType === 'ALL' || item.type === filterType;
      const matchesStatus = matchesIntelStatusFilter(item, statusFilter, asset);
      if (!matchesIntelScope(item, campaignScope)) return false;
      return matchesType && matchesStatus;
    });
    return controls.apply(
      base,
      (item, q) =>
        (item.title || '').toLowerCase().includes(q) ||
        (item.id || '').toLowerCase().includes(q) ||
        (item.description || '').toLowerCase().includes(q),
    );
  }, [allItems, filterType, statusFilter, mediaAssetMap, campaignScope, controls.apply]);

  // Trocar busca ou filtro limpa a seleção; remoções e sync descartam o que sumiu (M03).
  useEffect(() => {
    selection.clear();
  }, [search, filterType, statusFilter, campaignScope, selection.clear]);
  useEffect(() => {
    selection.prune(filteredItems.map((i) => i.id));
  }, [filteredItems, selection.prune]);

  const typeStats = useMemo(() => {
    const stats: Record<string, number> = { AUDIO: 0, TEXT: 0, VISUAL: 0, META: 0, VIDEO: 0, total: 0 };
    allItems.forEach((item) => {
      stats[item.type]++;
      stats.total++;
    });
    return stats;
  }, [allItems]);

  const handleNewItem = useCallback((campaignId?: string) => {
    setEditingItem(null);
    setFormData({
      id: `item-${Date.now()}`,
      ...EMPTY_ITEM,
      campaignId: campaignId ?? scopedCampaignId,
    });
    setYoutubeInput('');
    setShowEditor(true);
    setFeedback(null);
  }, [scopedCampaignId]);

  /** Abre o editor já vinculado a um MediaAsset (fluxo unificado upload → intel). */
  const openEditorFromAsset = useCallback((asset: MediaAsset, existing?: IntelItem | null) => {
    const detectedType: IntelType =
      asset.type === 'video' ? 'VIDEO' : asset.type === 'audio' ? 'AUDIO' : asset.type === 'image' ? 'VISUAL' : 'TEXT';
    const title = existing?.title || asset.metadata.title || asset.filename.replace(/\.[^/.]+$/, '');
    setEditingItem(existing || null);
    setFormData({
      id: asset.id,
      ...EMPTY_ITEM,
      type: existing?.type || detectedType,
      level: existing?.level || 2,
      title,
      description: existing?.description || '',
      textContent: existing?.textContent || '',
      mediaUrl: asset.url,
      campaignId: existing ? existing.campaignId : scopedCampaignId,
      metadata: {
        ...EMPTY_ITEM.metadata,
        ...existing?.metadata,
        videoSource: asset.type === 'video' ? 'upload' : existing?.metadata?.videoSource,
        youtubeId: asset.type === 'video' ? undefined : existing?.metadata?.youtubeId,
        duration: asset.metadata.duration || existing?.metadata?.duration || 0,
        visualCategory: existing?.metadata?.visualCategory,
      },
    });
    setYoutubeInput('');
    setFocusedIntelId(asset.id);
    setShowEditor(true);
    setFeedback(null);
  }, [scopedCampaignId]);

  const handleMediaSelect = useCallback((asset: MediaAsset) => {
    const keepVideo = formData.type === 'VIDEO' || asset.type === 'video';
    const detectedType = keepVideo ? 'VIDEO' : detectTypeFromUrlWithYoutube(asset.url);
    setFormData((prev) => ({
      ...prev,
      mediaUrl: asset.url,
      type: detectedType,
      title: prev.title || asset.metadata.title || asset.filename,
      metadata: {
        ...prev.metadata,
        videoSource: asset.type === 'video' ? 'upload' : prev.metadata?.videoSource,
        youtubeId: undefined,
        duration: asset.metadata.duration || prev.metadata?.duration,
      },
    }));
  }, [formData.type]);

  const handleMediaFileUpload = useCallback(async (files: FileList | null) => {
    if (!files?.[0]) return;
    const file = files[0];
    const isVideo = file.type.startsWith('video/');
    const isAudio = file.type.startsWith('audio/');
    const isImage = file.type.startsWith('image/');
    if (!isVideo && !isAudio && !isImage) {
      setFeedback({ type: 'error', text: 'Selecione áudio, imagem ou vídeo.' });
      return;
    }
    setMediaUploading(true);
    setFeedback(null);
    try {
      const asset = await mediaService.uploadMedia(file, 'mestre');
      const detectedType: IntelType = isVideo ? 'VIDEO' : isAudio ? 'AUDIO' : 'VISUAL';
      setFormData((prev) => {
        const useAssetId = !editingItem && (prev.id.startsWith('item-') || !prev.mediaUrl);
        return {
          ...prev,
          id: useAssetId ? asset.id : prev.id,
          type: detectedType,
          mediaUrl: asset.url,
          title: prev.title || asset.metadata.title || file.name.replace(/\.[^/.]+$/, ''),
          metadata: {
            ...prev.metadata,
            videoSource: isVideo ? 'upload' : prev.metadata?.videoSource,
            youtubeId: isVideo ? undefined : prev.metadata?.youtubeId,
            duration: asset.metadata.duration || prev.metadata?.duration,
          },
        };
      });
      if (isVideo) setYoutubeInput('');
      setFeedback({ type: 'success', text: 'Arquivo enviado com sucesso.' });
    } catch (err) {
      console.error('[IntelCatalog] Media upload failed:', err);
      setFeedback({ type: 'error', text: 'Falha no upload.' });
    } finally {
      setMediaUploading(false);
      if (mediaFileInputRef.current) mediaFileInputRef.current.value = '';
      if (videoFileInputRef.current) videoFileInputRef.current.value = '';
    }
  }, [editingItem]);

  const handleDeleteFileOnly = useCallback(async (item: IntelItem) => {
    const asset = mediaAssetMap[item.id];
    if (!asset?.storagePath) {
      setFeedback({ type: 'error', text: 'Este item não possui arquivo no Storage.' });
      return;
    }
    const ok = await showConfirm(
      'Remover arquivo',
      `Remover apenas o arquivo "${asset.filename}" do Storage? A entrada no catálogo também será removida.`,
      'Remover arquivo',
    );
    if (!ok) return;
    try {
      await mediaService.deleteMedia(asset);
      intelRegistry.unregister(item.id);
      refreshItems();
      setFeedback({ type: 'success', text: `✓ Arquivo de "${item.title}" removido.` });
    } catch (err) {
      console.error('[IntelCatalog] File delete failed:', err);
      setFeedback({ type: 'error', text: 'Falha ao remover arquivo.' });
    }
  }, [mediaAssetMap, showConfirm, refreshItems]);

  /** Outro item do catálogo (fora de `ignoreIds`) aponta para o mesmo arquivo. */
  const isFileSharedElsewhere = useCallback(
    (item: IntelItem, ignoreIds: ReadonlySet<string>) =>
      !!item.mediaUrl &&
      allItems.some((o) => o.id !== item.id && !ignoreIds.has(o.id) && o.mediaUrl === item.mediaUrl),
    [allItems],
  );

  const storageCheckbox = useCallback(
    (shared: boolean) => ({
      label: t('intel.delete.storageCheckbox', { defaultValue: 'Apagar também o arquivo do Storage' }),
      defaultChecked: !shared,
      ...(shared
        ? {
            hint: t('intel.delete.sharedFileWarning', {
              defaultValue: 'Outra intel usa este mesmo arquivo. Apagá-lo quebra essa intel.',
            }),
          }
        : {}),
    }),
    [t],
  );

  const handleDeleteItem = useCallback(async (item: IntelItem) => {
    const hasFile = !!mediaAssetMap[item.id]?.storagePath;
    const shared = hasFile && isFileSharedElsewhere(item, new Set());
    const { confirmed, checked } = await showConfirmWithOption(
      'Remover Intel',
      `Remover "${item.title}" do catálogo? Jogadores que já possuem o item mantêm no inventário.`,
      'Remover',
      { danger: true, ...(hasFile ? { checkbox: storageCheckbox(shared) } : {}) },
    );
    if (!confirmed) return;
    const deleteFile = hasFile && checked;
    setIsLoading(true);
    try {
      await intelService.deleteIntel(item, { deleteStorageFile: deleteFile });
      refreshItems();
      setFeedback({ type: 'success', text: `✓ "${item.title}" removido do catálogo.` });
    } catch (err) {
      console.error('[IntelCatalog] Delete failed:', err);
      setFeedback({ type: 'error', text: 'Falha ao remover item.' });
    } finally {
      setIsLoading(false);
    }
  }, [showConfirmWithOption, refreshItems, mediaAssetMap, isFileSharedElsewhere, storageCheckbox]);

  /** Remove vários itens com uma única confirmação; falhas por item vão para um só toast. */
  const handleBulkDelete = useCallback(async (items: IntelItem[]) => {
    if (items.length === 0 || bulkBusy) return;
    const ids = new Set(items.map((i) => i.id));
    const withFile = items.filter((i) => mediaAssetMap[i.id]?.storagePath);
    const shared = withFile.some((i) => isFileSharedElsewhere(i, ids));
    const { confirmed, checked } = await showConfirmWithOption(
      t('bulk.remove', { defaultValue: 'Remover itens' }),
      t('bulk.removeBody', {
        count: items.length,
        defaultValue: 'Remover {{count}} itens do catálogo? Jogadores que já possuem os itens mantêm no inventário.',
      }),
      t('bulk.remove', { defaultValue: 'Remover' }),
      { danger: true, ...(withFile.length > 0 ? { checkbox: storageCheckbox(shared) } : {}) },
    );
    if (!confirmed) return;
    setBulkBusy(true);
    setIsLoading(true);
    let ok = 0;
    let failed = 0;
    for (const item of items) {
      const deleteFile = checked && !!mediaAssetMap[item.id]?.storagePath;
      try {
        await intelService.deleteIntel(item, { deleteStorageFile: deleteFile });
        ok++;
      } catch (err) {
        console.error('[IntelCatalog] Bulk delete failed:', item.id, err);
        failed++;
      }
    }
    refreshItems();
    selection.clear();
    setIsLoading(false);
    setBulkBusy(false);
    if (failed === 0) toast.success(t('bulk.result', { ok, total: items.length, defaultValue: '{{ok}} de {{total}} itens processados' }));
    else toast.error(t('bulk.resultPartial', { ok, failed, defaultValue: '{{ok}} processados, {{failed}} falharam' }));
  }, [bulkBusy, mediaAssetMap, isFileSharedElsewhere, showConfirmWithOption, storageCheckbox, t, refreshItems, selection, toast]);

  /** Grava `campaignId` nos itens pelo mesmo caminho do editor (`persistChanges`). `null` desvincula. */
  const handleBulkLink = useCallback(async (items: IntelItem[], campaignId: string | null) => {
    if (items.length === 0 || bulkBusy) return;
    setBulkBusy(true);
    let ok = 0;
    let failed = 0;
    for (const item of items) {
      const next: IntelItem = { ...item };
      if (campaignId) next.campaignId = campaignId;
      else delete next.campaignId;
      try {
        await intelService.persistChanges(next);
        ok++;
      } catch (err) {
        console.error('[IntelCatalog] Bulk link failed:', item.id, err);
        failed++;
      }
    }
    refreshItems();
    selection.clear();
    setBulkBusy(false);
    if (failed === 0) toast.success(t('bulk.result', { ok, total: items.length, defaultValue: '{{ok}} de {{total}} itens processados' }));
    else toast.error(t('bulk.resultPartial', { ok, failed, defaultValue: '{{ok}} processados, {{failed}} falharam' }));
  }, [bulkBusy, refreshItems, selection, t, toast]);

  const handleApplyYoutubeLink = useCallback(() => {
    const url = youtubeInput.trim();
    const id = extractYoutubeId(url);
    if (!id) {
      setFeedback({ type: 'error', text: 'URL do YouTube inválida.' });
      return;
    }
    setFormData((prev) => ({
      ...prev,
      type: 'VIDEO',
      mediaUrl: youtubeWatchUrl(id),
      title: prev.title || `YouTube — ${id}`,
      metadata: {
        ...prev.metadata,
        videoSource: 'youtube',
        youtubeId: id,
      },
    }));
    setFeedback({ type: 'success', text: 'Link do YouTube vinculado.' });
  }, [youtubeInput]);

  /** Preenche o editor com `item`; `copy` abre em modo criação com id novo e título "(cópia)". */
  const openEditorWith = useCallback((item: IntelItem, copy: boolean) => {
    setEditingItem(copy ? null : item);
    setFocusedIntelId(copy ? null : item.id);
    setFormData({
      id: copy ? `item-${Date.now()}` : item.id,
      type: item.type,
      level: item.level,
      title: copy ? `${item.title} ${tc('copySuffix', { defaultValue: '(cópia)' })}` : item.title,
      description: item.description,
      textContent: item.textContent || '',
      mediaUrl: item.mediaUrl || '',
      campaignId: item.campaignId,
      metadata: {
        npc: item.metadata?.npc || '',
        artist: item.metadata?.artist || '',
        chapter: item.metadata?.chapter || '',
        duration: item.metadata?.duration || 0,
        isSecret: item.metadata?.isSecret || false,
        visualCategory: item.metadata?.visualCategory,
        imageUrl: item.metadata?.imageUrl || '',
        icon: item.metadata?.icon || '',
        hint: item.metadata?.hint || '',
        unlockCondition: item.metadata?.unlockCondition || '',
        achievementRuleId: item.metadata?.achievementRuleId || '',
        videoFormat: item.metadata?.videoFormat || 'VHS',
        videoSource: item.metadata?.videoSource,
        youtubeId: item.metadata?.youtubeId,
      },
    });
    setYoutubeInput(
      item.metadata?.youtubeId
        ? youtubeWatchUrl(item.metadata.youtubeId)
        : item.type === 'VIDEO' && isYoutubeUrl(item.mediaUrl || '')
          ? item.mediaUrl || ''
          : '',
    );
    setShowEditor(true);
    setFeedback(null);
  }, [tc]);

  const handleEditItem = useCallback((item: IntelItem) => openEditorWith(item, false), [openEditorWith]);
  /**
   * Duplica como item novo. Só a URL do arquivo é copiada (a cópia não ganha `storagePath`),
   * então apagar a cópia nunca apaga o arquivo da origem.
   */
  const handleDuplicateItem = useCallback((item: IntelItem) => openEditorWith(item, true), [openEditorWith]);

  const focusAsset = useCallback((assetId: string) => {
    setFocusedIntelId(assetId);
    const item = allItems.find((i) => i.id === assetId);
    if (item) {
      setStatusFilter('all');
      setFilterType('ALL');
      setSearch(item.id);
    }
  }, [allItems]);

  const handleSave = useCallback(async () => {
    if (!formData.id.trim() || !formData.title.trim()) {
      setFeedback({ type: 'error', text: 'ID e Título são obrigatórios.' });
      return;
    }
    const cleanMeta = { ...formData.metadata };

    if (formData.type === 'VIDEO' && formData.mediaUrl) {
      const ytId = extractYoutubeId(formData.mediaUrl);
      if (ytId) {
        cleanMeta.videoSource = 'youtube';
        cleanMeta.youtubeId = ytId;
      } else if (!cleanMeta.videoSource) {
        cleanMeta.videoSource = 'upload';
        delete cleanMeta.youtubeId;
      }
    }

    Object.keys(cleanMeta).forEach((key) => {
      const val = (cleanMeta as Record<string, unknown>)[key];
      if (val === '' || val === 0 || val === false || val === undefined) {
        delete (cleanMeta as Record<string, unknown>)[key];
      }
    });
    const intelItem: IntelItem = {
      id: formData.id.trim(),
      type: formData.type,
      level: formData.level,
      title: formData.title.trim(),
      description: formData.description.trim(),
      ...(formData.textContent ? { textContent: formData.textContent } : {}),
      ...(formData.mediaUrl ? { mediaUrl: formData.mediaUrl } : {}),
      ...(formData.campaignId ? { campaignId: formData.campaignId } : {}),
      ...(Object.keys(cleanMeta).length > 0 ? { metadata: cleanMeta } : {}),
    };

    if (isSaving) return;
    setIsSaving(true);
    setIsLoading(true);
    try {
      await intelService.persistChanges(intelItem);
      refreshItems();
      setShowEditor(false);
      setFeedback({
        type: 'success',
        text: `✓ "${intelItem.title}" ${editingItem ? 'atualizado' : 'registrado'} com sucesso.`,
      });
    } catch (err) {
      console.error('Save error:', err);
      setFeedback({ type: 'error', text: 'Falha ao persistir alterações no Firebase.' });
    } finally {
      setIsLoading(false);
      setIsSaving(false);
    }
  }, [formData, editingItem, refreshItems, isSaving]);

  const updateField = useCallback((field: string, value: unknown) => {
    setFormData((prev) => {
      const newData = { ...prev, [field]: value } as IntelFormData;
      if (field === 'mediaUrl' && typeof value === 'string' && value) {
        newData.type = detectTypeFromUrl(value);
      }
      return newData;
    });
  }, []);

  const updateMeta = useCallback((field: string, value: unknown) => {
    setFormData((prev) => ({
      ...prev,
      metadata: { ...prev.metadata, [field]: value },
    }));
  }, []);

  const exportJSON = useMemo(
    () => JSON.stringify(intelRegistry.getAll(), null, 2),
    [showExport, allItems],
  );

  return {
    modal,
    allItems,
    filteredItems,
    mediaAssetMap,
    search,
    setSearch,
    filterType,
    setFilterType,
    statusFilter,
    setStatusFilter,
    sortKey,
    setSortKey,
    selection,
    bulkBusy,
    isSaving,
    campaignScope,
    showEditor,
    setShowEditor,
    editingItem,
    formData,
    feedback,
    setFeedback,
    showExport,
    setShowExport,
    isLoading,
    qrCodeModal,
    setQrCodeModal,
    isMediaSelectorOpen,
    setIsMediaSelectorOpen,
    youtubeInput,
    setYoutubeInput,
    mediaUploading,
    focusedIntelId,
    setFocusedIntelId,
    focusAsset,
    videoFileInputRef,
    mediaFileInputRef,
    typeStats,
    handleNewItem,
    openEditorFromAsset,
    handleMediaSelect,
    handleMediaFileUpload,
    handleDeleteFileOnly,
    handleDeleteItem,
    handleBulkDelete,
    handleBulkLink,
    handleApplyYoutubeLink,
    handleEditItem,
    handleDuplicateItem,
    handleSave,
    updateField,
    updateMeta,
    exportJSON,
  };
}
