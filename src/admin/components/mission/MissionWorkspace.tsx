import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Campaign } from '../../../data/campaigns';
import type { Group, MasterAccount, CharacterData } from '../../../types/player';
import { campaignAdminService } from '../../../services/CampaignAdminService';
import { useModal } from '../ConfirmModal';
import { useToast } from '../ToastProvider';
import AdminSubTabs from '../AdminSubTabs';
import AdminSectionPanels from '../AdminSectionPanels';
import RetroSpinner from '../../../components/player/RetroSpinner';
import IntelEditorHost from '../intel/IntelEditorHost';
import MissionDataTab from './MissionDataTab';
import MissionResourcesTab from './MissionResourcesTab';
import MissionAccessTab from './MissionAccessTab';
import MissionInventoryTab from './MissionInventoryTab';
import MissionAppsTab from './MissionAppsTab';
import MissionTeamTab from './MissionTeamTab';
import { useAdminScope } from '../../context/AdminScopeContext';
import { useIntelCatalog } from '../../hooks/useIntelCatalog';
import { useAchievementEditor } from '../../hooks/useAchievementEditor';
import { useNpcContactEditor } from '../../hooks/useNpcContactEditor';
import { useAdminCampaigns } from '../../hooks/useAdminCampaigns';
import { useAdminNavigate } from '../../hooks/useAdminRoute';
import {
  MISSION_SECTIONS,
  NEW_MISSION_SEGMENT,
  adminPath,
  type CampaignScopedArea,
  type MissionSectionId,
  type NpcViewId,
} from '../../lib/adminNavigation';
import type { CampaignResourceSummary } from '../../lib/campaignResources';

/** Slug vira segmento de URL: sem barra, sem espaço e diferente de `new`. */
function isValidMissionSlug(id: string): boolean {
  return id !== NEW_MISSION_SEGMENT && /^[^\s/?#]+$/.test(id);
}

interface MissionWorkspaceProps {
  mode: 'new' | 'existing';
  /** Missão persistida; null na criação ou quando o id não existe. */
  campaign: Campaign | null;
  campaignsReady: boolean;
  section: MissionSectionId;
  /** Ponto de partida da criação (estável enquanto a rota for `/new`). */
  blankDraft: Partial<Campaign>;
  /** Rascunho de Dados; null quando não há alteração pendente. */
  draft: Partial<Campaign> | null;
  onDraftChange: (draft: Partial<Campaign> | null) => void;
  onSaved: (campaign: Campaign) => void;
  groups: Group[];
  allCharacters: { account: MasterAccount; character: CharacterData }[];
  resourceSummary: CampaignResourceSummary | null;
  /** Empilha o catálogo filtrado pela missão; Voltar retorna a esta página. */
  onViewCatalog: (area: CampaignScopedArea, campaignId: string, npcView?: NpcViewId) => void;
}

/**
 * Página da missão (`/admin/missions/:id/:seção`): Recursos, Dados, Vínculos
 * e Inventário. Intel, conquistas e NPCs da missão são criados aqui mesmo,
 * com os editores dos catálogos abertos sobre a página.
 */
export default function MissionWorkspace({
  mode,
  campaign,
  campaignsReady,
  section,
  blankDraft,
  draft,
  onDraftChange,
  onSaved,
  groups,
  allCharacters,
  resourceSummary,
  onViewCatalog,
}: MissionWorkspaceProps) {
  const { t } = useTranslation('admin');
  const nav = useAdminNavigate();
  const toast = useToast();
  const { showAlert, showConfirm, modal } = useModal();
  const { campaigns: campaignOptions } = useAdminCampaigns();
  const { canManage } = useAdminScope();
  const [saving, setSaving] = useState(false);

  const isNew = mode === 'new';
  const missionId = isNew ? undefined : campaign?.id;
  const editing: Partial<Campaign> | null = draft ?? (isNew ? blankDraft : campaign);
  const dirty = draft !== null;

  const intel = useIntelCatalog({ campaignScope: missionId ?? 'all' });
  const achievementEditor = useAchievementEditor();
  const npcEditor = useNpcContactEditor();

  // "‹ Missões" promete a lista: Voltar do histórico cairia na seção anterior da mesma missão.
  // Na criação, a lista substitui `/new` para o Avançar não reabrir um rascunho descartado.
  const backToList = () => nav.go(adminPath.missions(), { replace: isNew });

  if (!editing) {
    if (!campaignsReady) {
      return (
        <div className="flex justify-center py-24" role="status">
          <RetroSpinner />
        </div>
      );
    }
    return (
      <div className="py-24 text-center border-2 border-dashed border-border-subtle rounded-sm flex flex-col items-center gap-4">
        <span className="material-symbols-outlined text-5xl text-ash-700" aria-hidden>
          travel_explore
        </span>
        <div>
          <p className="text-[11px] font-display font-bold uppercase tracking-widest text-ash-400">
            {t('missions.page.notFound')}
          </p>
          <p className="text-[12px] text-ash-500 mt-2">{t('missions.page.notFoundBody')}</p>
        </div>
        <button type="button" onClick={backToList} className="lmb-btn">
          {t('missions.page.back')}
        </button>
      </div>
    );
  }

  // Equipe (convites e co-mestres) é gestão: só o dono da pasta.
  const visibleSections = MISSION_SECTIONS.filter((s) => s.id !== 'equipe' || canManage);
  const activeSection: MissionSectionId = isNew
    ? 'dados'
    : visibleSections.some((s) => s.id === section) ? section : 'recursos';

  const tabs = visibleSections.map((s) => {
    const locked = isNew && s.id !== 'dados';
    return {
      id: s.id,
      label: `${t(s.labelKey)}${s.id === 'dados' && dirty ? ' •' : ''}`,
      icon: s.icon,
      disabled: locked,
      title: locked ? t('missions.modal.saveFirst') : undefined,
    };
  });

  const changeSection = (next: MissionSectionId) => {
    if (missionId && next !== activeSection) nav.go(adminPath.mission(missionId, next));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing.name || !editing.id) return;
    if (isNew) {
      if (!isValidMissionSlug(editing.id)) {
        showAlert('Erro', t('missions.toast.invalidSlug'));
        return;
      }
      if (campaignOptions.some((c) => c.id === editing.id)) {
        showAlert('Erro', t('missions.toast.slugTaken'));
        return;
      }
    }

    setSaving(true);
    try {
      await campaignAdminService.saveCampaign(editing as Partial<Campaign> & { id: string; name: string });
      onDraftChange(null);
      toast.success(t('missions.toast.saved'));
      onSaved(editing as Campaign);
    } catch (error) {
      console.error('Erro ao salvar campanha:', error);
      toast.error(t('missions.toast.saveFail'));
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = async () => {
    if (
      dirty &&
      !(await showConfirm(
        t('missions.page.discardConfirmTitle'),
        t('missions.page.discardConfirmBody'),
        t('missions.page.discard')
      ))
    ) {
      return;
    }
    onDraftChange(null);
    if (isNew) backToList();
  };

  const createResource = (area: CampaignScopedArea) => {
    if (area === 'intel') intel.handleNewItem(missionId);
    else if (area === 'achievements') achievementEditor.openCreate(missionId);
    else npcEditor.openCreate(missionId);
  };

  return (
    <div className="space-y-6">
      {modal}
      {intel.modal}

      <header className="space-y-4">
        <button
          type="button"
          onClick={backToList}
          className="inline-flex items-center gap-1.5 text-[10px] font-display font-bold uppercase tracking-[0.2em] text-ash-500 hover:text-bone transition-colors"
        >
          <span className="material-symbols-outlined text-base" aria-hidden>
            arrow_back
          </span>
          {t('missions.page.back')}
        </button>
        <div className="flex items-center gap-4 min-w-0">
          <span className="w-1 self-stretch bg-accent shrink-0" aria-hidden />
          <div className="min-w-0">
            <span className="inline-block mb-1.5 bg-primary px-1.5 py-px text-[9px] font-display font-bold text-black tracking-widest uppercase">
              {isNew ? t('missions.modal.install') : t('missions.modal.commandBadge')}
            </span>
            <h2 className="font-display font-bold text-xl text-bone uppercase tracking-tight truncate">
              {editing.name || t('missions.modal.newTitle')}
            </h2>
            <p className="text-[10px] font-display font-bold text-ash-500 uppercase tracking-widest mt-0.5">
              {t('missions.modal.commandSubtitle')}
              {dirty && <span className="text-amber-400"> · {t('missions.page.unsaved')}</span>}
            </p>
          </div>
        </div>
      </header>

      <AdminSubTabs
        tabs={tabs}
        active={activeSection}
        onChange={changeSection}
        indicatorId="admin-mission-sub"
        ariaLabel={editing.name || t('missions.modal.newTitle')}
      />

      <div className="bg-surface-container-low border border-seam rounded-panel p-5 sm:p-8">
        <AdminSectionPanels
          active={activeSection}
          render={(s) => {
            if (s === 'dados') {
              return (
                <MissionDataTab
                  campaign={editing}
                  isNew={isNew}
                  onChange={onDraftChange}
                  onSave={handleSave}
                  onDiscard={() => void handleDiscard()}
                  discardLabel={isNew ? t('missions.page.discardNew') : t('missions.page.discard')}
                  discardDisabled={!isNew && !dirty}
                  saving={saving}
                />
              );
            }
            if (!campaign) return null;
            switch (s) {
              case 'recursos':
                return resourceSummary ? (
                  <MissionResourcesTab
                    campaign={editing}
                    summary={resourceSummary}
                    onGoToTab={changeSection}
                    onOpenScoped={(area, create) =>
                      create ? createResource(area) : onViewCatalog(area, campaign.id)
                    }
                    onWriteDialogue={() => onViewCatalog('sms', campaign.id, 'dialogos')}
                  />
                ) : null;
              case 'vinculos':
                return (
                  <MissionAccessTab
                    campaign={campaign}
                    groups={groups}
                    allCharacters={allCharacters}
                    showAlert={showAlert}
                  />
                );
              case 'inventario':
                return <MissionInventoryTab campaign={campaign} groups={groups} allCharacters={allCharacters} />;
              case 'apps':
                return <MissionAppsTab campaign={campaign} />;
              case 'equipe':
                return canManage ? <MissionTeamTab campaign={campaign} groups={groups} /> : null;
            }
          }}
        />
      </div>

      <IntelEditorHost intel={intel} campaigns={campaignOptions} toastFeedback />
      {achievementEditor.editor}
      {npcEditor.editor}
    </div>
  );
}
