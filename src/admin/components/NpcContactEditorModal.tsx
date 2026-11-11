import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Campaign } from '../../data/campaigns';
import type { NpcContact } from '../../types/npcSms';
import CampaignBindingPicker from './CampaignBindingPicker';

export const npcFieldClass =
  'w-full bg-black/50 text-[11px] font-bold uppercase px-3 py-2.5 text-bone outline-none rounded-sm';
export const npcLabelClass = 'text-[10px] font-black uppercase tracking-wider text-ash-500 mb-1.5 block';

const fieldClass = npcFieldClass;
const labelClass = npcLabelClass;

interface NpcContactEditorModalProps {
  contact: NpcContact;
  isEdit: boolean;
  saving: boolean;
  uploadProgress: number | null;
  avatarFile: File | null;
  campaigns: Campaign[];
  onChange: (contact: NpcContact) => void;
  onAvatarFile: (file: File | null) => void;
  onClose: () => void;
  onSave: () => void;
}

/** Formulário do contato de NPC (catálogo em Conteúdo e página da missão). */
export default function NpcContactEditorModal({
  contact,
  isEdit,
  saving,
  uploadProgress,
  avatarFile,
  campaigns,
  onChange,
  onAvatarFile,
  onClose,
  onSave,
}: NpcContactEditorModalProps) {
  const { t } = useTranslation('admin');

  return (
    <div
      className="fixed inset-0 z-[9000] flex items-center justify-center bg-surface-scrim p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div className="bg-seam w-full max-w-lg rounded-card overflow-hidden">
        <div className="px-6 py-4 border-b border-seam flex justify-between items-center bg-black/40">
          <h3 className="text-xs font-black uppercase tracking-[0.08em] text-bone">
            {isEdit ? t('npcSms.editContact') : t('npcSms.createContact')}
          </h3>
          <button type="button" onClick={() => !saving && onClose()} className="material-symbols-outlined text-ash-500">
            close
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex gap-4">
            <div className="shrink-0 space-y-2">
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-black flex items-center justify-center">
                {avatarFile || contact.avatarUrl ? (
                  <img
                    src={avatarFile ? URL.createObjectURL(avatarFile) : contact.avatarUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="material-symbols-outlined text-ash-600">person</span>
                )}
              </div>
              <label className="block cursor-pointer text-[10px] font-black uppercase tracking-wider text-secondary px-2 py-1.5 text-center rounded-sm">
                {t('npcSms.avatar')}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onAvatarFile(e.target.files?.[0] || null)}
                />
              </label>
              {uploadProgress != null && (
                <p className="text-[10px] text-ash-500 font-mono">{Math.round(uploadProgress)}%</p>
              )}
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <label className={labelClass}>ID</label>
                <input
                  className={fieldClass}
                  disabled={isEdit}
                  value={contact.id}
                  placeholder="NIL_ECHO"
                  onChange={(e) => onChange({ ...contact, id: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass}>{t('npcSms.name')}</label>
                <input
                  className={fieldClass}
                  value={contact.name}
                  onChange={(e) => onChange({ ...contact, name: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass}>{t('npcSms.number')}</label>
                <input
                  className={fieldClass}
                  value={contact.number}
                  placeholder="(11) 92003-0100"
                  onChange={(e) => onChange({ ...contact, number: e.target.value })}
                />
              </div>
              <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-ash-400">
                <input
                  type="checkbox"
                  checked={contact.enabled}
                  onChange={(e) =>
                    onChange({ ...contact, enabled: e.target.checked })
                  }
                />
                {t('npcSms.active')}
              </label>
            </div>
          </div>
          <div className="border-t border-seam pt-4">
            <CampaignBindingPicker
              label={t('npcSms.campaigns')}
              hint={t('npcSms.campaignsGlobalHint')}
              value={contact.campaignIds}
              campaigns={campaigns}
              onChange={(next) => onChange({ ...contact, campaignIds: next })}
            />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-seam flex gap-3 bg-black/40">
          <button
            type="button"
            disabled={saving}
            onClick={() => onClose()}
            className="flex-1 px-4 py-3 text-[10px] font-black uppercase tracking-wider text-ash-500 bg-[#333] rounded-sm"
          >
            {t('npcSms.cancel')}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onSave}
            className="flex-1 px-4 py-3 text-[10px] font-black uppercase tracking-wider bg-primary text-black rounded-sm disabled:opacity-40"
          >
            {saving ? '…' : t('npcSms.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
