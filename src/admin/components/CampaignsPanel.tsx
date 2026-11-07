import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import Screw from '../../components/player/Screw';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, doc } from 'firebase/firestore';
import { Campaign, campaigns as initialCampaigns } from '../../data/campaigns';
import { Group, MasterAccount, CharacterData } from '../../types/player';
import { campaignAdminService } from '../../services/CampaignAdminService';
import { useModal } from './ConfirmModal';
import { intelRegistry } from '../../data/intel_registry';
import MissionWorkspace from './mission/MissionWorkspace';
import OverlayPortal from './OverlayPortal';
import { AdminRouteEnter } from './AdminTabPanel';
import { ADMIN_SPRING } from '../lib/motion';
import { intelService } from '../../services/IntelService';
import type { IntelItem } from '../../types/intel';
import { useAchievementCatalog } from '../../hooks/useAchievementCatalog';
import { useNpcSmsCatalog } from '../../hooks/useNpcSmsCatalog';
import {
  campaignReadiness,
  readinessScore,
  summarizeCampaignResources,
} from '../lib/campaignResources';
import {
  NEW_MISSION_SEGMENT,
  adminPath,
  type CampaignScopedArea,
  type MissionSectionId,
  type NpcViewId,
  type RouteOf,
} from '../lib/adminNavigation';
import { useAdminNavigate } from '../hooks/useAdminRoute';
import { setUnsavedChanges } from '../lib/unsavedChanges';

interface CampaignsPanelProps {
  /** Última rota de Missões: lista, criação ou página de uma missão. */
  route: RouteOf<'missions'>;
  /** Contas e agentes completos (listeners do Dashboard). */
  accounts: MasterAccount[];
  characters: { uid: string; char: CharacterData }[];
  /** Empilha o catálogo de intel, conquistas ou SMS filtrado pela missão. */
  onOpenScoped?: (area: CampaignScopedArea, campaignId: string, npcView?: NpcViewId) => void;
}

function createNewCampaignDraft(): Partial<Campaign> {
  return {
    id: `new-mission-${Date.now()}`,
    name: '',
    description: '',
    location: '',
    year: '2026',
    rpgSystem: 'Cyberpunk Red',
    status: 'Ativa',
    imageUrl: '',
  };
}

export default function CampaignsPanel({
  route,
  accounts,
  characters,
  onOpenScoped,
}: CampaignsPanelProps) {
  const { t } = useTranslation('admin');
  const nav = useAdminNavigate();
  const { showAlert, showConfirm, modal } = useModal();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [persistentItems, setPersistentItems] = useState<string[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showItemsModal, setShowItemsModal] = useState(false);
  const [itemSearch, setItemSearch] = useState('');
  // Rascunhos de Dados por missão (chave `new` para a criação): sobrevivem à navegação
  const [drafts, setDrafts] = useState<Record<string, Partial<Campaign>>>({});
  const [blankDraft, setBlankDraft] = useState<Partial<Campaign>>(createNewCampaignDraft);
  // Missão recém-criada, até o snapshot do Firestore trazê-la na lista
  const [recentlySaved, setRecentlySaved] = useState<Campaign | null>(null);
  const [intelItems, setIntelItems] = useState<IntelItem[]>(() => intelRegistry.getAll());
  const { defs: achievementDefs } = useAchievementCatalog();
  const { contacts: npcContacts, dialogues: npcDialogues } = useNpcSmsCatalog();

  useEffect(() => intelService.subscribeToIntelRegistry(setIntelItems), []);

  const resourceSources = useMemo(
    () => ({
      intel: intelItems,
      achievements: achievementDefs,
      npcs: npcContacts,
      dialogues: npcDialogues,
      groups,
    }),
    [intelItems, achievementDefs, npcContacts, npcDialogues, groups]
  );

  /** Agentes jogáveis (sem arquivados e sem contas admin), no formato das abas da missão. */
  const allCharacters = useMemo(() => {
    const accountByUid = new Map(accounts.map((a) => [a.uid, a]));
    const list: { account: MasterAccount; character: CharacterData }[] = [];
    characters.forEach(({ uid, char }) => {
      const account = accountByUid.get(uid);
      if (account && !char.archived && account.role !== 'admin') list.push({ account, character: char });
    });
    return list;
  }, [accounts, characters]);

  const missionKey = route.view === 'mission' ? route.campaignId : route.view === 'new' ? NEW_MISSION_SEGMENT : null;
  const openCampaign =
    route.view === 'mission'
      ? campaigns.find((c) => c.id === route.campaignId) ??
        (recentlySaved?.id === route.campaignId ? recentlySaved : null)
      : null;

  const missionSummary = useMemo(
    () => (openCampaign ? summarizeCampaignResources(openCampaign.id, resourceSources) : null),
    [openCampaign, resourceSources]
  );

  useEffect(() => {
    if (route.view === 'new' && !drafts[NEW_MISSION_SEGMENT]) setBlankDraft(createNewCampaignDraft());
    // Só ao entrar na criação: um id novo por tentativa
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.view]);

  // Registro global de rascunhos: recarregar, sair ou abrir o modo jogador pedem confirmação
  useEffect(() => {
    const keys = Object.keys(drafts);
    keys.forEach((key) => setUnsavedChanges(`mission:${key}`, true));
    return () => keys.forEach((key) => setUnsavedChanges(`mission:${key}`, false));
  }, [drafts]);

  const setDraft = (key: string, draft: Partial<Campaign> | null) => {
    setDrafts((prev) => {
      const next = { ...prev };
      if (draft) next[key] = draft;
      else delete next[key];
      return next;
    });
  };

  useEffect(() => {
    const unsubCampaigns = onSnapshot(
      collection(db, 'campaigns'),
      (snap) => {
        const list: Campaign[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Campaign));
        if (list.length === 0 && initialCampaigns.length > 0) {
          campaignAdminService.initializeCampaignsFromData();
        }
        setCampaigns(list);
        setLoading(false);
      },
      (err) => {
        console.warn('[CampaignsPanel] campaigns listener error:', err);
        setCampaigns(initialCampaigns);
        setLoading(false);
      }
    );

    const unsubSettings = onSnapshot(doc(db, 'system', 'campaignSettings'), (snap) => {
      if (snap.exists()) {
        setPersistentItems(snap.data().persistentItemIds || []);
      }
    });

    const unsubGroups = onSnapshot(collection(db, 'groups'), (snap) => {
      const list: Group[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Group));
      setGroups(list);
    });


    return () => {
      unsubCampaigns();
      unsubSettings();
      unsubGroups();
    };
  }, []);

  const handleDeleteCampaign = async (id: string, name: string) => {
    const ok = await showConfirm(
      t('missions.deleteConfirmTitle'),
      t('missions.deleteConfirmBody', { name }),
      t('missions.deleteAction')
    );
    if (!ok) return;

    try {
      await campaignAdminService.deleteCampaign(id);
    } catch (error) {
      console.error('Erro ao deletar campanha:', error);
      showAlert('Erro', t('missions.deleteFail'));
    }
  };

  const togglePersistentItem = async (itemId: string) => {
    const newList = persistentItems.includes(itemId)
      ? persistentItems.filter((id) => id !== itemId)
      : [...persistentItems, itemId];

    try {
      await campaignAdminService.setPersistentItems(newList);
      setPersistentItems(newList);
    } catch (error) {
      console.error('Erro ao atualizar itens persistentes:', error);
    }
  };

  const openManage = (campaign: Campaign, section?: MissionSectionId) => {
    nav.go(adminPath.mission(campaign.id, section));
  };

  const openNewMission = () => {
    nav.go(adminPath.newMission());
  };

  const handleMissionSaved = (saved: Campaign) => {
    if (route.view !== 'new') return;
    // Missão nova: a rota troca para Recursos, que mostra o que falta para jogá-la
    setRecentlySaved(saved);
    nav.go(adminPath.mission(saved.id, 'recursos'), { replace: true });
  };

  if (missionKey) {
    return (
      <AdminRouteEnter key={missionKey}>
      <MissionWorkspace
        mode={route.view === 'new' ? 'new' : 'existing'}
        campaign={openCampaign}
        campaignsReady={!loading}
        section={route.view === 'mission' ? route.section : 'dados'}
        blankDraft={blankDraft}
        draft={drafts[missionKey] ?? null}
        onDraftChange={(draft) => setDraft(missionKey, draft)}
        onSaved={handleMissionSaved}
        groups={groups}
        allCharacters={allCharacters}
        resourceSummary={missionSummary}
        onViewCatalog={(area, campaignId, npcView) => onOpenScoped?.(area, campaignId, npcView)}
      />
      </AdminRouteEnter>
    );
  }

  if (loading) {
    return (
      <div className="p-24 text-center animate-pulse font-display font-bold text-primary text-xs uppercase tracking-[0.4em]">
        {t('missions.loading')}
      </div>
    );
  }

  const allRegistryIntel = intelRegistry.getAll();

  return (
    <AdminRouteEnter key="list">
    <div className="space-y-8 font-sans">
      {modal}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-1 h-9 bg-accent shrink-0" />
          <div>
            <h2 className="font-display font-bold uppercase tracking-widest text-lg text-bone">
              {t('missions.title')}
            </h2>
            <p className="text-[10px] font-display font-bold text-ash-500 uppercase tracking-widest mt-1">
              {t('missions.subtitle')}
            </p>
          </div>
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => setShowItemsModal(true)}
            className="flex items-center gap-3 bg-surface-container-high text-ash-400 px-6 py-3 rounded-sm font-display font-bold text-[11px] tracking-widest hover:bg-white/5 transition border border-border-subtle active:scale-[0.97] uppercase"
          >
            <span className="material-symbols-outlined text-base">inventory_2</span>
            {t('missions.persistentItems')}
          </button>
          <button
            onClick={openNewMission}
            className="flex items-center gap-3 bg-primary text-black px-6 py-3 rounded-sm font-display font-bold text-[11px] tracking-widest hover:bg-primary-container transition active:scale-[0.97] uppercase"
          >
            <span className="material-symbols-outlined text-base">add_circle</span>
            {t('missions.modal.newTitle')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6">
        {campaigns.map((campaign) => {
          const summary = summarizeCampaignResources(campaign.id, resourceSources);
          const readiness = readinessScore(campaignReadiness(campaign, summary));
          const ready = readiness.done === readiness.total;
          const authorizedGroups = summary.authorizedGroups.length;
          const operatingGroups = groups.filter((g) => g.campaignId === campaign.id).length;
          const operatingAgents = allCharacters.filter(
            (c) => c.character.campaignId === campaign.id
          ).length;

          return (
            <div
              key={campaign.id}
              className="bg-surface-container-low border border-primary/10 overflow-hidden group hover:border-primary/30 transition shadow-2xl relative"
            >
              <div className="h-48 bg-black relative overflow-hidden">
                {campaign.imageUrl ? (
                  <img
                    src={campaign.imageUrl}
                    alt={campaign.name}
                    className="w-full h-full object-cover opacity-40 grayscale group-hover:grayscale-0 group-hover:opacity-60 transition-[filter,opacity] duration-300"
                    onError={(e) => {
                      e.currentTarget.src =
                        'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=800&auto=format&fit=crop';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-ash-700 bg-surface-container-high">
                    <span className="material-symbols-outlined text-7xl">map</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-linear-to-t from-surface-container-low via-surface-container-low/20 to-transparent" />

                <div className="absolute bottom-6 left-6 right-6">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="lmb-led text-accent animate-led" aria-hidden />
                    <p className="text-[10px] font-display font-bold text-primary/70 uppercase tracking-[0.2em]">
                      {campaign.rpgSystem}
                    </p>
                  </div>
                  <h3 className="font-display font-bold text-3xl text-bone uppercase tracking-tighter group-hover:text-primary transition-colors leading-none">
                    {campaign.name}
                  </h3>
                </div>
              </div>

              <div className="p-6 space-y-5">
                <p className="text-[12px] text-ash-400 italic line-clamp-2 leading-relaxed font-sans">
                  {campaign.description}
                </p>

                <div className="flex items-center justify-between text-[10px] font-display font-bold text-ash-600 uppercase border-y border-border-subtle py-3 tracking-widest gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-base text-ash-600">
                      location_on
                    </span>{' '}
                    {campaign.location}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-base text-ash-600">
                      devices
                    </span>
                    {campaign.playerType === 'nokia' ? t('missions.playerType.handset') : t('missions.playerType.deck')}
                  </div>
                  <span
                    className={`px-3 py-1 rounded-sm border font-display font-bold ${
                      campaign.status === 'Ativa'
                        ? 'border-phosphor-500/20 text-phosphor-500 bg-phosphor-500/5'
                        : campaign.status === 'Bloqueada'
                          ? 'border-red-500/20 text-red-500 bg-red-500/5'
                          : 'border-border-subtle text-ash-600'
                    }`}
                  >
                    {campaign.status.toUpperCase()}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => openManage(campaign, 'recursos')}
                  className="w-full flex items-center gap-3 text-left group/kit"
                  title={t('missions.card.openResources')}
                >
                  <span
                    className={`lmb-led ${ready ? 'text-phosphor-400' : 'text-amber-400'}`}
                    aria-hidden
                  />
                  <span className="font-display font-bold uppercase tracking-[0.16em] text-[10px] text-ash-300 group-hover/kit:text-bone transition-colors">
                    {t('missions.card.readiness', { done: readiness.done, total: readiness.total })}
                  </span>
                  <span className="ml-auto flex items-center gap-3 font-mono text-[11px] text-ash-400 tabular-nums">
                    <span title={t('missions.resources.section.intel')} className="inline-flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm text-ash-600" aria-hidden>hub</span>
                      {summary.intel.length}
                    </span>
                    <span title={t('missions.resources.section.achievements')} className="inline-flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm text-ash-600" aria-hidden>emoji_events</span>
                      {summary.achievements.length}
                    </span>
                    <span title={t('missions.resources.section.npcs')} className="inline-flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm text-ash-600" aria-hidden>sms</span>
                      {summary.npcs.length}
                    </span>
                  </span>
                </button>

                <div className="flex flex-wrap gap-2 text-[9px] font-display font-bold uppercase tracking-widest">
                  {authorizedGroups > 0 && (
                    <span className="bg-primary/5 text-primary/70 border border-primary/20 px-2 py-1 rounded-sm">
                      {t('missions.badge.authorized', { n: authorizedGroups })}
                    </span>
                  )}
                  {(operatingGroups > 0 || operatingAgents > 0) && (
                    <span className="bg-phosphor-500/10 text-phosphor-500 border border-phosphor-500/30 px-2 py-1 rounded-sm">
                      {t('missions.badge.inField', { n: operatingGroups + operatingAgents })}
                    </span>
                  )}
                </div>

                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => openManage(campaign)}
                    className="lmb-btn flex-1 h-11 hover:border-primary/50 hover:text-primary"
                  >
                    <span className="material-symbols-outlined text-sm">tune</span>
                    {t('missions.manage')}
                  </button>
                  <button
                    onClick={() => handleDeleteCampaign(campaign.id, campaign.name)}
                    className="w-11 flex items-center justify-center bg-black/40 border border-border rounded-inset text-ash-500 hover:text-red-500 hover:border-red-500/30 transition active:scale-[0.97]"
                    title={t('missions.deleteTitle')}
                    aria-label={t('missions.deleteTitle')}
                  >
                    <span className="material-symbols-outlined text-xl">delete</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <OverlayPortal open={showItemsModal} onClose={() => setShowItemsModal(false)} withExitAnimation>
        <AnimatePresence>
          {showItemsModal && (
            <div
              className="fixed inset-0 z-[120] flex justify-end bg-surface-scrim"
              onClick={() => setShowItemsModal(false)}
            >
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={ADMIN_SPRING}
                className="bg-surface-container-low border-l border-seam w-full max-w-2xl shadow-2xl flex flex-col h-full relative overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <Screw className="top-4 left-4" />
                <Screw className="top-4 right-4 -rotate-90" />
                <Screw className="bottom-4 left-4 -rotate-90" />
                <Screw className="bottom-4 right-4" />
                <div className="noise-overlay" />
                <div className="scanlines" />

                <div className="p-8 border-b-4 border-seam flex justify-between items-center bg-black/40 relative z-10">
                  <div className="mt-2">
                    <h3 className="font-black text-xl text-bone uppercase tracking-widest">
                      Retenção de <span className="text-primary">Recursos</span>
                    </h3>
                    <p className="text-[10px] font-bold text-ash-500 uppercase tracking-widest mt-1">
                      {t('missions.persistent.subtitle')}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowItemsModal(false)}
                    className="p-3 text-ash-600 hover:text-bone transition material-symbols-outlined rounded-sm"
                  >
                    close
                  </button>
                </div>

                <div className="p-6 bg-black/20 border-b-2 border-seam relative z-10">
                  <div className="relative group">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-ash-600 text-base group-focus-within:text-primary transition-colors">
                      search
                    </span>
                    <input
                      type="text"
                      placeholder={t('missions.persistent.search')}
                      value={itemSearch}
                      onChange={(e) => setItemSearch(e.target.value)}
                      className="w-full bg-black/60 border-2 border-seam text-[11px] font-bold px-12 py-4 text-bone outline-none rounded-sm uppercase tracking-widest transition shadow-inner focus:ring-1 focus:ring-primary placeholder:text-ash-600"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-black/10 relative z-10">
                  <div className="grid grid-cols-1 gap-2">
                    {allRegistryIntel
                      .filter(
                        (i) =>
                          (i.title || '').toLowerCase().includes(itemSearch.toLowerCase()) ||
                          (i.metadata?.chapter || '').toLowerCase().includes(itemSearch.toLowerCase())
                      )
                      .map((item) => (
                        <button
                          key={item.id}
                          onClick={() => togglePersistentItem(item.id)}
                          className={`flex items-center justify-between p-4 text-left transition border-2 rounded-sm group ${
                            persistentItems.includes(item.id)
                              ? 'bg-primary/10 border-primary/30 text-primary shadow-inner'
                              : 'bg-seam border-seam text-ash-500 hover:bg-white/5 hover:text-bone hover:border-border'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div
                              className={`w-10 h-10 rounded-sm bg-black/40 border-2 flex items-center justify-center transition ${
                                persistentItems.includes(item.id)
                                  ? 'border-primary/40 text-primary shadow-[0_0_10px_rgba(255,140,0,0.1)]'
                                  : 'border-seam text-ash-600'
                              }`}
                            >
                              <span className="material-symbols-outlined text-xl">
                                {item.type === 'AUDIO'
                                  ? 'album'
                                  : item.type === 'TEXT'
                                    ? 'save'
                                    : 'description'}
                              </span>
                            </div>
                            <div>
                              <p className="text-[11px] font-black uppercase tracking-wider">
                                {item.title}
                              </p>
                              <p
                                className={`text-[9px] font-bold uppercase tracking-widest mt-0.5 ${
                                  persistentItems.includes(item.id)
                                    ? 'text-primary/40'
                                    : 'text-ash-600'
                                }`}
                              >
                                {item.metadata?.chapter || 'REGISTRO GERAL'}
                              </p>
                            </div>
                          </div>
                          {persistentItems.includes(item.id) && (
                            <div className="w-2 h-2 bg-primary rounded-full animate-pulse glow-orange" />
                          )}
                        </button>
                      ))}
                  </div>
                </div>

                <div className="p-8 border-t-4 border-seam flex justify-end bg-black/40 relative z-10 shrink-0">
                  <button
                    onClick={() => setShowItemsModal(false)}
                    className="bg-[#333] hover:bg-[#444] text-bone px-12 py-4 text-[10px] font-black tracking-widest transition rounded-sm uppercase active:scale-[0.97]"
                  >
                    Concluir Operação
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </OverlayPortal>
    </div>
    </AdminRouteEnter>
  );
}
