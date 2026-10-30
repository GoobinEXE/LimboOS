import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from 'react-i18next';
import { useDateLocale } from '../../i18n/dateLocale';
import { format, formatDistanceToNow } from "date-fns";
import { useModal } from './ConfirmModal';
import { useToast } from './ToastProvider';
import { userService } from "../../services/UserService";
import { MasterAccount, CharacterData } from "../../types/player";
import { activityLogger } from "../../services/ActivityLogger";
import RetroSpinner from '../../components/player/RetroSpinner';
import AgentDossierView from "./AgentDossierView";
import OverlayPortal from './OverlayPortal';
import { motion, AnimatePresence } from 'motion/react';
import { ADMIN_SPRING, ADMIN_FADE, listItem, staggerDelay } from '../lib/motion';

type SortField = 'masterName' | 'role' | 'createdAt' | 'lastLogin';
type SortDir = 'asc' | 'desc';

/** Safe lookup that only accesses own properties, avoiding prototype chain traversal. */
function getOwnProperty<V>(record: Record<string, V>, key: string): V | undefined {
  return Object.hasOwn(record, key) ? record[key] : undefined;
}

function getAccountStatus(acc: MasterAccount): 'active' | 'inactive' | 'dormant' | 'suspended' | 'unknown' {
  if (acc.suspended) return 'suspended';
  if (!acc.lastLogin) return 'unknown';
  const diffMs = Date.now() - acc.lastLogin.toDate().getTime();
  const days = diffMs / (1000 * 60 * 60 * 24);
  if (days < 7) return 'active';
  if (days < 30) return 'inactive';
  return 'dormant';
}

const STATUS_STYLES = new Map<ReturnType<typeof getAccountStatus>, string>([
  ['active', 'border-phosphor-500/30 text-phosphor-500 bg-phosphor-500/5'],
  ['inactive', 'border-yellow-500/30 text-yellow-500 bg-yellow-500/5'],
  ['dormant', 'border-red-500/30 text-red-500 bg-red-500/5'],
  ['suspended', 'border-red-500/40 text-red-400 bg-red-500/10'],
  ['unknown', 'border-white/5 text-industrial-silver/30'],
]);

const STATUS_KEYS: Record<ReturnType<typeof getAccountStatus>, string> = {
  active: 'accounts.status.active',
  inactive: 'accounts.status.inactive',
  dormant: 'accounts.status.dormant',
  suspended: 'accounts.status.suspended',
  unknown: 'accounts.status.unknown',
};

function statusBadge(status: ReturnType<typeof getAccountStatus>, label: string) {
  const cls = STATUS_STYLES.get(status) ?? 'border-white/5 text-industrial-silver/30';
  return <span className={`text-[9px] font-display font-bold px-2 py-0.5 rounded-sm uppercase tracking-widest border ${cls}`}>{label}</span>;
}

export default function UserRegistry({
  isAdmin,
  embedded = false,
  deepLinkAccountUid,
  deepLinkAgent,
  onDeepLinkConsumed,
}: {
  isAdmin: boolean;
  embedded?: boolean;
  deepLinkAccountUid?: string | null;
  deepLinkAgent?: { uid: string; charId: string } | null;
  onDeepLinkConsumed?: () => void;
}) {
  const { t } = useTranslation('admin');
  const dateLocale = useDateLocale();
  const [accounts, setAccounts] = useState<MasterAccount[]>([]);
  const [charactersByUid, setCharactersByUid] = useState<Record<string, CharacterData[]>>({});
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);

  const { modal } = useModal();
  const toast = useToast();
  const [searchQuery, setSearchQuery] = useState(() => localStorage.getItem('adminSearchQuery') || '');
  const [sortField, setSortField] = useState<SortField>(() => (localStorage.getItem('adminSortField') as SortField) || 'createdAt');
  const [sortDir, setSortDir] = useState<SortDir>(() => (localStorage.getItem('adminSortDir') as SortDir) || 'desc');
  const [showExportMenu, setShowExportMenu] = useState(false);
  
  const [editingAccount, setEditingAccount] = useState<MasterAccount | null>(null);
  const [editMasterName, setEditMasterName] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<{uid: string, char: CharacterData} | null>(null);
  
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUserCodinome, setNewUserCodinome] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState("player");
  const [createUserLoading, setCreateUserLoading] = useState(false);

  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);

  const [showCreateCharacter, setShowCreateCharacter] = useState<string | null>(null);
  const [newCharCodinome, setNewCharCodinome] = useState('');
  const [createCharLoading, setCreateCharLoading] = useState(false);

  // Persist sort/search preferences to localStorage
  useEffect(() => {
    localStorage.setItem('adminSearchQuery', searchQuery);
    localStorage.setItem('adminSortField', sortField);
    localStorage.setItem('adminSortDir', sortDir);
  }, [searchQuery, sortField, sortDir]);

  // Agent count per account
  const agentCountMap = useMemo(() => {
    const map = new Map<string, number>();
    Object.entries(charactersByUid).forEach(([uid, chars]) => {
      map.set(uid, chars.filter(c => !c.archived || showArchived).length);
    });
    return map;
  }, [charactersByUid, showArchived]);

  const allCharacters = useMemo(() => {
    const list: { uid: string; char: CharacterData }[] = [];
    Object.entries(charactersByUid).forEach(([uid, chars]) => {
      chars.forEach(char => {
        list.push({ uid, char });
      });
    });
    return list;
  }, [charactersByUid]);

  // Export accounts
  const handleExport = (format: 'csv' | 'json') => {
    const data = filteredAccounts.map((acc) => ({
      masterName: acc.masterName || '',
      email: acc.email || '',
      role: acc.role,
      lastLogin: acc.lastLogin ? acc.lastLogin.toDate().toISOString() : '',
      createdAt: acc.createdAt ? acc.createdAt.toDate().toISOString() : '',
      suspended: !!acc.suspended,
      agents: agentCountMap.get(acc.uid) ?? 0,
      notes: acc.notes || '',
    }));

    let content: string;
    let mimeType: string;
    let extension: string;

    if (format === 'json') {
      content = JSON.stringify(data, null, 2);
      mimeType = 'application/json';
      extension = 'json';
    } else {
      const headers = ['masterName', 'email', 'role', 'lastLogin', 'createdAt', 'suspended', 'agents', 'notes'] as const;
      type RowKey = (typeof headers)[number];
      const rows = data.map((row) => headers.map((h: RowKey) => `"${String(row[h]).replace(/"/g, '""')}"`).join(','));
      content = [headers.join(','), ...rows].join('\n');
      mimeType = 'text/csv';
      extension = 'csv';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `limboos_accounts_${new Date().toISOString().slice(0, 10)}.${extension}`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
    toast.success(t('accounts.toast.exportOk', { format: format.toUpperCase() }));
  };

  const refreshAgents = async () => {
    // No-op: handled by real-time listener
  };

  useEffect(() => {
    if (!isAdmin) {
      setAccounts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsub = userService.subscribeToUsers((users) => {
      setAccounts(users);
      setLoading(false);
    });

    return () => unsub();
  }, [isAdmin]);

  // Deep link do Spotlight / Dashboard
  useEffect(() => {
    if (!deepLinkAccountUid && !deepLinkAgent) return;
    if (accounts.length === 0) return;

    let cancelled = false;

    const run = async () => {
      const uid = deepLinkAgent?.uid || deepLinkAccountUid;
      if (!uid) return;
      const acc = accounts.find((a) => a.uid === uid);
      if (!acc) {
        onDeepLinkConsumed?.();
        return;
      }

      setExpandedAccounts((prev) => new Set(prev).add(uid));
      let chars = getOwnProperty(charactersByUid, uid);
      if (!chars) {
        try {
          chars = await userService.fetchCharactersForUser(uid);
          if (cancelled) return;
          setCharactersByUid((prev) => ({ ...prev, [uid]: chars! }));
        } catch {
          onDeepLinkConsumed?.();
          return;
        }
      }

      if (cancelled) return;

      if (deepLinkAgent) {
        const char = (chars || []).find((c) => c.id === deepLinkAgent.charId);
        if (char) setSelectedAgent({ uid, char });
        else setEditingAccount(acc);
      } else {
        setEditMasterName(acc.masterName || '');
        setEditNotes(acc.notes || '');
        setEditingAccount(acc);
      }
      onDeepLinkConsumed?.();
    };

    void run();
    return () => {
      cancelled = true;
    };
    // charactersByUid intencionalmente omitido — só reage ao deep link
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkAccountUid, deepLinkAgent, accounts]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserCodinome.trim() || !newUserPassword.trim()) return;
    setCreateUserLoading(true);
    try {
      await userService.adminCreateUser(newUserCodinome, newUserPassword, newUserRole as 'player' | 'admin');
      toast.success(t('accounts.toast.createOk', { name: newUserCodinome }));
      setNewUserCodinome(""); setNewUserPassword("");
      setShowCreateUser(false);
    } catch (error: any) { toast.error(error.message); }
    finally { setCreateUserLoading(false); }
  };

  const handleResetPassword = async (uid: string) => {
    if (!resetPasswordValue.trim() || resetPasswordLoading) return;
    setResetPasswordLoading(true);
    try {
      await userService.resetUserPassword(uid, resetPasswordValue.trim());
      toast.success(t('accounts.toast.passwordOk'));
      setResetPasswordValue("");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setResetPasswordLoading(false);
    }
  };

  const handleToggleSuspend = async (uid: string, currentSuspended: boolean) => {
    try {
      await userService.updateMasterAccount(uid, { suspended: !currentSuspended });
      setEditingAccount(prev => prev ? { ...prev, suspended: !currentSuspended } : null);
      toast.success(!currentSuspended ? t('accounts.toast.suspended') : t('accounts.toast.reactivated'));
    } catch (err) {
      toast.error(t('accounts.toast.statusFail'));
    }
  };

  const handleSaveAccountDetails = async (uid: string) => {
    try {
      await userService.updateMasterAccount(uid, { masterName: editMasterName, notes: editNotes });
      setEditingAccount(prev => prev ? { ...prev, masterName: editMasterName, notes: editNotes } : null);
      toast.success(t('accounts.toast.updated'));
    } catch (err) {
      toast.error(t('accounts.toast.saveFail'));
    }
  };

  const handleOpenEdit = (e: React.MouseEvent, acc: MasterAccount) => {
    e.stopPropagation();
    setEditingAccount(acc);
    setEditMasterName(acc.masterName || '');
    setEditNotes(acc.notes || '');
    setResetPasswordValue('');
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const handleUpdateAccountFlag = async (uid: string, flag: keyof MasterAccount, value: boolean) => {
    try {
      await userService.updateMasterAccount(uid, { [flag]: value });
      setEditingAccount(prev => prev ? { ...prev, [flag]: value } : null);
    } catch (err) {
      console.error("Error updating account flag:", err);
    }
  };

  const handleCreateCharacter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showCreateCharacter || !newCharCodinome.trim()) return;
    setCreateCharLoading(true);
    try {
      await userService.createCharacterForAccount(showCreateCharacter, newCharCodinome);
      toast.success(t('accounts.toast.charCreated', { name: newCharCodinome }));
      setNewCharCodinome('');
      setShowCreateCharacter(null);
      refreshAgents();
      // Auto-expand the account to show the new character
      setExpandedAccounts(prev => {
        const next = new Set(prev);
        next.add(showCreateCharacter);
        return next;
      });
    } catch (error: any) {
      toast.error(t('accounts.toast.charCreateFail'));
      console.error(error);
    } finally {
      setCreateCharLoading(false);
    }
  };

  const toggleExpand = async (uid: string) => {
    const isExpanding = !expandedAccounts.has(uid);

    setExpandedAccounts(prev => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });

    if (isExpanding && !getOwnProperty(charactersByUid, uid)) {
      try {
        const chars = await userService.fetchCharactersForUser(uid);
        setCharactersByUid(prev => ({ ...prev, [uid]: chars }));
      } catch (err) {
        toast.error(t('accounts.toast.charsLoadFail'));
      }
    }
  };

  const filteredAccounts = useMemo(() => {
    let list = accounts.filter((a) => {
      const q = searchQuery.toLowerCase();
      
      // Match account details
      if ((a.email || "").toLowerCase().includes(q) || 
          (a.uid || "").toLowerCase().includes(q) || 
          (a.masterName || "").toLowerCase().includes(q)) {
        return true;
      }

      // Also match if any character of this account matches (only if already loaded)
      const accountChars = getOwnProperty(charactersByUid, a.uid) ?? [];
      const visibleChars = accountChars.filter(char => !char.archived || showArchived);
      return visibleChars.some(char => 
        (char.codinome || "").toLowerCase().includes(q) || 
        (char.id || "").toLowerCase().includes(q)
      );
    });

    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'masterName') cmp = (a.masterName || '').localeCompare(b.masterName || '');
      else if (sortField === 'role') cmp = a.role.localeCompare(b.role);
      else if (sortField === 'createdAt') cmp = (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0);
      else if (sortField === 'lastLogin') cmp = (a.lastLogin?.toMillis() || 0) - (b.lastLogin?.toMillis() || 0);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [accounts, allCharacters, searchQuery, sortField, sortDir, showArchived]);

  return (
    <section className="bg-surface-container-low border border-primary/10 relative overflow-hidden shadow-2xl text-industrial-silver/60 font-sans">
      {modal}
      
      {/* Header */}
      {!embedded && (
      <div className="flex flex-col border-b border-primary/10 bg-black/40">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between p-6 gap-6">
          <div className="flex items-center gap-4">
            <div className="w-1.5 h-8 bg-primary shadow-[0_0_10px_rgba(255,140,0,0.4)]" />
            <div>
              <h2 className="font-display font-bold uppercase tracking-widest text-lg text-white">{t('accounts.title')}</h2>
              <p className="text-[10px] font-display font-bold text-industrial-silver/40 uppercase tracking-widest mt-1">{t('accounts.subtitle')}</p>
            </div>
          </div>
        </div>
      </div>
      )}

      <div className="flex flex-col border-b border-primary/10 bg-black/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between px-6 py-6 gap-6">
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-display font-bold text-industrial-silver/40 tracking-widest uppercase">
              {accounts.length} Contas • {allCharacters.filter(c => !c.char.archived).length} Personagens Ativos
            </span>
            <label className="flex items-center gap-2 cursor-pointer group">
              <input 
                type="checkbox" 
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="hidden"
              />
              <div className={`w-8 h-4 rounded-full transition relative ${showArchived ? 'bg-primary/30 border border-primary' : 'bg-surface-container-lowest border border-white/10'}`}>
                <div className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition ${showArchived ? 'left-4.5 bg-primary' : 'left-1 bg-industrial-silver/40'}`} />
              </div>
              <span className="text-[9px] font-display font-bold text-industrial-silver/30 group-hover:text-primary transition-colors uppercase tracking-widest">{t('accounts.includeArchived')}</span>
            </label>
          </div>
          <div className="flex flex-1 max-w-2xl gap-3">
            <div className="relative flex-1 group">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-industrial-silver/20 text-base group-focus-within:text-primary transition-colors">search</span>
              <input 
                type="text" 
                placeholder={t('accounts.search')} 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                className="w-full bg-surface-container-lowest border border-white/5 text-[11px] font-display font-bold uppercase tracking-[0.2em] text-white pl-10 pr-3 py-3 focus:border-primary/40 outline-none rounded-sm transition" 
              />
            </div>
            {isAdmin && (
              <div className="flex gap-3">
                <div className="relative">
                  <button onClick={() => setShowExportMenu(prev => !prev)} className="flex items-center gap-2 bg-surface-container-lowest border border-white/5 text-industrial-silver/40 hover:text-primary hover:border-primary/20 px-4 py-3 rounded-sm font-display font-bold text-[10px] tracking-widest transition active:scale-[0.97]">
                    <span className="material-symbols-outlined text-base">download</span> {t('accounts.export')}
                  </button>
                  {showExportMenu && (
                    <div className="absolute top-full right-0 mt-1 bg-surface-container-low border border-primary/20 shadow-2xl z-50 min-w-35">
                      <button onClick={() => handleExport('csv')} className="w-full flex items-center gap-3 px-4 py-3 text-[10px] font-display font-bold text-industrial-silver/50 hover:text-primary hover:bg-primary/5 transition uppercase tracking-widest">
                        <span className="material-symbols-outlined text-sm">table_chart</span> CSV
                      </button>
                      <button onClick={() => handleExport('json')} className="w-full flex items-center gap-3 px-4 py-3 text-[10px] font-display font-bold text-industrial-silver/50 hover:text-primary hover:bg-primary/5 transition uppercase tracking-widest border-t border-white/5">
                        <span className="material-symbols-outlined text-sm">data_object</span> JSON
                      </button>
                    </div>
                  )}
                </div>
                <button onClick={() => setShowCreateUser(true)} className="flex items-center gap-3 bg-primary hover:bg-primary-container text-black px-6 py-3 rounded-sm font-display font-bold text-[11px] tracking-widest transition active:scale-[0.97] glow-orange shadow-lg">
                  <span className="material-symbols-outlined text-base">person_add</span> {t('accounts.create')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Accordion Table */}
      <div className="p-6 min-h-150 bg-black/10">
        <div className="overflow-x-auto bg-surface-container-lowest border border-white/5 shadow-inner">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-black/40 border-b border-white/5 text-[10px] font-display font-bold uppercase tracking-widest text-industrial-silver/30">
                <SortHeader label={t('accounts.edit.masterName')} field="masterName" current={sortField} dir={sortDir} onSort={toggleSort} />
                <th className="p-6">{t('accounts.col.networkId')}</th>
                <SortHeader label={t('accounts.col.authority')} field="role" current={sortField} dir={sortDir} onSort={toggleSort} />
                <th className="p-6">{t('accounts.col.status')}</th>
                <th className="p-6">{t('reports.group.agents')}</th>
                <SortHeader label={t('accounts.col.created')} field="createdAt" current={sortField} dir={sortDir} onSort={toggleSort} />
                <SortHeader label={t('accounts.col.lastAccess')} field="lastLogin" current={sortField} dir={sortDir} onSort={toggleSort} />
                <th className="p-6 text-right">{t('accounts.col.actions')}</th>
              </tr>
            </thead>
              {loading ? (
                <tbody className="divide-y divide-white/5">
                <tr>
                  <td colSpan={8} className="p-16 text-center">
                    <RetroSpinner />
                    <p className="text-[10px] font-display font-bold uppercase tracking-widest text-industrial-silver/30 mt-4">
                      Carregando Contas...
                    </p>
                  </td>
                </tr>
                </tbody>
              ) : filteredAccounts.length === 0 ? (
                <tbody className="divide-y divide-white/5">
                <tr>
                  <td colSpan={8} className="p-16 text-center text-industrial-silver/30">
                    <span className="material-symbols-outlined text-3xl mb-2 opacity-50">group_off</span>
                    <p className="text-[10px] font-display font-bold uppercase tracking-widest">
                      {searchQuery ? t('accounts.empty.search') : t('accounts.empty.none')}
                    </p>
                  </td>
                </tr>
                </tbody>
              ) : (
              <AnimatePresence mode="popLayout">
              {filteredAccounts.map((acc, index) => {
                const status = getAccountStatus(acc);
                const isExpanded = expandedAccounts.has(acc.uid);
                const chars = allCharacters.filter(c => c.uid === acc.uid && (!c.char.archived || showArchived));

                return (
                  <motion.tbody
                    key={acc.uid}
                    layout
                    variants={listItem}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    transition={{ ...ADMIN_FADE, delay: staggerDelay(index, 0.02, 0.15) }}
                    className="divide-y divide-white/5"
                  >
                    <tr 
                      onClick={() => toggleExpand(acc.uid)}
                      className={`hover:bg-primary/5 transition group cursor-pointer ${acc.suspended ? 'opacity-40' : ''} ${isExpanded ? 'bg-white/5' : ''}`}
                    >
                      <td className="p-6">
                        <div className="flex items-center gap-2">
                          <span className={`material-symbols-outlined text-sm text-industrial-silver/30 transition-transform ${isExpanded ? 'rotate-90 text-primary' : ''}`}>
                            chevron_right
                          </span>
                          <div className="flex flex-col">
                            <span className="font-display font-bold text-xs text-white uppercase tracking-wider">
                              {acc.displayName || acc.masterName || <span className="text-industrial-silver/20 italic text-[10px]">{t('accounts.pending')}</span>}
                            </span>
                            {acc.displayName && (
                              <span className="text-[9px] text-industrial-silver/30 font-mono uppercase tracking-tighter">ID: {acc.masterName}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-6">
                        <p className="font-mono text-[11px] text-industrial-silver/60 group-hover:text-primary transition-colors">{acc.email || t('accounts.noEmail')}</p>
                        <p className="font-mono text-[9px] text-industrial-silver/20 mt-1 uppercase tracking-tighter">UID: {(acc.uid || "").slice(0, 16)}...</p>
                      </td>
                      <td className="p-6">
                        <span className={`text-[10px] font-display font-bold px-3 py-1 rounded-sm uppercase tracking-widest border ${acc.role === 'admin' ? 'border-primary/30 text-primary bg-primary/5' : 'border-white/5 text-industrial-silver/30'}`}>
                          {acc.role}
                        </span>
                      </td>
                      <td className="p-6">{statusBadge(status, t(STATUS_KEYS[status]))}</td>
                      <td className="p-6">
                        <span className="text-[10px] font-display font-bold text-industrial-silver/40 bg-black/30 border border-white/5 px-2 py-0.5 rounded-sm">
                          {agentCountMap.get(acc.uid) ?? 0}
                        </span>
                      </td>
                      <td className="p-6 font-display font-bold text-[10px] text-industrial-silver/20">{acc.createdAt ? format(acc.createdAt.toDate(), "yyyy.MM.dd") : "---"}</td>
                      <td className="p-6 font-display font-bold text-[10px] text-industrial-silver/20">
                        {acc.lastLogin ? formatDistanceToNow(acc.lastLogin.toDate(), { addSuffix: true, locale: dateLocale }) : "---"}
                      </td>
                      <td className="p-6 text-right">
                         <button onClick={(e) => handleOpenEdit(e, acc)} className="p-2.5 text-industrial-silver/20 hover:text-primary hover:bg-primary/10 rounded-sm material-symbols-outlined text-xl transition active:scale-95" title={t('accounts.settingsTitle')}>settings</button>
                      </td>
                    </tr>
                    
                    {/* Character Sub-Row */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={8} className="p-0 bg-black/20">
                          <div className="p-6 pl-18 border-l-2 border-primary/30 shadow-inner">
                            <div className="flex justify-between items-center mb-6">
                              <h4 className="text-[10px] font-display font-bold uppercase tracking-widest text-industrial-silver/40 flex items-center gap-2">
                                <span className="material-symbols-outlined text-sm">group</span> {t('accounts.linkedChars')}
                              </h4>
                              <button 
                                onClick={(e) => { e.stopPropagation(); setShowCreateCharacter(acc.uid); }} 
                                className="flex items-center gap-2 text-[9px] font-display font-bold uppercase tracking-widest text-primary hover:text-black hover:bg-primary transition border border-primary/20 px-4 py-2 rounded-sm active:scale-[0.97]"
                              >
                                <span className="material-symbols-outlined text-sm">person_add</span> {t('accounts.createChar')}
                              </button>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                              {chars.map(item => (
                                <div 
                                  key={item.char.id} 
                                  onClick={(e) => { e.stopPropagation(); setSelectedAgent(item); }} 
                                  className={`bg-surface-container-low border border-white/5 p-4 hover:border-primary/30 transition cursor-pointer flex justify-between items-center group shadow-md ${item.char.archived ? 'opacity-40 hover:opacity-80 grayscale' : ''}`}
                                >
                                   <div className="flex items-center gap-4">
                                      <div className={`w-10 h-10 rounded-sm bg-black/40 border border-white/5 flex items-center justify-center font-display font-bold text-lg ${item.char.agentStatus === 'vivo' ? 'text-phosphor-500' : 'text-red-500'}`}>
                                        {(item.char.codinome || "?")[0].toUpperCase()}
                                      </div>
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <p className="font-display font-bold text-xs text-white uppercase group-hover:text-primary transition-colors">{item.char.codinome}</p>
                                          {item.char.archived && <span className="material-symbols-outlined text-[10px] text-red-400">inventory_2</span>}
                                        </div>
                                        <p className="font-mono text-[9px] text-industrial-silver/40 tracking-wider">ID: {item.char.id}</p>
                                      </div>
                                   </div>
                                   <div className="flex items-center gap-4 opacity-30 group-hover:opacity-100 transition-opacity">
                                     <span className="text-[9px] font-display font-bold uppercase tracking-widest text-primary">{t('accounts.dossier')}</span>
                                     <span className="material-symbols-outlined text-sm text-primary">arrow_forward_ios</span>
                                   </div>
                                </div>
                              ))}
                              {chars.length === 0 && (
                                <div className="col-span-full py-8 text-center border border-dashed border-white/5 rounded-sm flex flex-col items-center justify-center text-industrial-silver/20">
                                  <span className="material-symbols-outlined text-3xl mb-2 opacity-50">person_off</span>
                                  <p className="text-[10px] font-display font-bold uppercase tracking-widest">{t('accounts.noChars')}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </motion.tbody>
                );
              })}
              </AnimatePresence>
              )}
          </table>
        </div>
      </div>

      {selectedAgent && (
        <AgentDossierView 
          uid={selectedAgent.uid} 
          character={selectedAgent.char} 
          masterAccount={accounts.find(a => a.uid === selectedAgent.uid)!}
          onClose={() => setSelectedAgent(null)}
          onUpdate={refreshAgents}
        />
      )}

      {/* Quick Create Character Modal */}
      <OverlayPortal open={!!showCreateCharacter} onClose={() => setShowCreateCharacter(null)} withExitAnimation>
        <AnimatePresence>
          {showCreateCharacter && (
        <motion.div
          className="fixed inset-0 z-100 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowCreateCharacter(null); }}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="bg-surface-container-low border border-primary/30 p-10 w-full max-w-sm rounded-sm shadow-2xl relative"
          >
            <div className="absolute -top-3 left-6 bg-primary px-2 py-0.5 text-[10px] font-display font-bold text-black tracking-widest uppercase">
              INSERÇÃO RÁPIDA
            </div>
            
            <h3 className="font-display font-bold text-xl text-white uppercase tracking-tighter mb-8 border-b border-white/5 pb-6 mt-2">
              Novo <span className="text-primary">Personagem</span>
            </h3>
            
            <form onSubmit={handleCreateCharacter} className="space-y-8">
              <div className="group">
                <label className="block text-[9px] font-display font-bold text-industrial-silver/40 uppercase tracking-widest mb-2 group-focus-within:text-primary transition-colors">{t('accounts.codename')}</label>
                <input 
                  type="text" 
                  value={newCharCodinome} 
                  onChange={(e) => setNewCharCodinome(e.target.value)} 
                  placeholder={t('accounts.codenamePlaceholder')} 
                  className="w-full bg-surface-container-lowest border-none text-white px-5 py-4 text-[11px] font-display font-bold outline-none uppercase rounded-sm shadow-inner transition" 
                  required 
                  autoFocus
                />
                <div className="h-0.5 w-0 bg-primary transition-[width,color,background-color,border-color,opacity,transform,box-shadow] duration-300 group-focus-within:w-full" />
              </div>

              <div className="flex justify-end gap-4">
                <button type="button" onClick={() => setShowCreateCharacter(null)} className="px-6 py-3 text-[10px] font-display font-bold text-industrial-silver/30 hover:text-white uppercase tracking-widest transition-colors">{t('accounts.cancel')}</button>
                <button type="submit" disabled={createCharLoading} className="bg-primary text-black px-8 py-3 rounded-sm font-display font-bold text-[10px] tracking-widest uppercase hover:bg-primary-container transition active:scale-[0.97] shadow-lg flex items-center gap-2">
                  {createCharLoading ? <RetroSpinner /> : 'CRIAR'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
          )}
        </AnimatePresence>
      </OverlayPortal>

      {/* Edit Account Drawer */}
      <OverlayPortal open={!!editingAccount} onClose={() => { setEditingAccount(null); setResetPasswordValue(""); }} withExitAnimation>
        <AnimatePresence>
          {editingAccount && (
        <motion.div
          className="fixed inset-0 z-100 flex justify-end bg-black/70 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => { if (e.target === e.currentTarget) { setEditingAccount(null); setResetPasswordValue(""); } }}
        >
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={ADMIN_SPRING}
            className="bg-[#222] border-l-8 border-seam w-full max-w-2xl shadow-2xl flex flex-col h-full relative overflow-hidden font-chakra"
          >
            <div className="p-8 border-b-4 border-seam flex justify-between items-start bg-black/40 relative z-20 shrink-0">
               <div>
                 <div className="bg-primary px-2 py-0.5 text-[10px] font-black text-black tracking-widest uppercase inline-block mb-2">{t('accounts.edit.protocol')}</div>
                 <h3 className="font-black text-3xl text-white uppercase tracking-tighter">Diretrizes da <span className="text-primary">Conta</span></h3>
               </div>
               <button onClick={() => { setEditingAccount(null); setResetPasswordValue(""); }} className="text-ash-600 hover:text-white transition material-symbols-outlined -mt-2">close</button>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-8 bg-black/40 space-y-10">
              <div className="bg-seam p-5 border-l-4 border-primary rounded-r-sm shadow-inner group">
                 <span className="text-[9px] font-black text-ash-500 uppercase tracking-[0.3em] block mb-2 group-hover:text-primary transition-colors">{t('accounts.edit.channel')}</span>
                 <span className="text-sm font-mono font-bold text-primary tracking-widest">{editingAccount.email}</span>
                 <p className="font-mono text-[9px] text-ash-600 uppercase tracking-widest font-bold mt-2">
                   UID: {editingAccount.uid}
                 </p>
              </div>

              {/* Nome Mestre + Notas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="group">
                  <label className="block text-[9px] font-black text-ash-500 uppercase tracking-[0.3em] mb-2">{t('accounts.edit.masterName')}</label>
                  <div className="relative">
                    <input type="text" value={editMasterName} onChange={(e) => setEditMasterName(e.target.value)} placeholder={t('accounts.edit.masterPlaceholder')}
                      className="w-full bg-black/60 border-2 border-seam text-white px-4 py-4 text-[11px] font-black outline-none uppercase rounded-sm transition focus:border-primary placeholder:text-ash-700" />
                  </div>
                </div>
                <div>
                  <label className="block text-[9px] font-black text-ash-500 uppercase tracking-[0.3em] mb-2">{t('accounts.edit.notes')}</label>
                  <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Notas sobre este jogador..." rows={3}
                    className="w-full bg-black/60 border-2 border-seam text-white px-4 py-3 text-[11px] font-sans outline-none rounded-sm transition focus:border-primary placeholder:text-ash-700 resize-none custom-scrollbar" />
                </div>
              </div>
              <div className="flex justify-end">
                <button onClick={() => handleSaveAccountDetails(editingAccount.uid)} className="bg-primary hover:bg-primary-container text-black px-8 py-3 rounded-sm font-black text-[10px] tracking-widest uppercase transition active:scale-[0.97] glow-orange shadow-lg">{t('accounts.edit.save')}</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10 pt-8 border-t border-white/5">
                 <div className="space-y-4">
                    <label className="block text-[9px] font-black text-ash-500 uppercase tracking-[0.3em] mb-4">{t('reports.hardware')}</label>
                    <p className="text-[10px] text-ash-500 font-bold uppercase tracking-widest leading-relaxed">
                      Autorização DOS/Mac fica em Sistema → Acesso (grants persistentes). Push durante a sessão fica no Ao Vivo.
                    </p>
                    <a
                      href="/admin?tab=systems&sub=acesso"
                      className="inline-flex items-center gap-2 px-4 py-3 border border-primary/30 text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary/10 transition-colors"
                    >
                      <span className="material-symbols-outlined text-base">lock_open</span>
                      Gerenciar em Acesso
                    </a>
                 </div>
                 <div className="space-y-4">
                    <label className="block text-[9px] font-black text-ash-500 uppercase tracking-[0.3em] mb-4">{t('accounts.edit.authorityLevel')}</label>
                    <select value={editingAccount.role} onChange={(e) => handleUpdateAccountFlag(editingAccount.uid, 'role', e.target.value as any)}
                      className="w-full bg-black/60 border-2 border-seam text-primary text-[11px] font-black px-4 py-4 outline-none transition uppercase rounded-sm cursor-pointer shadow-inner focus:border-primary">
                      <option value="player">PLAYER (RECRUTA)</option>
                      <option value="admin">ADMIN (COMANDO)</option>
                    </select>
                 </div>
              </div>

              {/* Suspender Conta */}
              <div className="pt-8 border-t border-white/5">
                <label className="block text-[9px] font-black text-ash-500 uppercase tracking-[0.3em] mb-4">{t('accounts.edit.accessControl')}</label>
                <button onClick={() => handleToggleSuspend(editingAccount.uid, !!editingAccount.suspended)}
                  className={`w-full flex items-center justify-between px-6 py-5 border-2 transition rounded-sm shadow-inner ${editingAccount.suspended ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20' : 'bg-seam border-transparent text-ash-400 hover:text-white hover:border-white/10'}`}>
                  <span className="text-[10px] font-black uppercase tracking-widest">{editingAccount.suspended ? '⛔ CONTA SUSPENSA — CLIQUE PARA REATIVAR' : 'SUSPENDER CONTA'}</span>
                  <span className={`material-symbols-outlined text-2xl ${editingAccount.suspended ? 'text-red-400' : 'text-ash-600'}`}>{editingAccount.suspended ? 'lock' : 'lock_open'}</span>
                </button>
              </div>

              <div className="pt-8 border-t border-white/5 pb-8">
                <label className="block text-[9px] font-black text-ash-500 uppercase tracking-[0.3em] mb-4">{t('accounts.edit.resetCreds')}</label>
                <div className="flex gap-4">
                  <input type="password" value={resetPasswordValue} onChange={(e) => setResetPasswordValue(e.target.value)} placeholder="NOVA SENHA SIGILOSA..."
                    className="flex-1 bg-black/60 border-2 border-seam text-white px-4 py-4 text-[11px] font-mono outline-none uppercase rounded-sm transition focus:border-primary placeholder:text-ash-700" />
                  <button onClick={() => handleResetPassword(editingAccount.uid)} disabled={resetPasswordLoading || !resetPasswordValue}
                    className="bg-seam text-primary hover:bg-primary hover:text-black disabled:opacity-20 disabled:hover:bg-seam disabled:hover:text-primary px-8 py-4 text-[11px] font-black uppercase tracking-widest transition rounded-sm active:scale-[0.97] shadow-lg border-2 border-primary/20 hover:border-primary">{t('accounts.edit.reset')}</button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
          )}
        </AnimatePresence>
      </OverlayPortal>

      {/* Create User Modal */}
      <OverlayPortal open={showCreateUser} onClose={() => setShowCreateUser(false)} withExitAnimation>
        <AnimatePresence>
          {showCreateUser && (
        <motion.div
          className="fixed inset-0 z-100 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowCreateUser(false); }}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="bg-surface-container-low border border-phosphor-500/30 p-10 w-full max-w-md rounded-sm shadow-2xl relative overflow-hidden"
          >
            <div className="absolute -top-3 left-6 bg-phosphor-500 px-2 py-0.5 text-[10px] font-display font-bold text-black tracking-widest uppercase">
              RECRUTAMENTO-SINTÉTICO
            </div>
            
            <h3 className="font-display font-bold text-2xl text-white uppercase tracking-tighter mb-10 border-b border-white/5 pb-8 mt-2">Nova <span className="text-phosphor-500">Conexão Mestra</span></h3>
            <form onSubmit={handleCreateUser} className="space-y-8">
              <div className="group">
                <label className="block text-[9px] font-display font-bold text-industrial-silver/40 uppercase tracking-widest mb-2 group-focus-within:text-phosphor-500 transition-colors">Identificador Único (ID)</label>
                <input type="text" value={newUserCodinome} onChange={(e) => setNewUserCodinome(e.target.value)} placeholder="ex: agt_silva" className="w-full bg-surface-container-lowest border-none text-white px-5 py-4 text-[11px] font-mono outline-none uppercase rounded-sm shadow-inner transition-[width,color,background-color,border-color,opacity,transform,box-shadow]" required />
                <div className="h-0.5 w-0 bg-phosphor-500 transition-[width,color,background-color,border-color,opacity,transform,box-shadow] duration-300 group-focus-within:w-full" />
              </div>
              <div className="group">
                <label className="block text-[9px] font-display font-bold text-industrial-silver/40 uppercase tracking-widest mb-2 group-focus-within:text-phosphor-500 transition-colors">{t('accounts.createPassword')}</label>
                <input type="password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} placeholder="••••••" className="w-full bg-surface-container-lowest border-none text-white px-5 py-4 text-[11px] font-mono outline-none uppercase rounded-sm shadow-inner transition-[width,color,background-color,border-color,opacity,transform,box-shadow]" required minLength={6} />
                <div className="h-0.5 w-0 bg-phosphor-500 transition-[width,color,background-color,border-color,opacity,transform,box-shadow] duration-300 group-focus-within:w-full" />
              </div>

              <div className="pt-10 flex justify-end gap-6 items-center">
                <button type="button" onClick={() => setShowCreateUser(false)} className="text-[10px] font-display font-bold text-industrial-silver/30 hover:text-white uppercase tracking-widest transition-colors">{t('accounts.abort')}</button>
                <button type="submit" disabled={createUserLoading} className="bg-phosphor-600 text-black px-12 py-4 rounded-sm font-display font-bold text-[11px] tracking-widest uppercase hover:bg-phosphor-500 transition active:scale-[0.97] shadow-lg flex items-center gap-3">
                  {createUserLoading ? <RetroSpinner /> : 'REGISTRAR'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
          )}
        </AnimatePresence>
      </OverlayPortal>
    </section>
  );
}

function ToggleButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center justify-between px-4 py-4 border transition rounded-sm shadow-inner ${
        active ? 'bg-primary/5 border-primary/40 text-primary shadow-[0_0_15px_rgba(255,140,0,0.05)]' : 'bg-surface-container-lowest border-white/5 text-industrial-silver/20 hover:border-white/10'
      }`}
    >
      <span className="text-[10px] font-display font-bold uppercase tracking-widest">{label}</span>
      <span className={`material-symbols-outlined text-2xl ${active ? 'text-primary' : 'text-industrial-silver/10'}`}>{active ? 'toggle_on' : 'toggle_off'}</span>
    </button>
  );
}

function SortHeader({ label, field, current, dir, onSort }: { label: string; field: SortField; current: SortField; dir: SortDir; onSort: (f: SortField) => void }) {
  const isActive = current === field;
  return (
    <th className="p-6 cursor-pointer select-none group" onClick={() => onSort(field)}>
      <div className="flex items-center gap-2">
        <span className={isActive ? 'text-primary' : ''}>{label}</span>
        <span className={`material-symbols-outlined text-xs transition ${isActive ? 'text-primary opacity-100' : 'opacity-0 group-hover:opacity-30'}`}>
          {isActive && dir === 'desc' ? 'arrow_downward' : 'arrow_upward'}
        </span>
      </div>
    </th>
  );
}
