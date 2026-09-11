import React, { useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { MasterAccount, CharacterData, Group } from '../../types/player';
import type { Campaign } from '../../data/campaigns';
import { isAdminAccount } from '../../lib/adminAccess';
import { groupService } from '../../services/GroupService';
import type { AdminActiveSession } from '../hooks/useAdminActiveSession';
import { useToast } from './ToastProvider';
import { ONLINE_WINDOW_MS, useHardwareAccessActions } from '../hooks/useHardwareAccessActions';
import { useModal } from './ConfirmModal';
import SessionGlobalsPanel from './SessionGlobalsPanel';
import LiveDeliverDrawer, {
  type LiveDeliverKind,
  type LiveDeliverTarget,
} from './LiveDeliverDrawer';
import JukeboxPanel from './JukeboxPanel';
import SystemLogPanel from './SystemLogPanel';

interface LiveWorkspaceProps {
  accounts: MasterAccount[];
  characters: { uid: string; char: CharacterData }[];
  onlineCount: number;
  errors24h: number;
  limboSeized: boolean;
  activeSession: AdminActiveSession | null;
  onSessionChange: (session: AdminActiveSession | null) => void;
  onOpenSystems: () => void;
  onOpenMesa: (groupId?: string) => void;
  onOpenMedia: () => void;
  onOpenFullLog: () => void;
  onOpenMission?: (campaignId: string) => void;
  scrollToJukebox?: boolean;
}

interface PresenceRow {
  uid: string;
  label: string;
  email?: string;
  lastLoginMs: number;
  agentName?: string;
  character?: CharacterData;
  forceTerminal?: boolean;
  forceMac?: boolean;
  hasTerminalAccess?: boolean;
  hasMacAccess?: boolean;
  pendingVideo?: boolean;
}

/**
 * Workspace Ao Vivo — sessão ativa, presença selecionável, entrega, push, globais, jukebox e log.
 */
export default function LiveWorkspace({
  accounts,
  characters,
  onlineCount,
  errors24h,
  limboSeized,
  activeSession,
  onSessionChange,
  onOpenSystems,
  onOpenMesa,
  onOpenMedia,
  onOpenFullLog,
  onOpenMission,
}: LiveWorkspaceProps) {
  const toast = useToast();
  const { showConfirm, modal } = useModal();
  const { pushDos, pushMac, grantDos, grantMac, isBusy } = useHardwareAccessActions();
  const [menuUid, setMenuUid] = useState<string | null>(null);
  const [selectedUids, setSelectedUids] = useState<Set<string>>(new Set());
  const [deliverKind, setDeliverKind] = useState<LiveDeliverKind | null>(null);
  const [deliverTargets, setDeliverTargets] = useState<LiveDeliverTarget[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [sessionOnly, setSessionOnly] = useState(true);

  useEffect(() => {
    const unsubGroups = groupService.subscribeToGroups(setGroups);
    const unsubCampaigns = onSnapshot(collection(db, 'campaigns'), (snap) => {
      const list: Campaign[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Campaign));
      setCampaigns(list);
    });
    return () => {
      unsubGroups();
      unsubCampaigns();
    };
  }, []);

  useEffect(() => {
    if (activeSession?.groupId) setSessionOnly(true);
  }, [activeSession?.groupId]);

  const activeGroup = useMemo(
    () => groups.find((g) => g.id === activeSession?.groupId) || null,
    [groups, activeSession?.groupId]
  );

  const sessionMemberKeys = useMemo(() => {
    const map = new Map<string, string>(); // uid -> preferred characterId
    (activeGroup?.characterSlots || []).forEach((s) => {
      if (!map.has(s.uid)) map.set(s.uid, s.characterId);
    });
    return map;
  }, [activeGroup]);

  const sessionMemberUids = useMemo(() => [...sessionMemberKeys.keys()], [sessionMemberKeys]);

  const allOnlineRows = useMemo(() => {
    const now = Date.now();
    const charsByUid = new Map<string, CharacterData[]>();
    characters.forEach(({ uid, char }) => {
      if (char.archived) return;
      const list = charsByUid.get(uid) || [];
      list.push(char);
      charsByUid.set(uid, list);
    });

    const online: PresenceRow[] = [];
    accounts.forEach((acc) => {
      if (isAdminAccount(acc)) return;
      const ms = acc.lastLogin?.toMillis?.() ?? 0;
      if (!ms || now - ms > ONLINE_WINDOW_MS) return;
      const agents = charsByUid.get(acc.uid) || [];
      const preferredId = sessionMemberKeys.get(acc.uid);
      const primary =
        (preferredId ? agents.find((c) => c.id === preferredId) : undefined) || agents[0];
      online.push({
        uid: acc.uid,
        label: acc.masterName || acc.displayName || acc.email || acc.uid.slice(0, 8),
        email: acc.email,
        lastLoginMs: ms,
        agentName: primary?.codinome,
        character: primary,
        forceTerminal: Boolean(acc.forceTerminalOpen),
        forceMac: Boolean(acc.forceMacOpen),
        pendingVideo: Boolean(primary?.pendingVideoPlay?.intelId),
        hasTerminalAccess: Boolean(acc.hasTerminalAccess),
        hasMacAccess: Boolean(acc.hasMacAccess),
      });
    });

    online.sort((a, b) => b.lastLoginMs - a.lastLoginMs);
    return online.slice(0, 24);
  }, [accounts, characters, sessionMemberKeys]);

  const filteringBySession = Boolean(activeSession?.groupId && sessionOnly && sessionMemberUids.length > 0);

  const rows = useMemo(() => {
    if (!filteringBySession) return allOnlineRows;
    return allOnlineRows.filter((r) => sessionMemberKeys.has(r.uid));
  }, [allOnlineRows, filteringBySession, sessionMemberKeys]);

  const onlineUids = useMemo(() => rows.map((r) => r.uid), [rows]);
  const onlineLabels = useMemo(
    () => rows.map((r) => r.agentName || r.label).join(', '),
    [rows]
  );

  const resolveDeliverTargets = async (preferUids?: string[]): Promise<LiveDeliverTarget[] | null> => {
    let uids = preferUids?.length
      ? preferUids
      : selectedUids.size > 0
        ? [...selectedUids]
        : onlineUids;

    if (uids.length === 0) {
      toast.info('Nenhum agente online para entregar');
      return null;
    }

    if (!preferUids?.length && selectedUids.size === 0 && onlineUids.length > 0) {
      const scopeLabel = filteringBySession
        ? `todos os ${onlineUids.length} da sessão online`
        : `todos os ${onlineUids.length} online`;
      const ok = await showConfirm(
        filteringBySession ? 'Entregar à sessão online' : 'Entregar a todos online',
        `Nenhum agente marcado. Entregar para ${scopeLabel}?`,
        'Entregar'
      );
      if (!ok) return null;
      uids = onlineUids;
    }

    const targets: LiveDeliverTarget[] = [];
    for (const uid of uids) {
      const row = rows.find((r) => r.uid === uid) || allOnlineRows.find((r) => r.uid === uid);
      if (!row?.character) continue;
      targets.push({
        uid,
        characterId: row.character.id,
        character: row.character,
        label: row.agentName || row.label,
      });
    }

    if (targets.length === 0) {
      toast.error('Alvos sem personagem ativo');
      return null;
    }
    return targets;
  };

  const openDeliver = async (kind: LiveDeliverKind, preferUids?: string[]) => {
    const targets = await resolveDeliverTargets(preferUids);
    if (!targets) return;
    setDeliverTargets(targets);
    setDeliverKind(kind);
  };

  const toggleSelect = (uid: string) => {
    setSelectedUids((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedUids.size === rows.length) setSelectedUids(new Set());
    else setSelectedUids(new Set(onlineUids));
  };

  const handlePushDos = async (row: PresenceRow) => {
    try {
      await pushDos([row.uid], row.agentName || row.label);
      toast.success(`DOS empurrado para ${row.agentName || row.label}`);
    } catch {
      toast.error('Falha ao empurrar DOS');
    }
  };

  const handlePushMac = async (row: PresenceRow) => {
    try {
      await pushMac([row.uid], row.agentName || row.label);
      toast.success(`Mac empurrado para ${row.agentName || row.label}`);
    } catch {
      toast.error('Falha ao empurrar Mac');
    }
  };

  const handleGroupSelect = (groupId: string) => {
    if (!groupId) {
      onSessionChange(null);
      return;
    }
    const group = groups.find((g) => g.id === groupId);
    onSessionChange({
      groupId,
      campaignId: group?.campaignId || activeSession?.campaignId || '',
    });
  };

  const handleCampaignSelect = (campaignId: string) => {
    if (!activeSession?.groupId) return;
    onSessionChange({
      groupId: activeSession.groupId,
      campaignId,
    });
  };

  return (
    <div className="space-y-8">
      {modal}

      {/* Sessão ativa */}
      <section className="border border-emerald-500/20 bg-surface-container-low/60 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="material-symbols-outlined text-emerald-400 text-xl">event_available</span>
            <div className="min-w-0">
              <h2 className="font-display font-bold uppercase tracking-widest text-sm text-white">
                Sessão Ativa
              </h2>
              <p className="text-[9px] font-display uppercase tracking-[0.25em] text-industrial-silver/40 truncate">
                Esquadrão + missão da noite (só neste browser)
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {activeSession?.campaignId && onOpenMission && (
              <button
                type="button"
                onClick={() => onOpenMission(activeSession.campaignId)}
                className="text-[9px] font-display font-bold uppercase tracking-widest px-3 py-1.5 border border-primary/30 text-primary hover:bg-primary/10"
              >
                Abrir missão
              </button>
            )}
            {activeSession?.groupId && (
              <button
                type="button"
                onClick={() => onOpenMesa(activeSession.groupId)}
                className="text-[9px] font-display font-bold uppercase tracking-widest px-3 py-1.5 border border-primary/30 text-primary hover:bg-primary/10"
              >
                Abrir esquadrão
              </button>
            )}
            {activeSession && (
              <button
                type="button"
                onClick={() => onSessionChange(null)}
                className="text-[9px] font-display font-bold uppercase tracking-widest px-3 py-1.5 border border-white/10 text-zinc-500 hover:text-red-400 hover:border-red-500/30"
              >
                Limpar
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="space-y-1.5">
            <span className="text-[9px] font-display font-bold uppercase tracking-widest text-zinc-500">
              Esquadrão
            </span>
            <select
              value={activeSession?.groupId || ''}
              onChange={(e) => handleGroupSelect(e.target.value)}
              className="w-full bg-black/50 border border-white/10 px-3 py-2.5 text-[10px] font-display font-bold uppercase tracking-widest text-white outline-none focus:border-emerald-500/40"
            >
              <option value="">Nenhum</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-[9px] font-display font-bold uppercase tracking-widest text-zinc-500">
              Missão
            </span>
            <select
              value={activeSession?.campaignId || ''}
              onChange={(e) => handleCampaignSelect(e.target.value)}
              disabled={!activeSession?.groupId}
              className="w-full bg-black/50 border border-white/10 px-3 py-2.5 text-[10px] font-display font-bold uppercase tracking-widest text-white outline-none focus:border-emerald-500/40 disabled:opacity-30"
            >
              <option value="">Nenhuma</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {activeSession?.groupId && (
          <label className="flex items-center gap-2 cursor-pointer group w-fit">
            <input
              type="checkbox"
              checked={sessionOnly}
              onChange={(e) => setSessionOnly(e.target.checked)}
              className="accent-emerald-500"
            />
            <span className="text-[9px] font-display font-bold uppercase tracking-widest text-industrial-silver/50 group-hover:text-emerald-400">
              Só sessão na presença / entrega
            </span>
          </label>
        )}
      </section>

      {/* Faixa compacta */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniStat label="Online" value={String(onlineCount || allOnlineRows.length)} icon="sensors" accent="emerald" />
        <MiniStat label="Erros 24h" value={String(errors24h)} icon="error" accent="primary" />
        <MiniStat
          label="Limbo"
          value={limboSeized ? 'TOMADO' : 'LIVRE'}
          icon="security"
          accent={limboSeized ? 'red' : 'emerald'}
        />
        <MiniStat
          label="Selecionados"
          value={String(selectedUids.size || (rows.length > 0 ? 'todos*' : '0'))}
          icon="checklist"
          accent="primary"
        />
      </div>

      {/* Presença + Entregar */}
      <section className="border border-primary/20 bg-surface-container-low/60 overflow-hidden">
        <div className="flex flex-col gap-3 px-4 sm:px-6 py-4 border-b border-primary/10 bg-black/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <div className="min-w-0">
                <h2 className="font-display font-bold uppercase tracking-widest text-sm text-white truncate">
                  Mesa ao Vivo
                </h2>
                <p className="text-[9px] font-display uppercase tracking-[0.25em] text-industrial-silver/40 truncate">
                  {filteringBySession
                    ? `${rows.length} da sessão online // ${activeGroup?.name || 'esquadrão'}`
                    : `${rows.length} online // selecione e entregue`}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <QuickBtn label="Sistema" icon="tune" onClick={onOpenSystems} />
              <QuickBtn label="Mesa" icon="groups" onClick={() => onOpenMesa()} />
              <QuickBtn label="Conteúdo" icon="folder_open" onClick={onOpenMedia} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[9px] font-display font-bold uppercase tracking-widest text-industrial-silver/40 mr-1">
              Entregar
            </span>
            <DeliverBtn label="Intel" icon="inventory_2" onClick={() => openDeliver('intel')} disabled={rows.length === 0} />
            <DeliverBtn label="Conquista" icon="emoji_events" onClick={() => openDeliver('achievements')} disabled={rows.length === 0} />
            <DeliverBtn label="SMS" icon="sms" onClick={() => openDeliver('sms')} disabled={rows.length === 0} />
            <DeliverBtn label="Vídeo" icon="videocam" onClick={() => openDeliver('video')} disabled={rows.length === 0} />

            <span className="w-px h-5 bg-white/10 mx-1 hidden sm:block" />

            <button
              type="button"
              disabled={rows.length === 0 || isBusy('dos', 'push')}
              onClick={async () => {
                try {
                  await pushDos(onlineUids, onlineLabels || `${onlineUids.length} online`);
                  toast.success(`DOS empurrado para ${onlineUids.length} online`);
                } catch {
                  toast.error('Falha ao empurrar DOS');
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-black text-[9px] font-display font-bold uppercase tracking-widest hover:bg-primary-container transition-colors disabled:opacity-20"
            >
              <span className="material-symbols-outlined text-sm">terminal</span>
              DOS → todos
            </button>
            <button
              type="button"
              disabled={rows.length === 0 || isBusy('mac', 'push')}
              onClick={async () => {
                try {
                  await pushMac(onlineUids, onlineLabels || `${onlineUids.length} online`);
                  toast.success(`Mac empurrado para ${onlineUids.length} online`);
                } catch {
                  toast.error('Falha ao empurrar Mac');
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-200 text-black text-[9px] font-display font-bold uppercase tracking-widest hover:bg-white transition-colors disabled:opacity-20"
            >
              <span className="material-symbols-outlined text-sm">laptop_mac</span>
              Mac → todos
            </button>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-[10px] font-display font-bold uppercase tracking-[0.3em] text-industrial-silver/25">
              {filteringBySession
                ? 'Nenhum membro da sessão online'
                : 'Nenhum agente com login recente'}
            </p>
            {filteringBySession ? (
              <button
                type="button"
                onClick={() => setSessionOnly(false)}
                className="mt-4 text-[9px] font-display font-bold uppercase tracking-widest text-primary/60 hover:text-primary"
              >
                Ver todos online
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenSystems}
                className="mt-4 text-[9px] font-display font-bold uppercase tracking-widest text-primary/60 hover:text-primary"
              >
                Abrir Sistema → Acesso (grants offline)
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="px-4 sm:px-6 py-2 border-b border-white/5 bg-black/15 flex items-center justify-between">
              <button
                type="button"
                onClick={selectAll}
                className="text-[9px] font-display font-bold uppercase tracking-widest text-zinc-500 hover:text-primary"
              >
                {selectedUids.size === rows.length
                  ? `Limpar seleção (${selectedUids.size})`
                  : `Selecionar todos (${rows.length})`}
              </button>
              <span className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest">
                {selectedUids.size > 0 ? `${selectedUids.size} marcados` : 'sem marca = todos*'}
              </span>
            </div>
            <ul className="divide-y divide-white/5">
              {rows.map((row) => {
                const selected = selectedUids.has(row.uid);
                const dosBusy = isBusy('dos', 'push', row.uid) || isBusy('dos', 'revoke', row.uid);
                const macBusy = isBusy('mac', 'push', row.uid) || isBusy('mac', 'revoke', row.uid);
                return (
                  <li
                    key={row.uid}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-6 py-3 transition-colors ${
                      selected ? 'bg-primary/5' : 'hover:bg-primary/5'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={() => toggleSelect(row.uid)}
                        className={`mt-0.5 w-5 h-5 border-2 rounded-sm shrink-0 flex items-center justify-center ${
                          selected ? 'bg-primary border-primary' : 'border-zinc-700 hover:border-zinc-500'
                        }`}
                        aria-label="Selecionar"
                      >
                        {selected && (
                          <span className="material-symbols-outlined text-black text-xs font-black">check</span>
                        )}
                      </button>
                      <div className="min-w-0">
                        <p className="text-[11px] font-display font-bold uppercase tracking-widest text-white truncate">
                          {row.label}
                          {row.agentName ? (
                            <span className="text-primary/80 font-normal"> // {row.agentName}</span>
                          ) : null}
                        </p>
                        <p className="text-[9px] font-mono text-industrial-silver/35 truncate mt-0.5">
                          {formatDistanceToNow(row.lastLoginMs, { addSuffix: true, locale: ptBR })}
                          {row.email ? ` · ${row.email}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0 sm:pl-8">
                      {row.pendingVideo && (
                        <span className="text-[8px] font-display font-bold uppercase tracking-wider px-2 py-0.5 border border-orange-400/40 text-orange-400/80">
                          Vídeo
                        </span>
                      )}
                      {row.forceTerminal ? (
                        <span className="text-[8px] font-display font-bold uppercase tracking-wider px-2 py-0.5 border border-primary/40 text-primary animate-pulse">
                          Push pendente
                        </span>
                      ) : row.hasTerminalAccess ? (
                        <span className="text-[8px] font-display font-bold uppercase tracking-wider px-2 py-0.5 border border-emerald-500/30 text-emerald-500/80">
                          Acesso DOS
                        </span>
                      ) : null}
                      {row.forceMac ? (
                        <span className="text-[8px] font-display font-bold uppercase tracking-wider px-2 py-0.5 border border-cyan-400/40 text-cyan-400 animate-pulse">
                          Push Mac
                        </span>
                      ) : row.hasMacAccess ? (
                        <span className="text-[8px] font-display font-bold uppercase tracking-wider px-2 py-0.5 border border-white/20 text-industrial-silver/60">
                          Acesso Mac
                        </span>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => openDeliver('intel', [row.uid])}
                        className="text-[8px] font-display font-bold uppercase tracking-wider px-2 py-1 border border-primary/30 text-primary/80 hover:bg-primary/10"
                        title="Entregar a este agente"
                      >
                        Entregar
                      </button>
                      <button
                        type="button"
                        disabled={dosBusy}
                        onClick={() => handlePushDos(row)}
                        className="text-[8px] font-display font-bold uppercase tracking-wider px-2.5 py-1 bg-primary text-black hover:bg-primary-container disabled:opacity-30"
                      >
                        DOS
                      </button>
                      <button
                        type="button"
                        disabled={macBusy}
                        onClick={() => handlePushMac(row)}
                        className="text-[8px] font-display font-bold uppercase tracking-wider px-2.5 py-1 bg-zinc-200 text-black hover:bg-white disabled:opacity-30"
                      >
                        Mac
                      </button>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setMenuUid((prev) => (prev === row.uid ? null : row.uid))}
                          className="text-[8px] font-display font-bold uppercase tracking-wider px-2 py-1 border border-white/10 text-industrial-silver/50 hover:text-white"
                        >
                          ⋯
                        </button>
                        {menuUid === row.uid && (
                          <div className="absolute right-0 top-full mt-1 z-20 min-w-40 bg-[#1a1a1a] border border-white/10 shadow-xl py-1">
                            <button
                              type="button"
                              onClick={() => {
                                setMenuUid(null);
                                openDeliver('achievements', [row.uid]);
                              }}
                              className="w-full text-left px-3 py-2 text-[9px] font-display font-bold uppercase tracking-widest text-zinc-400 hover:bg-primary/10 hover:text-primary"
                            >
                              Outorgar conquista
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setMenuUid(null);
                                openDeliver('sms', [row.uid]);
                              }}
                              className="w-full text-left px-3 py-2 text-[9px] font-display font-bold uppercase tracking-widest text-zinc-400 hover:bg-primary/10 hover:text-primary"
                            >
                              Enviar SMS
                            </button>
                            <button
                              type="button"
                              disabled={!row.hasTerminalAccess && !row.forceTerminal}
                              onClick={async () => {
                                setMenuUid(null);
                                try {
                                  await grantDos([row.uid], false, row.agentName || row.label);
                                  toast.info(`DOS revogado: ${row.agentName || row.label}`);
                                } catch {
                                  toast.error('Falha ao revogar DOS');
                                }
                              }}
                              className="w-full text-left px-3 py-2 text-[9px] font-display font-bold uppercase tracking-widest text-zinc-400 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-20"
                            >
                              Revogar DOS
                            </button>
                            <button
                              type="button"
                              disabled={!row.hasMacAccess && !row.forceMac}
                              onClick={async () => {
                                setMenuUid(null);
                                try {
                                  await grantMac([row.uid], false, row.agentName || row.label);
                                  toast.info(`Mac revogado: ${row.agentName || row.label}`);
                                } catch {
                                  toast.error('Falha ao revogar Mac');
                                }
                              }}
                              className="w-full text-left px-3 py-2 text-[9px] font-display font-bold uppercase tracking-widest text-zinc-400 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-20"
                            >
                              Revogar Mac
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      <section className="space-y-3">
        <SectionLabel title="Controles_de_Sessão" />
        <SessionGlobalsPanel />
      </section>

      <section id="admin-jukebox" className="space-y-3">
        <SectionLabel title="Jukebox_da_Mesa" />
        <JukeboxPanel embedded />
      </section>

      <section className="space-y-3 border-t border-primary/10 pt-8">
        <div className="flex items-center justify-between gap-3">
          <SectionLabel title="Log_Recente" />
          <button
            type="button"
            onClick={onOpenFullLog}
            className="text-[9px] font-display font-bold uppercase tracking-widest text-primary/60 hover:text-primary shrink-0"
          >
            Ver log completo →
          </button>
        </div>
        <SystemLogPanel compact filterUids={filteringBySession ? sessionMemberUids : undefined} />
      </section>

      {deliverKind && (
        <LiveDeliverDrawer
          kind={deliverKind}
          targets={deliverTargets}
          onClose={() => {
            setDeliverKind(null);
            setDeliverTargets([]);
          }}
          onSuccess={() => {
            setDeliverKind(null);
            setDeliverTargets([]);
          }}
        />
      )}
    </div>
  );
}

function SectionLabel({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-linear-to-r from-transparent to-primary/20" />
      <h3 className="text-industrial-silver/40 font-display text-[10px] uppercase font-bold tracking-[0.3em]">
        {title}
      </h3>
      <div className="h-px flex-1 bg-linear-to-l from-transparent to-primary/20" />
    </div>
  );
}

function MiniStat({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: string;
  accent: 'emerald' | 'primary' | 'red';
}) {
  const color =
    accent === 'emerald'
      ? 'text-emerald-400 border-emerald-500/20'
      : accent === 'red'
        ? 'text-red-400 border-red-500/30'
        : 'text-primary border-primary/20';
  return (
    <div className={`bg-surface-container-low border p-4 relative overflow-hidden ${color}`}>
      <p className="font-display text-[9px] uppercase font-bold tracking-[0.2em] text-industrial-silver/40 mb-1">
        {label}
      </p>
      <p className="text-2xl font-display font-bold tracking-tight">{value}</p>
      <span className="material-symbols-outlined absolute -right-1 -bottom-1 text-4xl opacity-10">{icon}</span>
    </div>
  );
}

function QuickBtn({ label, icon, onClick }: { label: string; icon: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-primary/20 text-[9px] font-display font-bold uppercase tracking-widest text-primary/80 hover:bg-primary/10 transition-colors"
    >
      <span className="material-symbols-outlined text-sm">{icon}</span>
      {label}
    </button>
  );
}

function DeliverBtn({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-primary/30 bg-primary/5 text-[9px] font-display font-bold uppercase tracking-widest text-primary hover:bg-primary/15 transition-colors disabled:opacity-20"
    >
      <span className="material-symbols-outlined text-sm">{icon}</span>
      {label}
    </button>
  );
}
