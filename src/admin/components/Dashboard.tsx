import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { User } from 'firebase/auth';
import { db } from '../../lib/firebase';
import { doc, collection, onSnapshot, query, orderBy, limit, where, getCountFromServer } from 'firebase/firestore';
import { userService } from '../../services/UserService';
import { adminAnalyticsService } from '../../services/AdminAnalyticsService';
import { MasterAccount, CharacterData, Group } from '../../types/player';
import { resolveAdminAccess, isAdminAccount } from '../../lib/adminAccess';
import { Campaign } from '../../data/campaigns';
import { groupService } from '../../services/GroupService';
import SpotlightSearch, { buildSearchItems } from './SpotlightSearch';
import Sidebar from './Sidebar';
import Header from './Header';
import AdminTabPanel from './AdminTabPanel';
import { useAdminActiveSession } from '../hooks/useAdminActiveSession';
import { campaignLabel } from '../lib/entityLabels';
import i18n from '../../i18n';
import { motion } from 'motion/react';
import { ADMIN_FADE } from '../lib/motion';
import {
  type OperationsSubId,
  type MesaSubId,
  type MissionTabId,
  type MetricNavigationOptions,
  type AdminTabId,
  readAdminTabFromUrl,
  readOperationsSubFromUrl,
  readMesaSubFromUrl,
  syncAdminTabsToUrl,
} from '../lib/adminNavigation';

const CampaignsPanel = React.lazy(() => import('./CampaignsPanel'));
const MediaLibraryPanel = React.lazy(() => import('./MediaLibraryPanel'));
const OperationsPanel = React.lazy(() => import('./OperationsPanel'));
const LiveWorkspace = React.lazy(() => import('./LiveWorkspace'));
const MesaPanel = React.lazy(() => import('./MesaPanel'));

interface DashboardProps {
  user: User | null;
  onLogout: () => void;
}

interface AgentMetrics {
  active: number;
  vivo: number;
  morto: number;
  desaparecido: number;
  highDanger: number;
  archived: number;
}

interface CampaignMetrics {
  ativa: number;
  bloqueada: number;
  arquivada: number;
  walkman: number;
  nokia: number;
}

interface HealthMetrics {
  suspended: number;
  dormant: number;
  errors24h: number;
  limboSeized: boolean;
}

interface EngagementMetrics {
  totalAchievements: number;
  totalScrews: number;
  totalFidgets: number;
  totalEjects: number;
}

function countActiveUsers7d(users: MasterAccount[]): number {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return users.filter((u) => {
    if (!u.lastLogin?.toDate) return false;
    return u.lastLogin.toDate() >= sevenDaysAgo;
  }).length;
}

function countDormantUsers(users: MasterAccount[]): number {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return users.filter((u) => {
    if (!u.lastLogin?.toDate) return false;
    return u.lastLogin.toDate() < thirtyDaysAgo;
  }).length;
}

function computeAgentMetrics(characters: { uid: string; char: CharacterData }[]): AgentMetrics {
  const metrics: AgentMetrics = {
    active: 0,
    vivo: 0,
    morto: 0,
    desaparecido: 0,
    highDanger: 0,
    archived: 0,
  };

  characters.forEach(({ char }) => {
    if (char.archived) {
      metrics.archived++;
      return;
    }
    metrics.active++;
    if (char.agentStatus === 'vivo') metrics.vivo++;
    else if (char.agentStatus === 'morto') metrics.morto++;
    else if (char.agentStatus === 'desaparecido') metrics.desaparecido++;
    if ((char.dangerLevel ?? 1) >= 4) metrics.highDanger++;
  });

  return metrics;
}

function computeCampaignMetrics(campaigns: Campaign[]): CampaignMetrics {
  const metrics: CampaignMetrics = {
    ativa: 0,
    bloqueada: 0,
    arquivada: 0,
    walkman: 0,
    nokia: 0,
  };

  campaigns.forEach((c) => {
    if (c.status === 'Ativa') metrics.ativa++;
    else if (c.status === 'Bloqueada') metrics.bloqueada++;
    else if (c.status === 'Arquivada') metrics.arquivada++;
    if (c.playerType === 'walkman') metrics.walkman++;
    else if (c.playerType === 'nokia') metrics.nokia++;
  });

  return metrics;
}

export default function Dashboard({ user, onLogout }: DashboardProps) {
  const { t } = useTranslation('admin');
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTabId>(readAdminTabFromUrl);
  const [mountedTabs, setMountedTabs] = useState<Set<string>>(
    () => new Set([readAdminTabFromUrl()])
  );
  const [opsTab, setOpsTab] = useState<OperationsSubId>(readOperationsSubFromUrl);
  const [mesaTab, setMesaTab] = useState<MesaSubId>(readMesaSubFromUrl);
  const [missionDeepLink, setMissionDeepLink] = useState<{
    campaignId: string;
    tab?: MissionTabId;
  } | null>(null);
  const [mesaDeepLink, setMesaDeepLink] = useState<{
    accountUid?: string;
    agent?: { uid: string; charId: string };
    groupId?: string;
  } | null>(null);
  const { session: activeSession, setSession: setActiveSession } = useAdminActiveSession();
  const [spotlightGroups, setSpotlightGroups] = useState<Group[]>([]);
  const [spotlightCampaigns, setSpotlightCampaigns] = useState<Campaign[]>([]);
  const [agentMetrics, setAgentMetrics] = useState<AgentMetrics>({
    active: 0,
    vivo: 0,
    morto: 0,
    desaparecido: 0,
    highDanger: 0,
    archived: 0,
  });
  const [campaignMetrics, setCampaignMetrics] = useState<CampaignMetrics>({
    ativa: 0,
    bloqueada: 0,
    arquivada: 0,
    walkman: 0,
    nokia: 0,
  });
  const [healthMetrics, setHealthMetrics] = useState<HealthMetrics>({
    suspended: 0,
    dormant: 0,
    errors24h: 0,
    limboSeized: false,
  });
  const [engagementMetrics, setEngagementMetrics] = useState<EngagementMetrics>({
    totalAchievements: 0,
    totalScrews: 0,
    totalFidgets: 0,
    totalEjects: 0,
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [spotlightOpen, setSpotlightOpen] = useState(false);
  const [allAccounts, setAllAccounts] = useState<MasterAccount[]>([]);
  const [allCharacters, setAllCharacters] = useState<{ uid: string; char: CharacterData }[]>([]);
  const [firstCampaignId, setFirstCampaignId] = useState<string | null>(null);
  const [onlineCount, setOnlineCount] = useState(0);

  const aggregatedPlaysRef = useRef<number | null>(null);

  useEffect(() => {
    setMountedTabs((prev) => new Set(prev).add(activeTab));
  }, [activeTab]);

  useEffect(() => {
    syncAdminTabsToUrl(activeTab, opsTab, mesaTab);
  }, [activeTab, opsTab, mesaTab]);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setIsAdmin(false);
      return;
    }
    void resolveAdminAccess(user).then((ok) => {
      if (!cancelled) setIsAdmin(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    void import('../../lib/functions')
      .then(({ callFunction }) => callFunction('backfillGroupMemberUids'))
      .then((result) => {
        if (!cancelled && result && typeof result === 'object' && 'updated' in result) {
          const updated = Number((result as { updated?: number }).updated || 0);
          if (updated > 0) {
            console.info(`[Dashboard] memberUids backfill: ${updated} grupo(s)`);
          }
        }
      })
      .catch((err) => console.warn('[Dashboard] backfillGroupMemberUids:', err));
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;

    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snap) => {
        const users = snap.docs.map((d) => ({ uid: d.id, ...d.data() } as MasterAccount));
        setHealthMetrics((prev) => ({
          ...prev,
          suspended: users.filter((u) => u.suspended).length,
          dormant: countDormantUsers(users),
        }));
        const now = Date.now();
        const ONLINE_MS = 15 * 60 * 1000;
        setOnlineCount(
          users.filter((u) => {
            if (isAdminAccount(u)) return false;
            const ms = u.lastLogin?.toMillis?.() ?? 0;
            return ms > 0 && now - ms <= ONLINE_MS;
          }).length
        );
        // keep activeUsers7d available indirectly via engagement listeners
        void countActiveUsers7d(users);
      },
      (err) => console.warn('[Dashboard] users listener error:', err),
    );

    void getCountFromServer(query(collection(db, 'mediaAssets'), where('type', '==', 'audio'))).catch(
      (err) => console.warn('[Dashboard] mediaAssets count error:', err)
    );

    const unsubAgg = adminAnalyticsService.subscribeToAggregatedAnalytics((data) => {
      aggregatedPlaysRef.current = data?.totalPlays ?? null;
    });

    const unsubCharacters = userService.subscribeToAllCharacters((characters) => {
      setAgentMetrics(computeAgentMetrics(characters));
    });

    const unsubCampaigns = onSnapshot(
      collection(db, 'campaigns'),
      (snap) => {
        const campaigns = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Campaign));
        setCampaignMetrics(computeCampaignMetrics(campaigns));
        setSpotlightCampaigns(campaigns);
        const firstActive = campaigns.find((c) => c.status === 'Ativa') || campaigns[0];
        setFirstCampaignId(firstActive?.id ?? null);
      },
      (err) => console.warn('[Dashboard] campaigns listener error:', err),
    );

    const unsubGroups = groupService.subscribeToGroups(setSpotlightGroups);

    const unsubActivityLog = onSnapshot(
      query(collection(db, 'activityLog'), orderBy('timestamp', 'desc'), limit(200)),
      (snap) => {
        const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
        const errors24h = snap.docs.filter((d) => {
          const data = d.data();
          if (data.type !== 'error') return false;
          const ts = data.timestamp;
          if (!ts?.toDate) return false;
          return ts.toDate().getTime() >= twentyFourHoursAgo;
        }).length;
        setHealthMetrics((prev) => ({ ...prev, errors24h }));
      },
      (err) => console.warn('[Dashboard] activityLog listener error:', err),
    );

    const unsubLimbo = onSnapshot(
      doc(db, 'system', 'limboState'),
      (snap) => {
        const seized = snap.exists() ? Boolean(snap.data()?.seized) : false;
        setHealthMetrics((prev) => ({ ...prev, limboSeized: seized }));
      },
      (err) => console.warn('[Dashboard] limboState listener error:', err),
    );

    void adminAnalyticsService.fetchEngagementSnapshot().then((eng) => {
      setEngagementMetrics(eng);
    });

    return () => {
      unsubUsers();
      unsubAgg();
      unsubCharacters();
      unsubCampaigns();
      unsubGroups();
      unsubActivityLog();
      unsubLimbo();
    };
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;

    const fetchRecentItems = async () => {
      try {
        const userResult = await userService.fetchUsersPage(20);
        setAllAccounts(userResult.users);

        const charPromises = userResult.users.map((u) => userService.fetchCharactersForUser(u.uid));
        const charResults = await Promise.all(charPromises);

        const combined: { uid: string; char: CharacterData }[] = [];
        userResult.users.forEach((acc, i) => {
          charResults[i].forEach((char) => {
            combined.push({ uid: acc.uid, char });
          });
        });
        setAllCharacters(combined);
      } catch (err) {
        console.error('Erro ao carregar itens recentes para Spotlight:', err);
      }
    };

    fetchRecentItems();
  }, [isAdmin]);

  const setTab = useCallback((tab: string) => {
    const allowed: AdminTabId[] = ['live', 'mesa', 'missions', 'media', 'systems'];
    if ((allowed as string[]).includes(tab)) setActiveTab(tab as AdminTabId);
  }, []);

  useEffect(() => {
    const tabOrder: AdminTabId[] = ['live', 'mesa', 'missions', 'media', 'systems'];
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSpotlightOpen((prev) => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.key >= '1' && e.key <= '5') {
        e.preventDefault();
        const idx = parseInt(e.key) - 1;
        if (tabOrder[idx]) setActiveTab(tabOrder[idx]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const navigateToMetric = useCallback(
    (tab: string, options?: MetricNavigationOptions) => {
      let nextTab: AdminTabId = 'live';
      let nextOps = opsTab;
      let nextMesa = mesaTab;

      const legacySub = options?.intelSubTab;
      const opsSub = options?.opsSubTab;
      const mesaSub = options?.mesaSubTab;

      if (tab === 'intel') {
        if (legacySub === 'jukebox') {
          nextTab = 'live';
        } else if (legacySub === 'qr' || legacySub === 'conquistas') {
          nextTab = 'systems';
          nextOps = legacySub;
        } else {
          nextTab = 'media';
        }
      } else if (tab === 'dashboard') {
        nextTab = 'live';
      } else if (tab === 'players') {
        nextTab = 'mesa';
        nextMesa = 'contas';
      } else if (tab === 'squads') {
        nextTab = 'mesa';
        nextMesa = 'esquadroes';
      } else if (tab === 'live' || tab === 'mesa' || tab === 'missions' || tab === 'media' || tab === 'systems') {
        nextTab = tab;
        if (opsSub) nextOps = opsSub;
        if (mesaSub) nextMesa = mesaSub;
      } else if (opsSub) {
        nextOps = opsSub;
        nextTab = 'systems';
      } else if (mesaSub) {
        nextMesa = mesaSub;
        nextTab = 'mesa';
      } else if (legacySub === 'acervo') {
        nextTab = 'media';
      } else if (legacySub === 'jukebox') {
        nextTab = 'live';
      } else if (legacySub === 'qr' || legacySub === 'conquistas') {
        nextTab = 'systems';
        nextOps = legacySub;
      }

      setActiveTab(nextTab);
      setOpsTab(nextOps);
      setMesaTab(nextMesa);
      if (options?.openMissionId) {
        setMissionDeepLink({
          campaignId: options.openMissionId,
          tab: options.missionTab,
        });
      }
      if (options?.scrollTo) {
        window.setTimeout(() => {
          document.getElementById(options.scrollTo!)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 200);
      }
    },
    [opsTab, mesaTab]
  );

  const sessionLabel = useMemo(() => {
    if (!activeSession?.groupId) return null;
    const groupName =
      spotlightGroups.find((g) => g.id === activeSession.groupId)?.name || t('header.squadFallback');
    const missionName = activeSession.campaignId
      ? campaignLabel(activeSession.campaignId, spotlightCampaigns)
      : null;
    const unknownMission = i18n.t('entity.missionUnknown', { ns: 'admin' });
    return missionName && missionName !== unknownMission
      ? `${groupName} · ${missionName}`
      : groupName;
  }, [activeSession, spotlightGroups, spotlightCampaigns, t]);

  const clearMesaDeepLink = useCallback(() => setMesaDeepLink(null), []);

  const spotlightItems = useMemo(() => {
    return buildSearchItems(
      allAccounts,
      allCharacters,
      setTab,
      (uid) => {
        setMesaTab('contas');
        setActiveTab('mesa');
        setMesaDeepLink({ accountUid: uid });
      },
      (uid, charId) => {
        setMesaTab('contas');
        setActiveTab('mesa');
        setMesaDeepLink({ agent: { uid, charId } });
      },
      () => {
        if (firstCampaignId) {
          navigateToMetric('missions', {
            openMissionId: firstCampaignId,
            missionTab: 'inventario',
          });
        } else {
          setActiveTab('missions');
        }
      },
      (opsSub) => {
        setActiveTab('systems');
        setOpsTab(opsSub);
      },
      (mesaSub) => {
        setActiveTab('mesa');
        setMesaTab(mesaSub);
      },
      spotlightGroups.map((g) => ({ id: g.id, name: g.name })),
      spotlightCampaigns.map((c) => ({ id: c.id, name: c.name })),
      (groupId) => {
        setMesaTab('esquadroes');
        setActiveTab('mesa');
        setMesaDeepLink({ groupId });
      },
      (campaignId) => {
        navigateToMetric('missions', { openMissionId: campaignId, missionTab: 'dados' });
      }
    );
  }, [
    allAccounts,
    allCharacters,
    firstCampaignId,
    navigateToMetric,
    setTab,
    spotlightGroups,
    spotlightCampaigns,
  ]);

  const handleNavigateToMission = useCallback(
    (campaignId: string, tab: MissionTabId = 'vinculos') => {
      navigateToMetric('missions', { openMissionId: campaignId, missionTab: tab });
    },
    [navigateToMetric]
  );

  return (
    <div className="h-screen bg-surface flex relative overflow-hidden font-sans">
      <div className="noise-overlay" />
      <div className="scanlines" />

      <Sidebar
        activeTab={activeTab}
        setActiveTab={setTab}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
      />

      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        <Header
          user={user}
          onLogout={onLogout}
          onSpotlight={() => setSpotlightOpen(true)}
          contextLabel={t(`context.${activeTab}`)}
          sessionLabel={sessionLabel}
          onOpenLive={() => setActiveTab('live')}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar bg-surface/50 backdrop-blur-sm">
          <div className="max-w-6xl mx-auto space-y-8">
            <React.Suspense
              fallback={
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={ADMIN_FADE}
                  className="flex items-center justify-center p-24"
                >
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                    <p className="text-[10px] font-display font-bold text-primary uppercase tracking-[0.4em] animate-pulse">
                      {t('loading.data')}
                    </p>
                  </div>
                </motion.div>
              }
            >
              {mountedTabs.has('live') && (
                <AdminTabPanel active={activeTab === 'live'}>
                  <LiveWorkspace
                    accounts={allAccounts}
                    characters={allCharacters}
                    onlineCount={onlineCount}
                    errors24h={healthMetrics.errors24h}
                    limboSeized={healthMetrics.limboSeized}
                    activeSession={activeSession}
                    onSessionChange={setActiveSession}
                    onOpenSystems={() => navigateToMetric('systems', { opsSubTab: 'acesso' })}
                    onOpenMesa={(groupId) => {
                      setMesaTab('esquadroes');
                      setActiveTab('mesa');
                      if (groupId) setMesaDeepLink({ groupId });
                    }}
                    onOpenMedia={() => navigateToMetric('media')}
                    onOpenFullLog={() =>
                      navigateToMetric('systems', {
                        opsSubTab: 'relatorios',
                        scrollTo: 'admin-system-log',
                      })
                    }
                    onOpenMission={(campaignId) =>
                      navigateToMetric('missions', {
                        openMissionId: campaignId,
                        missionTab: 'vinculos',
                      })
                    }
                  />
                </AdminTabPanel>
              )}

              {mountedTabs.has('mesa') && (
                <AdminTabPanel active={activeTab === 'mesa'}>
                  <MesaPanel
                    activeSub={mesaTab}
                    onSubChange={setMesaTab}
                    isAdmin={isAdmin}
                    onNavigateToMission={handleNavigateToMission}
                    deepLinkAccountUid={mesaDeepLink?.accountUid}
                    deepLinkAgent={mesaDeepLink?.agent}
                    deepLinkGroupId={mesaDeepLink?.groupId}
                    onDeepLinkConsumed={clearMesaDeepLink}
                  />
                </AdminTabPanel>
              )}

              {mountedTabs.has('missions') && (
                <AdminTabPanel active={activeTab === 'missions'}>
                  <CampaignsPanel
                    missionDeepLink={missionDeepLink}
                    onDeepLinkConsumed={() => setMissionDeepLink(null)}
                  />
                </AdminTabPanel>
              )}

              {mountedTabs.has('media') && (
                <AdminTabPanel active={activeTab === 'media'}>
                  <MediaLibraryPanel />
                </AdminTabPanel>
              )}

              {mountedTabs.has('systems') && (
                <AdminTabPanel active={activeTab === 'systems'}>
                  <OperationsPanel
                    activeSub={opsTab}
                    onSubChange={setOpsTab}
                    agents={agentMetrics}
                    campaigns={campaignMetrics}
                    health={healthMetrics}
                    engagement={engagementMetrics}
                    onNavigate={navigateToMetric}
                  />
                </AdminTabPanel>
              )}
            </React.Suspense>
          </div>
        </main>

        <footer className="h-8 border-t border-primary/10 bg-surface-container-low/50 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse glow-orange" />
            <span className="text-[8px] font-display font-bold uppercase tracking-[0.3em] text-industrial-silver/40">
              {t('footer.realtimeSync')}
            </span>
          </div>
          <span className="text-[8px] font-display font-bold uppercase tracking-[0.3em] text-industrial-silver/20">
            {t('footer.systemId')}
          </span>
        </footer>
      </div>

      <SpotlightSearch open={spotlightOpen} onClose={() => setSpotlightOpen(false)} items={spotlightItems} />
    </div>
  );
}
