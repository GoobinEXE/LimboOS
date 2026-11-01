import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { NpcContact } from '../../types/npcSms';
import { useNpcSmsCatalog } from '../../hooks/useNpcSmsCatalog';
import { npcSmsCatalogService } from '../../services/NpcSmsCatalogService';
import { useToast } from '../components/ToastProvider';
import { useModal } from '../components/ConfirmModal';
import { useAdminCampaigns } from './useAdminCampaigns';
import NpcContactEditorModal from '../components/NpcContactEditorModal';

export function emptyNpcContact(campaignId?: string): NpcContact {
  return {
    id: '',
    name: '',
    number: '',
    campaignIds: campaignId ? [campaignId] : 'global',
    enabled: true,
    source: 'custom',
  };
}

/**
 * O primeiro registro remoto substitui as sugestões em memória (contatos e
 * diálogos são trocados juntos pelo serviço): importa antes de criar.
 */
export async function ensureNpcCatalogImported(
  hasRemote: boolean,
  showConfirm: (title: string, message: string, confirmLabel?: string) => Promise<boolean>,
  onImportFail: () => void,
  t: TFunction<'admin'>,
): Promise<boolean> {
  if (hasRemote) return true;
  const ok = await showConfirm(
    t('npcSms.firstCreateTitle'),
    t('npcSms.firstCreateBody'),
    t('npcSms.firstCreateAction'),
  );
  if (!ok) return false;
  try {
    await npcSmsCatalogService.importSuggestions();
    return true;
  } catch (err) {
    console.error(err);
    onImportFail();
    return false;
  }
}

/**
 * Editor de contato de NPC reutilizável (catálogo em Conteúdo e página da missão).
 * Devolve os gatilhos e o nó a renderizar.
 */
export function useNpcContactEditor() {
  const { t } = useTranslation('admin');
  const toast = useToast();
  const { showConfirm, modal } = useModal();
  const { hasRemoteContacts } = useNpcSmsCatalog();
  const { campaigns } = useAdminCampaigns();

  const [contactEditor, setContactEditor] = useState<NpcContact | null>(null);
  const [isEdit, setIsEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  /** `campaignId`: o novo NPC já nasce vinculado à missão. */
  const openCreate = useCallback((campaignId?: string) => {
    setIsEdit(false);
    setContactEditor(emptyNpcContact(campaignId));
    setAvatarFile(null);
  }, []);

  const openEdit = useCallback((c: NpcContact) => {
    setIsEdit(true);
    setContactEditor({ ...c });
    setAvatarFile(null);
  }, []);

  const saveContact = async () => {
    if (!contactEditor) return;
    const id = contactEditor.id.trim().toUpperCase().replace(/\s+/g, '_');
    if (!id || !contactEditor.name.trim()) {
      toast.error(t('npcSms.validationContact'));
      return;
    }
    if (
      !isEdit &&
      !(await ensureNpcCatalogImported(hasRemoteContacts, showConfirm, () => toast.error(t('npcSms.importFail')), t))
    ) {
      return;
    }
    setSaving(true);
    setUploadProgress(avatarFile ? 0 : null);
    try {
      let avatarUrl = contactEditor.avatarUrl;
      if (avatarFile) {
        avatarUrl = await npcSmsCatalogService.uploadAvatar(id, avatarFile, (p) =>
          setUploadProgress(p),
        );
      }
      const payload = {
        ...contactEditor,
        id,
        name: contactEditor.name.trim(),
        number: contactEditor.number.trim(),
        avatarUrl,
        source: isEdit ? contactEditor.source : ('custom' as const),
      };
      if (isEdit) {
        const { id: _id, source: _s, ...patch } = payload;
        await npcSmsCatalogService.updateContact(id, patch);
      } else {
        await npcSmsCatalogService.createContact(payload);
      }
      toast.success(t('npcSms.saveOk'));
      setContactEditor(null);
    } catch (err) {
      console.error(err);
      toast.error(t('npcSms.saveFail'));
    } finally {
      setSaving(false);
      setUploadProgress(null);
    }
  };

  const editor = (
    <>
      {modal}
      {contactEditor && (
        <NpcContactEditorModal
          contact={contactEditor}
          isEdit={isEdit}
          saving={saving}
          uploadProgress={uploadProgress}
          avatarFile={avatarFile}
          campaigns={campaigns}
          onChange={setContactEditor}
          onAvatarFile={setAvatarFile}
          onClose={() => setContactEditor(null)}
          onSave={() => void saveContact()}
        />
      )}
    </>
  );

  return { openCreate, openEdit, editor };
}
