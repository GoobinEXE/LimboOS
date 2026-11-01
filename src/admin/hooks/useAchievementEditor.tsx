import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AchievementDef } from '../../types/achievement';
import { useAchievementCatalog } from '../../hooks/useAchievementCatalog';
import { achievementCatalogService } from '../../services/AchievementCatalogService';
import { useToast } from '../components/ToastProvider';
import { useModal } from '../components/ConfirmModal';
import AchievementEditorModal, {
  emptyAchievementForm,
  formFromDef,
  formToDefInput,
  type AchievementEditorForm,
} from '../components/AchievementEditorModal';

/**
 * Editor de conquista reutilizável (catálogo em Conteúdo e página da missão).
 * Devolve os gatilhos e o nó a renderizar; mantém a confirmação de importar
 * as sugestões antes da primeira conquista remota.
 */
export function useAchievementEditor() {
  const { t } = useTranslation('admin');
  const toast = useToast();
  const { showConfirm, modal } = useModal();
  const { isRemote } = useAchievementCatalog();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<AchievementDef | null>(null);
  const [editorForm, setEditorForm] = useState<AchievementEditorForm>(emptyAchievementForm());
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  /** `campaignId`: a nova conquista já nasce vinculada à missão. */
  const openCreate = useCallback((campaignId?: string) => {
    setEditing(null);
    setEditorForm(emptyAchievementForm(campaignId));
    setEditorOpen(true);
  }, []);

  const openEdit = useCallback((def: AchievementDef) => {
    setEditing(def);
    setEditorForm(formFromDef(def));
    setEditorOpen(true);
  }, []);

  const handleSave = async (form: AchievementEditorForm, file: File | null) => {
    const isEdit = Boolean(editing);
    const source = editing?.source || 'custom';
    let input;
    try {
      input = formToDefInput(form, source);
    } catch {
      toast.error(t('achievements.saveFail'));
      return;
    }
    if (!input.id || !input.title) {
      toast.error(t('achievements.validation'));
      return;
    }
    if (!isRemote && !isEdit) {
      // A primeira conquista no Firestore substitui as sugestões em memória:
      // importa antes para o catálogo não "perder" as sugestões.
      const ok = await showConfirm(
        t('achievements.firstCreateTitle'),
        t('achievements.firstCreateBody'),
        t('achievements.firstCreateAction'),
      );
      if (!ok) return;
      try {
        await achievementCatalogService.importSuggestions();
      } catch (err) {
        console.error(err);
        toast.error(t('achievements.importFail'));
        return;
      }
    }

    setSaving(true);
    setUploadProgress(file ? 0 : null);
    try {
      if (file) {
        const url = await achievementCatalogService.uploadIcon(input.id, file, (pct) =>
          setUploadProgress(pct),
        );
        input.iconUrl = url;
      }

      if (isEdit && editing) {
        const { id: _id, source: _src, ...patch } = input;
        await achievementCatalogService.update(editing.id, patch);
      } else {
        await achievementCatalogService.create({ ...input, source: 'custom' });
      }
      toast.success(t('achievements.saveOk'));
      setEditorOpen(false);
    } catch (err) {
      console.error(err);
      toast.error(t('achievements.saveFail'));
    } finally {
      setSaving(false);
      setUploadProgress(null);
    }
  };

  const editor = (
    <>
      {modal}
      <AchievementEditorModal
        open={editorOpen}
        initial={editorForm}
        isEdit={Boolean(editing)}
        saving={saving}
        uploadProgress={uploadProgress}
        onClose={() => !saving && setEditorOpen(false)}
        onSave={handleSave}
      />
    </>
  );

  return { openCreate, openEdit, editor };
}
