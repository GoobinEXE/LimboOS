import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { EASE_OUT, dialogPop, overlayFade, staggerDelay } from '../lib/motion';
import { useTranslation } from 'react-i18next';
import { UserPlus, Shield, User, ChevronRight, AlertCircle, Skull, Search, LogOut, MonitorCog } from 'lucide-react';
import { fetchCharacters, createCharacter, fetchPlayerMemberships, updateOwnDisplayName } from '../store/firestore';
import { parseInviteToken } from '../invite/inviteToken';
import type { CharacterData, MasterAccount } from '../types/player';
import RetroLoading from './player/RetroLoading';
import RetroSpinner from './player/RetroSpinner';

interface CharacterSelectionScreenProps {
  account: MasterAccount;
  onSelect: (character: CharacterData) => Promise<void>;
  onLogout?: () => void;
  /** Só para admin em `?mode=play`: volta ao console do mestre. */
  onOpenAdmin?: () => void;
}

export default function CharacterSelectionScreen({ account, onSelect, onLogout, onOpenAdmin }: CharacterSelectionScreenProps) {
  const { t } = useTranslation('player');
  const { t: tCommon } = useTranslation('common');
  const [characters, setCharacters] = useState<CharacterData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newCodinome, setNewCodinome] = useState('');
  const [creating, setCreating] = useState(false);
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Mesas onde a conta joga: cada agente pertence a uma (workspaceId)
  const [mesas, setMesas] = useState<{ wsId: string; workspaceName: string }[]>([]);
  const [newWsId, setNewWsId] = useState('');
  const [inviteInput, setInviteInput] = useState('');
  const mesaName = (wsId?: string) => mesas.find((m) => m.wsId === wsId)?.workspaceName || '';

  const openInvite = (e: React.FormEvent) => {
    e.preventDefault();
    const token = parseInviteToken(inviteInput);
    if (token) window.location.assign(`/convite/${encodeURIComponent(token)}`);
  };

  // Master Name / Display Name Flow
  const [showMasterNamePrompt, setShowMasterNamePrompt] = useState(!account.displayName && !account.masterName);
  const [newMasterName, setNewMasterName] = useState('');
  const [savingMasterName, setSavingMasterName] = useState(false);

  const handleSaveMasterName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMasterName.trim() || savingMasterName) return;
    setSavingMasterName(true);
    try {
      await updateOwnDisplayName(account.uid, newMasterName.trim());
      account.displayName = newMasterName.trim(); // Local update
      setShowMasterNamePrompt(false);
    } catch (err) {
      console.error("Failed to save display name:", err);
    } finally {
      setSavingMasterName(false);
    }
  };

  useEffect(() => {
    loadCharacters();
  }, [account.uid]);

  const loadCharacters = async () => {
    try {
      const [list, memberships] = await Promise.all([
        fetchCharacters(account.uid),
        fetchPlayerMemberships(account.uid).catch(() => []),
      ]);
      setCharacters(list);
      setMesas(memberships);
      setNewWsId((prev) => prev || memberships[0]?.wsId || '');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCodinome.trim() || creating) return;
    setCreating(true);
    try {
      const char = await createCharacter(account.uid, newCodinome.trim(), newWsId);
      setCharacters([char, ...characters]);
      setIsCreating(false);
      setNewCodinome('');
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const handleSelect = async (char: CharacterData) => {
    if (selectedCharId) return;
    setSelectedCharId(char.id);
    setErrorMsg(null);
    try {
      await onSelect(char);
    } catch (err) {
      setErrorMsg(t('character.syncFail'));
      setSelectedCharId(null);
    }
  };

  if (loading) {
    return <RetroLoading message={t('character.loading')} subMessage={t('character.loadingSub')} />;
  }

  const statusChip = (status: CharacterData['agentStatus']) =>
    status === 'vivo'
      ? 'bg-phosphor-500 text-phosphor-950'
      : status === 'morto'
        ? 'bg-red-600 text-red-50'
        : 'bg-yellow-500 text-yellow-950';

  const initials = (name: string) =>
    name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';

  return (
    <div className="w-full h-full flex flex-col items-center relative overflow-y-auto bg-surface safe-area-pad [--safe-pad:1rem] min-h-0">
      <div className="noise-overlay" />
      <div className="scanlines" />

      <motion.div initial={{ opacity: 0, transform: 'translateY(12px)' }} animate={{ opacity: 1, transform: 'translateY(0px)' }} transition={{ duration: 0.3, ease: EASE_OUT }} className="w-full max-w-2xl xl:max-w-3xl z-10 my-auto py-4">
        <header className="bg-accent text-field-ink rounded-panel p-5 sm:p-7 mb-2">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-display text-[2.25rem] sm:text-5xl uppercase leading-[0.92]">
              {t('character.title')} {t('character.titleAccent')}
            </h1>
            <div className="flex items-center gap-1.5 shrink-0">
              {onOpenAdmin && (
                <button onClick={onOpenAdmin} className="bg-field-ink/10 hover:bg-field-ink hover:text-accent text-field-ink w-10 h-10 rounded-control flex items-center justify-center transition-colors duration-(--duration-fast) active:scale-[0.97]" title={t('character.consoleTitle')} aria-label={t('character.consoleTitle')}>
                  <MonitorCog size={17} />
                </button>
              )}
              <button onClick={onLogout} className="bg-field-ink/10 hover:bg-field-ink hover:text-accent text-field-ink w-10 h-10 rounded-control flex items-center justify-center transition-colors duration-(--duration-fast) active:scale-[0.97]" title={t('character.logoutTitle')} aria-label={t('character.logoutTitle')}>
                <LogOut size={17} />
              </button>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
            <p className="text-mono-ui text-field-ink/75">
              {t('character.operator', { name: account.displayName || account.masterName || account.email, count: characters.length })}
            </p>
            <button onClick={() => setIsCreating(true)} className="bg-field-ink text-accent hover:bg-surface-container-high h-10 px-4 rounded-control text-protocol transition-colors duration-(--duration-fast) flex items-center gap-2 active:scale-[0.97]">
              <UserPlus size={15} /> {t('character.recruit')}
            </button>
          </div>
        </header>

        {errorMsg && (
          <div role="alert" className="mb-2 bg-red-700 text-red-50 rounded-panel p-4 flex items-center gap-3">
            <AlertCircle size={18} />
            <span className="text-protocol">{errorMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <AnimatePresence mode="popLayout">
            {characters.map((char, i) => (
              <motion.button key={char.id} type="button" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: staggerDelay(i, 0.05, 0.3), duration: 0.24, ease: EASE_OUT }}
                onClick={() => handleSelect(char)}
                disabled={Boolean(selectedCharId) && selectedCharId !== char.id}
                aria-busy={selectedCharId === char.id}
                className={`w-full text-left rounded-panel p-4 cursor-pointer transition-colors duration-(--duration-fast) group relative overflow-hidden active:scale-[0.99] disabled:opacity-40 disabled:cursor-wait hover:bg-field-bone focus-visible:bg-field-bone ${selectedCharId === char.id ? 'bg-field-bone' : 'bg-surface-raised'}`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-card overflow-hidden bg-accent text-field-ink group-hover:bg-field-ink group-hover:text-accent group-focus-visible:bg-field-ink group-focus-visible:text-accent flex items-center justify-center shrink-0 transition-colors duration-(--duration-fast)">
                    {char.profilePhotoUrl ? (
                      <img src={char.profilePhotoUrl} alt={char.codinome} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-display text-lg" aria-hidden>{initials(char.codinome)}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-display text-xl uppercase transition-colors duration-(--duration-fast) group-hover:text-field-ink group-focus-visible:text-field-ink ${selectedCharId === char.id ? 'text-field-ink' : 'text-bone'}`}>
                      {char.codinome}
                    </h3>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`lmb-tag ${statusChip(char.agentStatus)}`}>{char.agentStatus}</span>
                      {char.agentId && <span className="text-mono-ui text-ash-400 group-hover:text-ash-700 group-focus-visible:text-ash-700">RM-{char.agentId}</span>}
                    </div>
                    <p className="text-mono-ui text-ash-500 group-hover:text-ash-600 group-focus-visible:text-ash-600 mt-1 truncate">
                      {char.workspaceId ? t('character.mesa', { name: mesaName(char.workspaceId) || '—' }) : t('character.noMesa')}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-3 self-stretch justify-between">
                    <div className="flex gap-0.5" aria-label={`${char.dangerLevel}/5`}>
                      {Array.from({ length: 5 }).map((_, idx) => (
                        <div key={idx} className={`w-1.5 h-3.5 rounded-[1px] ${idx < char.dangerLevel ? 'bg-accent group-hover:bg-field-ink' : 'bg-surface-container-highest group-hover:bg-ash-300'}`} />
                      ))}
                    </div>
                    {selectedCharId === char.id ? (
                      <RetroSpinner size="sm" className="text-field-ink" />
                    ) : (
                      <ChevronRight size={20} className="text-ash-500 group-hover:text-field-ink transition duration-(--duration-fast) group-hover:translate-x-0.5" />
                    )}
                  </div>
                </div>

                {char.agentStatus === 'morto' && (
                  <Skull className="absolute right-12 -bottom-5 w-16 h-16 rotate-12 text-red-600/10 pointer-events-none" aria-hidden />
                )}
              </motion.button>
            ))}
          </AnimatePresence>

          {characters.length === 0 && !isCreating && (
            <div className="col-span-full py-12 flex flex-col items-center justify-center rounded-panel bg-surface-raised text-ash-400">
              <Search size={40} className="mb-4 text-ash-500" />
              <p className="text-protocol">{t('character.empty')}</p>
            </div>
          )}
        </div>

        <form onSubmit={openInvite} className="mt-2 bg-surface-raised rounded-panel p-2 flex flex-col sm:flex-row gap-2" aria-label={t('character.invite.label')}>
          <input
            type="text"
            value={inviteInput}
            onChange={(e) => setInviteInput(e.target.value)}
            placeholder={t('character.invite.placeholder')}
            aria-label={t('character.invite.label')}
            autoComplete="off"
            spellCheck={false}
            className="lmb-field flex-1 font-mono h-11"
          />
          <button type="submit" disabled={!parseInviteToken(inviteInput)} className="lmb-btn lmb-btn-bone h-11">
            {t('character.invite.submit')}
          </button>
        </form>

        <footer className="mt-6 flex justify-between items-center gap-4 text-ash-600 pointer-events-none">
          <div className="text-protocol">{tCommon('brand.smileIndustries')}</div>
          <div className="text-mono-ui">{t('character.footer.grid', { id: account?.uid ? account.uid.slice(0, 8) : '--------' })}</div>
        </footer>
      </motion.div>

      {/* Novo agente */}
      <AnimatePresence>
        {isCreating && (
          <motion.div variants={overlayFade} initial="hidden" animate="visible" exit="exit" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-scrim"
            onMouseDown={(e) => { if (e.target === e.currentTarget && !creating) setIsCreating(false); }}
            onKeyDown={(e) => { if (e.key === 'Escape' && !creating) setIsCreating(false); }}
          >
            <motion.div role="dialog" aria-modal="true" aria-labelledby="create-agent-title" variants={dialogPop} initial="hidden" animate="visible" exit="exit" className="w-full max-w-md bg-surface-raised rounded-panel overflow-hidden">
              <div className="bg-accent text-field-ink px-6 py-5">
                <div className="text-protocol text-field-ink/70">{t('character.create.badge')}</div>
                <h2 id="create-agent-title" className="text-display text-3xl uppercase mt-1">
                  {t('character.create.title')} {t('character.create.titleAccent')}
                </h2>
              </div>
              <div className="p-6">
              {mesas.length === 0 ? (
                <div className="space-y-6">
                  <p className="text-ash-300 leading-relaxed">{t('character.create.needInvite')}</p>
                  <button type="button" onClick={() => setIsCreating(false)} className="lmb-btn w-full h-12">
                    {tCommon('cancel')}
                  </button>
                </div>
              ) : (
              <form onSubmit={handleCreate} className="space-y-5">
                {mesas.length > 1 && (
                  <label className="block">
                    <span className="lmb-eyebrow mb-2">{t('character.create.mesaLabel')}</span>
                    <select value={newWsId} onChange={(e) => setNewWsId(e.target.value)} className="lmb-field h-12">
                      {mesas.map((m) => (
                        <option key={m.wsId} value={m.wsId}>{m.workspaceName || m.wsId}</option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="block">
                  <span className="lmb-eyebrow mb-2">{t('character.create.label')}</span>
                  <div className="relative">
                    <Shield size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ash-500 pointer-events-none" />
                    <input type="text" autoFocus required value={newCodinome} onChange={e => setNewCodinome(e.target.value)}
                      placeholder={t('character.create.placeholder')}
                      autoComplete="off" spellCheck={false}
                      className="lmb-field h-12 pl-11 uppercase tracking-wide" />
                  </div>
                </label>

                <div className="bg-surface-panel rounded-card p-4 flex gap-3">
                  <AlertCircle size={18} className="text-accent shrink-0 mt-0.5" />
                  <p className="text-sm text-ash-200 leading-relaxed">
                    {t('character.create.warning')}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button type="button" onClick={() => setIsCreating(false)} className="lmb-btn lmb-btn-ghost flex-1 h-12">
                    {tCommon('cancel')}
                  </button>
                  <button type="submit" disabled={creating} className="lmb-btn lmb-btn-primary flex-2 h-12">
                    {creating ? <RetroSpinner size="sm" /> : t('character.create.submit')}
                  </button>
                </div>
              </form>
              )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nome do mestre (obrigatório) */}
      <AnimatePresence>
        {showMasterNamePrompt && (
          <motion.div variants={overlayFade} initial="hidden" animate="visible" exit="exit" className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-surface-scrim">
            <motion.div role="dialog" aria-modal="true" aria-labelledby="master-name-title" variants={dialogPop} initial="hidden" animate="visible" exit="exit" className="w-full max-w-md bg-surface-raised rounded-panel overflow-hidden">
              <div className="bg-accent text-field-ink px-6 py-5">
                <div className="text-protocol text-field-ink/70">{t('character.master.badge')}</div>
                <h2 id="master-name-title" className="text-display text-3xl uppercase mt-1">
                  {t('character.master.title')} {t('character.master.titleAccent')}
                </h2>
              </div>
              <div className="p-6">
              <p className="text-ash-300 mb-6 leading-relaxed">
                {t('character.master.body')}
              </p>

              <form onSubmit={handleSaveMasterName} className="space-y-5">
                <label className="block">
                  <span className="lmb-eyebrow mb-2">{t('character.master.label')}</span>
                  <div className="relative">
                    <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ash-500 pointer-events-none" />
                    <input type="text" autoFocus required value={newMasterName} onChange={e => setNewMasterName(e.target.value)}
                      placeholder={t('character.master.placeholder')}
                      autoComplete="name"
                      className="lmb-field h-12 pl-11" />
                  </div>
                </label>

                <button type="submit" disabled={savingMasterName} className="lmb-btn lmb-btn-primary w-full h-12">
                  {savingMasterName ? <RetroSpinner size="sm" /> : t('character.master.submit')}
                </button>
              </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
