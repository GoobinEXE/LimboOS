import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useIntlLocale } from '../../i18n/dateLocale';
import { PlayerMeta } from '../../store/firestore';
import { activityLogger } from '../../services/ActivityLogger';
import { userService } from '../../services/UserService';
import type { CharacterData } from '../../types/player';
import { useToast } from './ToastProvider';
import { ONLINE_WINDOW_MS, useHardwareAccessActions } from '../hooks/useHardwareAccessActions';

type AccessFilter = 'all' | 'dos' | 'mac' | 'none' | 'online';

interface AccountRow {
  uid: string;
  label: string;
  email?: string;
  agents: string[];
  hasTerminalAccess: boolean;
  hasMacAccess: boolean;
  forceTerminalOpen: boolean;
  forceMacOpen: boolean;
  lastLoginMs: number;
  isOnline: boolean;
}

interface TerminalPanelProps {
  /** Quando true, omite o título externo (shell Sistema). */
  embedded?: boolean;
}

/**
 * Sistema → Acesso — autorização persistente de hardware (sem Limbo/DiskRepair; esses ficam no Ao Vivo).
 */
export default function TerminalPanel({ embedded = false }: TerminalPanelProps) {
  const { t } = useTranslation('admin');
  const intlLocale = useIntlLocale();
  const toast = useToast();
  const { pushDos, pushMac, grantDos, grantMac, isBusy } = useHardwareAccessActions();

  const [accounts, setAccounts] = useState<PlayerMeta[]>([]);
  const [characters, setCharacters] = useState<{ uid: string; char: CharacterData }[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<AccessFilter>('all');
  const [selectedUids, setSelectedUids] = useState<Set<string>>(new Set());

  useEffect(() => {
    const unsubUsers = userService.subscribeToUsers((users) => setAccounts(users as PlayerMeta[]));
    const unsubCharacters = userService.subscribeToAllCharacters(setCharacters);
    return () => {
      unsubUsers();
      unsubCharacters();
    };
  }, []);

  const rows = useMemo((): AccountRow[] => {
    const now = Date.now();
    const charsByUid = new Map<string, string[]>();
    characters.forEach(({ uid, char }) => {
      if (char.archived) return;
      const list = charsByUid.get(uid) || [];
      list.push(char.codinome || t('entity.noCodename'));
      charsByUid.set(uid, list);
    });

    return accounts
      .map((acc) => {
        const lastLoginMs = acc.lastLogin?.toMillis?.() ?? 0;
        const agents = charsByUid.get(acc.uid) || [];
        return {
          uid: acc.uid,
          label: acc.masterName || acc.displayName || acc.email || acc.uid.slice(0, 8),
          email: acc.email,
          agents,
          hasTerminalAccess: Boolean(acc.hasTerminalAccess),
          hasMacAccess: Boolean(acc.hasMacAccess),
          forceTerminalOpen: Boolean(acc.forceTerminalOpen),
          forceMacOpen: Boolean(acc.forceMacOpen),
          lastLoginMs,
          isOnline: lastLoginMs > 0 && now - lastLoginMs <= ONLINE_WINDOW_MS,
        };
      })
      .filter((row) => row.agents.length > 0 || row.hasTerminalAccess || row.hasMacAccess)
      .sort((a, b) => a.label.localeCompare(b.label, intlLocale));
  }, [accounts, characters]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter === 'dos' && !row.hasTerminalAccess) return false;
      if (filter === 'mac' && !row.hasMacAccess) return false;
      if (filter === 'none' && (row.hasTerminalAccess || row.hasMacAccess)) return false;
      if (filter === 'online' && !row.isOnline) return false;
      if (!q) return true;
      const hay = [row.label, row.email, ...row.agents].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search, filter]);

  const selectedList = useMemo(() => [...selectedUids], [selectedUids]);
  const selectedLabels = useMemo(
    () =>
      filtered
        .filter((r) => selectedUids.has(r.uid))
        .map((r) => r.agents[0] || r.label)
        .join(', '),
    [filtered, selectedUids]
  );

  const toggleSelect = (uid: string) => {
    setSelectedUids((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const selectFiltered = () => {
    if (selectedUids.size === filtered.length && filtered.every((r) => selectedUids.has(r.uid))) {
      setSelectedUids(new Set());
    } else {
      setSelectedUids(new Set(filtered.map((r) => r.uid)));
    }
  };

  const rowLabel = (row: AccountRow) => row.agents[0] || row.label;

  return (
    <div className="space-y-6 font-display">
      {!embedded && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-4">
            <div className="w-1 h-9 bg-accent shrink-0" />
            <h2 className="font-bold uppercase tracking-widest text-lg text-bone">{t('hardware.title')}</h2>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-ash-500 pl-6">
            {t('hardware.subtitle')}
          </p>
        </div>
      )}

      {embedded && (
        <p className="text-[10px] font-bold uppercase tracking-widest text-ash-500">
          {t('hardware.embeddedHint')}
        </p>
      )}

      <div className="bg-surface-container-low border border-primary/10 rounded-sm shadow-xl overflow-hidden">
        <div className="p-5 border-b border-primary/10 bg-black/30 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-bone">{t('hardware.authTitle')}</h3>
              <p className="text-[9px] font-bold uppercase tracking-widest text-ash-500 mt-1">
                {t('hardware.authSubtitle')}
              </p>
            </div>
            {selectedList.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={isBusy('dos', 'revoke')}
                  onClick={async () => {
                    try {
                      await grantDos(selectedList, false, selectedLabels);
                      toast.info(`DOS revogado em ${selectedList.length}`);
                      setSelectedUids(new Set());
                    } catch {
                      toast.error(t('hardware.toast.revokeDosFail'));
                    }
                  }}
                  className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest bg-[#333] border border-border-subtle text-ash-300 hover:bg-[#444] disabled:opacity-30"
                >
                  {t('hardware.revokeDos')}
                </button>
                <button
                  type="button"
                  disabled={isBusy('mac', 'revoke')}
                  onClick={async () => {
                    try {
                      await grantMac(selectedList, false, selectedLabels);
                      toast.info(`Mac revogado em ${selectedList.length}`);
                      setSelectedUids(new Set());
                    } catch {
                      toast.error(t('hardware.toast.revokeMacFail'));
                    }
                  }}
                  className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest bg-[#333] border border-border-subtle text-ash-300 hover:bg-[#444] disabled:opacity-30"
                >
                  {t('hardware.revokeMac')}
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-col lg:flex-row gap-3">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('hardware.search')}
              className="flex-1 bg-black/50 border border-border px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-bone placeholder:text-ash-600 focus:outline-none focus:border-primary/40"
            />
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ['all', t('hardware.filter.all')],
                  ['online', t('hardware.filter.online')],
                  ['dos', t('hardware.filter.dos')],
                  ['mac', t('hardware.filter.mac')],
                  ['none', t('hardware.filter.none')],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  className={`px-3 py-2 text-[9px] font-black uppercase tracking-widest border transition-colors ${
                    filter === id
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-border-subtle text-ash-600 hover:text-ash-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 py-2 border-b border-border-subtle bg-black/20 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={selectFiltered}
            className="text-[9px] font-black uppercase tracking-widest text-ash-500 hover:text-primary"
          >
            {selectedUids.size > 0 ? t('hardware.clearSelection', { n: selectedUids.size }) : t('hardware.selectFiltered', { n: filtered.length })}
          </button>
          <span className="text-[9px] font-mono text-ash-700 uppercase tracking-widest">
            {t('hardware.count', { n: filtered.length })}
          </span>
        </div>

        <ul className="divide-y divide-white/5 max-h-[560px] overflow-y-auto">
          {filtered.length === 0 ? (
            <li className="p-12 text-center text-ash-600 text-[10px] font-black uppercase tracking-widest">
              {t('hardware.empty')}
            </li>
          ) : (
            filtered.map((row) => {
              const selected = selectedUids.has(row.uid);
              const dosBusy =
                isBusy('dos', 'push', row.uid) ||
                isBusy('dos', 'grant', row.uid) ||
                isBusy('dos', 'revoke', row.uid);
              const macBusy =
                isBusy('mac', 'push', row.uid) ||
                isBusy('mac', 'grant', row.uid) ||
                isBusy('mac', 'revoke', row.uid);

              return (
                <li
                  key={row.uid}
                  className={`flex flex-col gap-4 p-5 hover:bg-primary/5 transition-colors ${
                    selected ? 'bg-primary/5' : ''
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <button
                      type="button"
                      onClick={() => toggleSelect(row.uid)}
                      className={`mt-0.5 w-5 h-5 border-2 rounded-sm shrink-0 flex items-center justify-center transition ${
                        selected ? 'bg-primary border-primary' : 'border-ash-800 hover:border-ash-600'
                      }`}
                      aria-label="Selecionar conta"
                    >
                      {selected && (
                        <span className="material-symbols-outlined text-black text-xs font-black">check</span>
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-black uppercase text-ash-100 tracking-wide">{row.label}</p>
                        {row.isOnline && (
                          <span className="text-[9px] font-black uppercase tracking-widest text-phosphor-500 border border-phosphor-500/30 px-1.5 py-0.5">
                            {t('hardware.filter.online')}
                          </span>
                        )}
                        {row.forceTerminalOpen && (
                          <span className="text-[9px] font-black uppercase tracking-widest text-primary animate-pulse">
                            Push DOS pendente
                          </span>
                        )}
                        {row.forceMacOpen && (
                          <span className="text-[9px] font-black uppercase tracking-widest text-tube-400 animate-pulse">
                            Push Mac pendente
                          </span>
                        )}
                      </div>
                      {row.email && (
                        <p className="text-[9px] font-mono text-ash-600 mt-0.5 truncate">{row.email}</p>
                      )}
                      <p className="text-[9px] font-bold uppercase tracking-wide text-ash-500 mt-1">
                        {row.agents.length > 0 ? row.agents.join(' · ') : 'Sem personagem ativo'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:pl-9">
                    <div className="flex flex-wrap items-center gap-4">
                      <GrantToggle
                        label={t('hardware.filter.dos')}
                        active={row.hasTerminalAccess}
                        disabled={dosBusy}
                        onToggle={async () => {
                          const next = !row.hasTerminalAccess;
                          try {
                            await grantDos([row.uid], next, rowLabel(row));
                            activityLogger.logAdmin(
                              'gm.mpg',
                              next ? 'grant_terminal' : 'revoke_terminal',
                              `${next ? 'Liberou' : 'Revogou'} DOS: ${rowLabel(row)}`
                            );
                            toast.success(next ? `Acesso DOS liberado: ${rowLabel(row)}` : `DOS revogado: ${rowLabel(row)}`);
                          } catch {
                            toast.error('Falha ao alterar acesso DOS');
                          }
                        }}
                      />
                      <GrantToggle
                        label={t('hardware.filter.mac')}
                        active={row.hasMacAccess}
                        disabled={macBusy}
                        accent="cyan"
                        onToggle={async () => {
                          const next = !row.hasMacAccess;
                          try {
                            await grantMac([row.uid], next, rowLabel(row));
                            toast.success(next ? `Acesso Mac liberado: ${rowLabel(row)}` : `Mac revogado: ${rowLabel(row)}`);
                          } catch {
                            toast.error('Falha ao alterar acesso Mac');
                          }
                        }}
                      />
                    </div>

                    <div className="flex flex-wrap gap-2 sm:ml-auto">
                      <button
                        type="button"
                        disabled={dosBusy}
                        onClick={async () => {
                          try {
                            await pushDos([row.uid], rowLabel(row));
                            toast.success(t('live.toast.dosOk', { target: rowLabel(row) }));
                          } catch {
                            toast.error(t('live.toast.dosFail'));
                          }
                        }}
                        className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest bg-primary text-black hover:bg-primary-container disabled:opacity-30"
                      >
                        Empurrar DOS
                      </button>
                      <button
                        type="button"
                        disabled={macBusy}
                        onClick={async () => {
                          try {
                            await pushMac([row.uid], rowLabel(row));
                            toast.success(t('live.toast.macOk', { target: rowLabel(row) }));
                          } catch {
                            toast.error(t('live.toast.macFail'));
                          }
                        }}
                        className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest bg-ash-200 text-black hover:bg-white disabled:opacity-30"
                      >
                        Empurrar Mac
                      </button>
                    </div>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}

function GrantToggle({
  label,
  active,
  disabled,
  onToggle,
  accent = 'emerald',
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onToggle: () => void;
  accent?: 'emerald' | 'cyan';
}) {
  const on =
    accent === 'cyan'
      ? 'bg-tube-500/20 border-tube-500/40'
      : 'bg-phosphor-500/20 border-phosphor-500/40';
  const knob = accent === 'cyan' ? 'bg-tube-400' : 'bg-phosphor-400';

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      className="flex items-center gap-3 disabled:opacity-30"
    >
      <span
        className={`relative w-10 h-5 rounded-full border transition ${
          active ? on : 'bg-ash-900 border-ash-800'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full transition-transform ${
            active ? `translate-x-5 ${knob}` : 'translate-x-0 bg-ash-700'
          }`}
        />
      </span>
      <span
        className={`text-[9px] font-black uppercase tracking-widest ${
          active ? (accent === 'cyan' ? 'text-tube-400' : 'text-phosphor-400') : 'text-ash-600'
        }`}
      >
        {label}
      </span>
    </button>
  );
}
