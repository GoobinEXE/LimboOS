import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { dialogPop } from '../lib/motion';
import { Campaign } from '../../data/campaigns';
import { Group, MasterAccount, CharacterData } from '../../types/player';
import { campaignAdminService } from '../../services/CampaignAdminService';
import { useModal } from './ConfirmModal';
import OverlayPortal from './OverlayPortal';
import MissionDataTab from './mission/MissionDataTab';
import MissionAccessTab from './mission/MissionAccessTab';
import MissionInventoryTab from './mission/MissionInventoryTab';
import MissionVideoTab from './mission/MissionVideoTab';
import MissionResourcesTab from './mission/MissionResourcesTab';
import { MissionTabId, MISSION_TAB_ORDER } from './mission/types';
import type { CampaignResourceSummary } from '../lib/campaignResources';
import { NEW_MISSION_SEGMENT, type CampaignScopedArea } from '../lib/adminNavigation';

/** Slug vira segmento de URL: sem barra, sem espaço e diferente de `new`. */
function isValidMissionSlug(id: string): boolean {
  return id !== NEW_MISSION_SEGMENT && /^[^\s/?#]+$/.test(id);
}

interface MissionCommandModalProps {
  open: boolean;
  campaign: Partial<Campaign> | null;
  /** Aba ativa, controlada pela rota (`/admin/missions/:id/:seção`). */
  activeTab: MissionTabId;
  onTabChange: (tab: MissionTabId) => void;
  /** Criação (`/admin/missions/new`): só Dados até salvar. */
  isNewMission: boolean;
  groups: Group[];
  allCharacters: { account: MasterAccount; character: CharacterData }[];
  onClose: () => void;
  onSaved?: (campaign: Campaign) => void;
  /** Recursos modulares já vinculados a esta missão (aba Recursos). */
  resourceSummary?: CampaignResourceSummary | null;
  /** Leva ao catálogo do recurso filtrado pela missão; fecha o modal. */
  onOpenScoped?: (area: CampaignScopedArea, campaignId: string, create?: boolean) => void;
  onCharacterUpdate?: (
    updater: (
      prev: { account: MasterAccount; character: CharacterData }[]
    ) => { account: MasterAccount; character: CharacterData }[]
  ) => void;
}


export default function MissionCommandModal({
  open,
  campaign,
  activeTab,
  onTabChange,
  isNewMission,
  groups,
  allCharacters,
  onClose,
  onSaved,
  onCharacterUpdate,
  resourceSummary,
  onOpenScoped,
}: MissionCommandModalProps) {
  const { t } = useTranslation('admin');
  const { showAlert, modal } = useModal();
  const [editingCampaign, setEditingCampaign] = useState<Partial<Campaign> | null>(null);
  const [isPersisted, setIsPersisted] = useState(false);
  const [saving, setSaving] = useState(false);

  const isNew = isNewMission;

  // Só reinicia o rascunho quando a missão muda; trocar de aba não perde edição
  useEffect(() => {
    if (!open || !campaign) return;
    setEditingCampaign({ ...campaign });
    setIsPersisted(!isNewMission);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, campaign]);

  const setActiveTab = onTabChange;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCampaign?.name || !editingCampaign?.id) return;
    if (isNew && !isPersisted && !isValidMissionSlug(editingCampaign.id)) {
      showAlert('Erro', t('missions.toast.invalidSlug'));
      return;
    }

    setSaving(true);
    try {
      await campaignAdminService.saveCampaign(
        editingCampaign as Partial<Campaign> & { id: string; name: string }
      );
      setIsPersisted(true);
      const saved = editingCampaign as Campaign;
      // Missão recém-criada: o pai troca a rota para a aba Recursos, que mostra o que falta
      onSaved?.(saved);
      showAlert('Sucesso', t('missions.toast.saved'));
    } catch (error) {
      console.error('Erro ao salvar campanha:', error);
      showAlert('Erro', t('missions.toast.saveFail'));
    } finally {
      setSaving(false);
    }
  };

  const persistedCampaign = editingCampaign as Campaign | null;
  const tabsLocked = !isPersisted || !persistedCampaign?.id;

  if (!open || !editingCampaign) return null;

  return (
    <OverlayPortal open={open} onClose={onClose}>
      <div className="fixed inset-0 z-[150] flex items-center justify-center bg-surface-scrim p-4 animate-fade-in">
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="mission-command-title"
          variants={dialogPop}
          initial="hidden"
          animate="visible"
          className="bg-surface-container-low border border-seam w-full max-w-5xl rounded-panel shadow-2xl machined-edge flex flex-col h-[90vh] relative overflow-hidden"
        >
          <div className="p-6 border-b border-border-subtle flex justify-between items-center bg-black/40 shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-1 self-stretch bg-accent shrink-0" />
              <div>
                {/* Selo dentro do cabeçalho: fora dele seria cortado pelo overflow do painel */}
                <span className="inline-block mb-1.5 bg-primary px-1.5 py-px text-[9px] font-display font-bold text-black tracking-widest uppercase">
                  {isNew && !isPersisted ? t('missions.modal.install') : t('missions.modal.commandBadge')}
                </span>
                <h3 id="mission-command-title" className="font-display font-bold text-xl text-bone uppercase tracking-tight">
                  {editingCampaign.name || t('missions.modal.newTitle')}
                </h3>
                <p className="text-[10px] font-display font-bold text-ash-500 uppercase tracking-widest mt-0.5">
                  {t('missions.modal.commandSubtitle')}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('close', { ns: 'common' })}
              className="lmb-btn lmb-btn-ghost lmb-btn-icon material-symbols-outlined text-[20px] tracking-normal normal-case"
            >
              close
            </button>
          </div>

          <div role="tablist" className="flex border-b border-seam bg-surface-container-lowest shrink-0">
            {MISSION_TAB_ORDER.map((tab) => {
              const locked = tab !== 'dados' && tabsLocked;
              return (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab}
                  disabled={locked}
                  onClick={() => !locked && setActiveTab(tab)}
                  className={`flex-1 py-4 text-[10px] font-display font-bold uppercase tracking-[0.15em] transition ${
                    activeTab === tab
                      ? 'text-primary bg-accent-05 shadow-[inset_0_-2px_0_var(--color-accent)]'
                      : locked
                        ? 'text-ash-700 cursor-not-allowed'
                        : 'text-ash-500 hover:text-bone hover:bg-white/5'
                  }`}
                  title={locked ? t('missions.modal.saveFirst') : undefined}
                >
                  {t(`missions.tab.${tab}`)}
                </button>
              );
            })}
          </div>

          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar relative z-10">
            {modal}
            {activeTab === 'dados' && (
              <MissionDataTab
                campaign={editingCampaign}
                isNew={isNew && !isPersisted}
                onChange={setEditingCampaign}
                onSave={handleSave}
                onCancel={onClose}
                saving={saving}
              />
            )}
            {activeTab === 'recursos' && persistedCampaign && resourceSummary && (
              <MissionResourcesTab
                campaign={editingCampaign}
                summary={resourceSummary}
                onGoToTab={setActiveTab}
                onOpenScoped={(area, create) => onOpenScoped?.(area, persistedCampaign.id, create)}
              />
            )}
            {activeTab === 'vinculos' && persistedCampaign && (
              <MissionAccessTab
                campaign={persistedCampaign}
                groups={groups}
                allCharacters={allCharacters}
                showAlert={showAlert}
                onCharacterAssigned={(uid, charId, campaignId) => {
                  onCharacterUpdate?.((prev) =>
                    prev.map((c) =>
                      c.character.id === charId && c.account.uid === uid
                        ? { ...c, character: { ...c.character, campaignId } }
                        : c
                    )
                  );
                }}
                onCharacterUnassigned={(uid, charId) => {
                  onCharacterUpdate?.((prev) =>
                    prev.map((c) =>
                      c.character.id === charId && c.account.uid === uid
                        ? { ...c, character: { ...c.character, campaignId: undefined } }
                        : c
                    )
                  );
                }}
              />
            )}
            {activeTab === 'inventario' && persistedCampaign && (
              <MissionInventoryTab
                campaign={persistedCampaign}
                groups={groups}
                allCharacters={allCharacters}
              />
            )}
            {activeTab === 'transmissao' && persistedCampaign && (
              <MissionVideoTab
                campaign={persistedCampaign}
                groups={groups}
                allCharacters={allCharacters}
              />
            )}
          </div>
        </motion.div>
      </div>
    </OverlayPortal>
  );
}
