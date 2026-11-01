import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { Campaign } from '../../../data/campaigns';
import MediaSelectorModal from '../MediaSelectorModal';
import IntelEditorModal from './IntelEditorModal';
import { useToast } from '../ToastProvider';
import type { useIntelCatalog } from '../../hooks/useIntelCatalog';

interface IntelEditorHostProps {
  intel: ReturnType<typeof useIntelCatalog>;
  campaigns: Campaign[];
  /**
   * Fora de Conteúdo não há a faixa de feedback do catálogo: as mensagens do
   * editor (salvo, erro de upload) viram toast.
   */
  toastFeedback?: boolean;
}

/** Editor de intel + seletor da biblioteca de mídia, reutilizável fora de Conteúdo. */
export default function IntelEditorHost({ intel, campaigns, toastFeedback = false }: IntelEditorHostProps) {
  const { t } = useTranslation('admin');
  const toast = useToast();
  const { feedback, setFeedback } = intel;

  useEffect(() => {
    if (!toastFeedback || !feedback) return;
    if (feedback.type === 'success') toast.success(feedback.text);
    else toast.error(feedback.text);
    setFeedback(null);
  }, [toastFeedback, feedback, setFeedback, toast]);

  return (
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
        campaigns={campaigns}
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
    </>
  );
}
