import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { intelRegistry } from '../../data/intel_registry';
import { intelService } from '../../services/IntelService';
import type { IntelItem, IntelType } from '../../types/intel';
import { MediaAsset } from '../../types/media';
import { mediaService } from '../../services/MediaService';
import { extractYoutubeId, isYoutubeUrl, youtubeWatchUrl } from '../../lib/youtube';
import { useModal } from '../components/ConfirmModal';
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

export function useIntelCatalog() {
  const { showConfirm, modal } = useModal();
  const [allItems, setAllItems] = useState<IntelItem[]>(() => intelRegistry.getAll());
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<IntelType | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<IntelStatusFilter>('all');
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
    return allItems.filter((item) => {
      const asset = mediaAssetMap[item.id];
      const matchesType = filterType === 'ALL' || item.type === filterType;
      const matchesStatus = matchesIntelStatusFilter(item, statusFilter, asset);
      const matchesSearch =
        search === '' ||
        (item.title || '').toLowerCase().includes(search.toLowerCase()) ||
        (item.id || '').toLowerCase().includes(search.toLowerCase()) ||
        (item.description || '').toLowerCase().includes(search.toLowerCase());
      return matchesType && matchesStatus && matchesSearch;
    });
  }, [allItems, search, filterType, statusFilter, mediaAssetMap]);

  const typeStats = useMemo(() => {
    const stats: Record<string, number> = { AUDIO: 0, TEXT: 0, VISUAL: 0, META: 0, VIDEO: 0, total: 0 };
    allItems.forEach((item) => {
      stats[item.type]++;
      stats.total++;
    });
    return stats;
  }, [allItems]);

  const handleNewItem = useCallback(() => {
    setEditingItem(null);
    setFormData({ id: `item-${Date.now()}`, ...EMPTY_ITEM });
    setYoutubeInput('');
    setShowEditor(true);
    setFeedback(null);
  }, []);

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
      campaignId: existing?.campaignId,
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
  }, []);

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
      const asset = await mediaService.uploadMedia(file, 'gm.mpg');
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

  const handleDeleteItem = useCallback(async (item: IntelItem) => {
    const ok = await showConfirm(
      'Remover Intel',
      `Remover "${item.title}" do catálogo? Jogadores que já possuem o item mantêm no inventário. O arquivo no Storage não será removido automaticamente.`,
      'Remover',
    );
    if (!ok) return;
    const deleteFile = await showConfirm(
      'Arquivo de mídia',
      'Deseja também remover o arquivo do Storage (se existir)?',
      'Remover arquivo',
    );
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
  }, [showConfirm, refreshItems]);

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

  const handleEditItem = useCallback((item: IntelItem) => {
    setEditingItem(item);
    setFocusedIntelId(item.id);
    setFormData({
      id: item.id,
      type: item.type,
      level: item.level,
      title: item.title,
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
  }, []);

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
    }
  }, [formData, editingItem, refreshItems]);

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
    handleApplyYoutubeLink,
    handleEditItem,
    handleSave,
    updateField,
    updateMeta,
    exportJSON,
  };
}
