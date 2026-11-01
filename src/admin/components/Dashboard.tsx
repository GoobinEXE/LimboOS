import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
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
import { useAdminLocation, useAdminNavigate } from '../hooks/useAdminRoute';
import { campaignLabel, masterAccountLabel } from '../lib/entityLabels';
import { buildAdminBreadcrumb } from '../lib/adminBreadcrumb';
import { hasUnsavedChanges } from '../lib/unsavedChanges';
import { useModal } from './ConfirmModal';
import i18n from '../../i18n';
import { motion } from 'motion/react';
import { ADMIN_FADE } from '../lib/motion';
import { modKeyLabel } from '../lib/platform';
import RetroSpinner from '../../components/player/RetroSpinner';
import {
  ADMIN_DESTINATIONS,
  adminPath,
  defaultDestinationPath,
  destinationRootPath,
  routeToPath,
  type AdminDestinationId,
  type AdminRoute,
  type CampaignScopeRequest,
  type CampaignScopedArea,
  type NpcViewId,
  type RouteOf,
} from '../lib/adminNavigation';

const SIDEBAR_COLLAPSED_KEY = 'limbo.admin.sidebarCollapsed';

const CampaignsPanel = React.lazy(() => import('./CampaignsPanel'));
const ContentPanel = React.lazy(() => import('./ContentPanel'));
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
  const { showConfirm, modal: confirmModal } = useModal();
  const { route, redirect, key: locationKey, hash, path } = useAdminLocation();
  const nav = useAdminNavigate();
  // Última rota de cada destino visitado: mantém o painel montado (keep-alive)
  // com os parâmetros dele e é para onde a navegação lateral volta
  const [routeByDest, setRouteByDest] = useState<
    Partial<Record<AdminDestinationId, { route: AdminRoute; key: string }>>
  >(() => ({ [route.dest]: { route, key: locationKey } }));
  const [scopeRequest, setScopeRequest] = useState<CampaignScopeRequest | null>(null);
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [spotlightOpen, setSpotlightOpen] = useState(false);
  const [allAccounts, setAllAccounts] = useState<MasterAccount[]>([]);
  const [allCharacters, setAllCharacters] = useState<{ uid: string; char: CharacterData }[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const mainRef = useRef<HTMLElement>(null);
  const scrollByKeyRef = useRef(new Map<string, number>());
  const locationKeyRef = useRef(locationKey);

  const aggregatedPlaysRef = useRef<number | null>(null);

  useEffect(() => {
    setRouteByDest((prev) =>
      prev[route.dest]?.key === locationKey
        ? prev
        : { ...prev, [route.dest]: { route, key: locationKey } }
    );
  }, [route, locationKey]);

  // Scroll do <main> por entrada de histórico: Voltar restaura, entrada nova começa no topo,
  // `#âncora` rola até a seção (o painel pode ainda estar carregando: tenta por ~1s)
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const onScroll = () => scrollByKeyRef.current.set(locationKeyRef.current, el.scrollTop);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useLayoutEffect(() => {
    locationKeyRef.current = locationKey;
    const el = mainRef.current;
    if (!el) return;
    if (!hash) {
      el.scrollTop = scrollByKeyRef.current.get(locationKey) ?? 0;
      return;
    }
    let frame = 0;
    let tries = 0;
    const seek = () => {
      const target = document.getElementById(hash.slice(1));
      if (target) target.scrollIntoView({ block: 'start' });
      else if (tries++ < 60) frame = requestAnimationFrame(seek);
    };
    seek();
    return () => cancelAnimationFrame(frame);
  }, [locationKey, hash]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? '1' : '0');
    } catch {
      /* storage indisponível (aba privada): preferência fica só na sessão */
    }
  }, [sidebarCollapsed]);

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
        setAllAccounts(users);
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
      setAllCharacters(characters);
      setAgentMetrics(computeAgentMetrics(characters));
    });

    const unsubCampaigns = onSnapshot(
      collection(db, 'campaigns'),
      (snap) => {
        const campaigns = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Campaign));
        setCampaignMetrics(computeCampaignMetrics(campaigns));
        setSpotlightCampaigns(campaigns);
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

  const routeOf = <D extends AdminDestinationId>(dest: D): RouteOf<D> | undefined =>
    (route.dest === dest ? route : routeByDest[dest]?.route) as RouteOf<D> | undefined;

  /** Destino ativo leva à raiz dele; os outros reabrem a última rota visitada. */
  const hrefFor = useCallback(
    (dest: AdminDestinationId) => {
      if (dest === route.dest) return destinationRootPath(route);
      const last = routeByDest[dest]?.route;
      return last ? routeToPath(last) : defaultDestinationPath(dest);
    },
    [route, routeByDest]
  );
  const hrefForRef = useRef(hrefFor);
  hrefForRef.current = hrefFor;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSpotlightOpen((prev) => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.key >= '1' && e.key <= '5') {
        const dest = ADMIN_DESTINATIONS.find((d) => d.shortcut === e.key);
        if (dest) {
          e.preventDefault();
          nav.go(hrefForRef.current(dest.id));
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        setSidebarCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [nav]);

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

  const clearScopeRequest = useCallback(() => setScopeRequest(null), []);

  /** "Ver no catálogo" da missão: empilha o catálogo filtrado; Voltar retorna à missão. */
  const openCampaignScope = useCallback(
    (area: CampaignScopedArea, campaignId: string, npcView?: NpcViewId) => {
      const section = area === 'intel' ? 'intel' : area === 'achievements' ? 'conquistas' : 'npcs';
      setScopeRequest({ area, campaignId });
      nav.go(adminPath.content(section, campaignId, npcView));
    },
    [nav]
  );

  const spotlightItems = useMemo(
    () =>
      buildSearchItems({
        accounts: allAccounts,
        characters: allCharacters,
        groups: spotlightGroups.map((g) => ({ id: g.id, name: g.name })),
        campaigns: spotlightCampaigns.map((c) => ({ id: c.id, name: c.name })),
        inventoryMissionId: activeSession?.campaignId,
      }),
    [allAccounts, allCharacters, spotlightGroups, spotlightCampaigns, activeSession?.campaignId]
  );

  const breadcrumb = useMemo(
    () =>
      buildAdminBreadcrumb(route, (key) => t(key), {
        missionName: (id) => campaignLabel(id, spotlightCampaigns),
        accountName: (uid) =>
          masterAccountLabel(allAccounts.find((a) => a.uid === uid), t('entity.accountNoName')),
        agentName: (uid, charId) =>
          allCharacters.find((c) => c.uid === uid && c.char.id === charId)?.char.codinome ||
          t('entity.agentNoCodename'),
      }),
    [route, t, spotlightCampaigns, allAccounts, allCharacters]
  );

  useEffect(() => {
    document.title = `${[...breadcrumb].reverse().map((c) => c.label).join(' · ')} · LimboOS`;
  }, [breadcrumb]);

  // Rascunho só se perde saindo do app (recarga, fechar aba, logout, modo jogador)
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges()) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  const confirmLeaveApp = useCallback(
    async () =>
      !hasUnsavedChanges() ||
      showConfirm(
        t('missions.page.leaveUnsavedTitle'),
        t('missions.page.leaveUnsavedBody'),
        t('missions.page.leaveUnsavedAction')
      ),
    [showConfirm, t]
  );

  const handleLogout = useCallback(async () => {
    if (await confirmLeaveApp()) onLogout();
  }, [confirmLeaveApp, onLogout]);
  useEffect(() => () => {
    document.title = 'LimboOS';
  }, []);

  const modKey = modKeyLabel();

  return (
    <div className="h-screen bg-surface flex relative overflow-hidden font-sans">
      <div className="noise-overlay" />
      <div className="scanlines" />

      {confirmModal}
      {redirect && <Navigate to={redirect.includes('#') ? redirect : `${redirect}${hash}`} replace />}

      <Sidebar
        activeDest={route.dest}
        hrefFor={hrefFor}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
      />

      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        <Header
          user={user}
          onLogout={() => void handleLogout()}
          onSpotlight={() => setSpotlightOpen(true)}
          breadcrumb={breadcrumb}
          sessionLabel={sessionLabel}
          onOpenLive={() => nav.go(hrefFor('live'))}
        />

        <main ref={mainRef} className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 2xl:px-10 custom-scrollbar">
          <div className="max-w-7xl mx-auto space-y-8">
            <React.Suspense
              fallback={
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ ...ADMIN_FADE, delay: 0.12 }}
                  className="flex items-center justify-center p-24"
                  role="status"
                >
                  <div className="flex flex-col items-center gap-4">
                    <RetroSpinner size="md" />
                    <p className="text-[10px] font-display font-bold text-primary uppercase tracking-[0.32em]">
                      {t('loading.data')}
                    </p>
                  </div>
                </motion.div>
              }
            >
              {routeOf('live') && (
                <AdminTabPanel active={route.dest === 'live'}>
                  <LiveWorkspace
                    accounts={allAccounts}
                    characters={allCharacters}
                    onlineCount={onlineCount}
                    errors24h={healthMetrics.errors24h}
                    limboSeized={healthMetrics.limboSeized}
                    activeSession={activeSession}
                    onSessionChange={setActiveSession}
                  />
                </AdminTabPanel>
              )}

              {routeOf('missions') && (
                <AdminTabPanel active={route.dest === 'missions'}>
                  <CampaignsPanel
                    route={routeOf('missions')!}
                    accounts={allAccounts}
                    characters={allCharacters}
                    onOpenScoped={openCampaignScope}
                  />
                </AdminTabPanel>
              )}

              {routeOf('content') && (
                <AdminTabPanel active={route.dest === 'content'}>
                  <ContentPanel
                    route={routeOf('content')!}
                    scopeRequest={scopeRequest}
                    onScopeConsumed={clearScopeRequest}
                  />
                </AdminTabPanel>
              )}

              {routeOf('mesa') && (
                <AdminTabPanel active={route.dest === 'mesa'}>
                  <MesaPanel
                    route={routeOf('mesa')!}
                    locationKey={route.dest === 'mesa' ? locationKey : routeByDest.mesa?.key ?? ''}
                    isAdmin={isAdmin}
                  />
                </AdminTabPanel>
              )}

              {routeOf('system') && (
                <AdminTabPanel active={route.dest === 'system'}>
                  <OperationsPanel
                    route={routeOf('system')!}
                    agents={agentMetrics}
                    campaigns={campaignMetrics}
                    health={healthMetrics}
                    engagement={engagementMetrics}
                  />
                </AdminTabPanel>
              )}
            </React.Suspense>
          </div>
        </main>

        <footer className="h-8 border-t border-seam bg-surface-container-lowest flex items-center justify-between gap-6 px-4 sm:px-6 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="lmb-led text-accent animate-led" aria-hidden />
            <span className="text-[9px] font-display font-bold uppercase tracking-[0.3em] text-ash-500 truncate">
              {t('footer.realtimeSync')}
            </span>
          </div>
          <div className="hidden lg:flex items-center gap-4 text-[9px] text-ash-500" aria-hidden>
            <span className="flex items-center gap-1.5">
              <kbd className="lmb-kbd">{modKey}K</kbd>
              {t('footer.shortcutSearch')}
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="lmb-kbd">{modKey}1–5</kbd>
              {t('footer.shortcutSections')}
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="lmb-kbd">{modKey}\</kbd>
              {t('footer.shortcutMenu')}
            </span>
          </div>
          <span className="text-[9px] font-display font-bold uppercase tracking-[0.3em] text-ash-600 hidden md:inline truncate">
            {t('footer.systemId')}
          </span>
        </footer>
      </div>

      <SpotlightSearch
        open={spotlightOpen}
        onClose={() => setSpotlightOpen(false)}
        items={spotlightItems}
        onNavigate={nav.go}
      />
    </div>
  );
}
