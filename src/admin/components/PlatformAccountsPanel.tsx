import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { callFunction } from '../../lib/functions';
import { userService } from '../../services/UserService';
import { useToast } from './ToastProvider';
import RetroSpinner from '../../components/player/RetroSpinner';

interface PlatformAccount {
  uid: string;
  email: string | null;
  masterName: string | null;
  displayName: string | null;
  suspended: boolean;
  createdAt: string | null;
  lastSignIn: string | null;
  providers: string[];
}

const FIELD =
  'bg-black/40 border border-border-subtle text-[11px] font-mono text-bone px-3 py-2 outline-none rounded-sm focus:border-primary/40 transition';

/**
 * Sistema → Contas (só com o claim platformAdmin). Mostra dados de conta vindos
 * da Function listAccounts; o conteúdo das pastas dos mestres não passa por aqui.
 */
export default function PlatformAccountsPanel() {
  const { t, i18n } = useTranslation('admin');
  const toast = useToast();
  const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
  const [nextPage, setNextPage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const [newMasterId, setNewMasterId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async (pageToken?: string | null) => {
    setLoading(true);
    try {
      const res = await callFunction<Record<string, unknown>, { accounts: PlatformAccount[]; nextPageToken: string | null }>(
        'listAccounts',
        { limit: 200, ...(pageToken ? { pageToken } : {}) },
      );
      setAccounts((prev) => (pageToken ? [...prev, ...res.accounts] : res.accounts));
      setNextPage(res.nextPageToken);
    } catch (err) {
      console.error('[PlatformAccountsPanel] listAccounts failed:', err);
      toast.error(t('platform.toast.fail'));
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((a) =>
      [a.email, a.masterName, a.displayName, a.uid].some((v) => (v || '').toLowerCase().includes(q)),
    );
  }, [accounts, search]);

  const toggleSuspended = async (acc: PlatformAccount) => {
    setBusyUid(acc.uid);
    try {
      await callFunction('setAccountSuspended', { targetUid: acc.uid, suspended: !acc.suspended });
      setAccounts((prev) => prev.map((a) => (a.uid === acc.uid ? { ...a, suspended: !acc.suspended } : a)));
      toast.success(t('platform.toast.saved'));
    } catch (err) {
      console.error(err);
      toast.error(t('platform.toast.fail'));
    } finally {
      setBusyUid(null);
    }
  };

  const resetPassword = async (acc: PlatformAccount) => {
    const value = (passwords[acc.uid] || '').trim();
    if (value.length < 6) return;
    setBusyUid(acc.uid);
    try {
      await userService.resetUserPassword(acc.uid, value);
      setPasswords((prev) => ({ ...prev, [acc.uid]: '' }));
      toast.success(t('platform.toast.password'));
    } catch (err) {
      console.error(err);
      toast.error(t('platform.toast.fail'));
    } finally {
      setBusyUid(null);
    }
  };

  const createAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMasterId.trim() || newPassword.length < 6 || creating) return;
    setCreating(true);
    try {
      await userService.adminCreateUser(newMasterId.trim(), newPassword);
      setNewMasterId('');
      setNewPassword('');
      toast.success(t('platform.toast.created'));
      void load();
    } catch (err) {
      console.error(err);
      toast.error(t('platform.toast.fail'));
    } finally {
      setCreating(false);
    }
  };

  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(i18n.language) : '—');

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="font-display font-bold uppercase tracking-[0.18em] text-sm text-bone">{t('platform.title')}</h3>
        <p className="text-[11px] text-ash-500">{t('platform.body')}</p>
      </div>

      <form onSubmit={createAccount} className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end" aria-label={t('platform.createTitle')}>
        <label className="flex-1 space-y-1">
          <span className="block text-[9px] font-display font-bold uppercase tracking-widest text-ash-500">{t('platform.masterId')}</span>
          <input value={newMasterId} onChange={(e) => setNewMasterId(e.target.value)} className={`${FIELD} w-full`} />
        </label>
        <label className="flex-1 space-y-1">
          <span className="block text-[9px] font-display font-bold uppercase tracking-widest text-ash-500">{t('platform.password')}</span>
          <input type="password" minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={`${FIELD} w-full`} />
        </label>
        <button type="submit" disabled={creating || !newMasterId.trim() || newPassword.length < 6} className="lmb-btn lmb-btn-primary">
          {creating ? <RetroSpinner /> : t('platform.create')}
        </button>
      </form>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('platform.search')}
        aria-label={t('platform.search')}
        className={`${FIELD} w-full`}
      />

      <ul className="space-y-2">
        {visible.map((acc) => (
          <li key={acc.uid} className="bg-white/5 border border-border rounded-sm p-3 flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-display font-bold text-bone uppercase tracking-wider truncate">
                {acc.masterName || acc.displayName || acc.email || acc.uid}
              </p>
              <p className="text-[10px] font-mono text-ash-500 truncate">
                {acc.email || acc.uid} · {t('platform.lastSignIn')}: {fmt(acc.lastSignIn)}
              </p>
            </div>
            <span className={`text-[9px] font-display font-bold uppercase tracking-widest px-2 py-0.5 border rounded-sm self-start lg:self-auto ${acc.suspended ? 'border-red-500/40 text-red-400' : 'border-phosphor-500/30 text-phosphor-500'}`}>
              {acc.suspended ? t('platform.suspended') : t('platform.active')}
            </span>
            <div className="flex gap-2">
              <input
                type="password"
                value={passwords[acc.uid] || ''}
                onChange={(e) => setPasswords((prev) => ({ ...prev, [acc.uid]: e.target.value }))}
                placeholder={t('platform.newPassword')}
                aria-label={`${t('platform.newPassword')} ${acc.email || acc.uid}`}
                className={`${FIELD} w-36`}
              />
              <button type="button" onClick={() => void resetPassword(acc)} disabled={busyUid === acc.uid || (passwords[acc.uid] || '').length < 6} className="lmb-btn">
                {t('platform.setPassword')}
              </button>
              <button type="button" onClick={() => void toggleSuspended(acc)} disabled={busyUid === acc.uid} className={`lmb-btn ${acc.suspended ? '' : 'text-red-400'}`}>
                {acc.suspended ? t('platform.reactivate') : t('platform.suspend')}
              </button>
            </div>
          </li>
        ))}
      </ul>

      {loading ? (
        <RetroSpinner />
      ) : nextPage ? (
        <button type="button" onClick={() => void load(nextPage)} className="lmb-btn">{t('platform.loadMore')}</button>
      ) : null}
    </div>
  );
}
