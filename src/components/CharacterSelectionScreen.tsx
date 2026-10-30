import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { UserPlus, Shield, User, ChevronRight, AlertCircle, Skull, Search, LogOut } from 'lucide-react';
import { fetchCharacters, createCharacter } from '../store/firestore';
import { userService } from '../services/UserService';
import type { CharacterData, MasterAccount } from '../types/player';
import RetroLoading from './player/RetroLoading';
import RetroSpinner from './player/RetroSpinner';

interface CharacterSelectionScreenProps {
  account: MasterAccount;
  onSelect: (character: CharacterData) => Promise<void>;
  onLogout?: () => void;
}

export default function CharacterSelectionScreen({ account, onSelect, onLogout }: CharacterSelectionScreenProps) {
  const { t } = useTranslation('player');
  const { t: tCommon } = useTranslation('common');
  const [characters, setCharacters] = useState<CharacterData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newCodinome, setNewCodinome] = useState('');
  const [creating, setCreating] = useState(false);
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Master Name / Display Name Flow
  const [showMasterNamePrompt, setShowMasterNamePrompt] = useState(!account.displayName && !account.masterName);
  const [newMasterName, setNewMasterName] = useState('');
  const [savingMasterName, setSavingMasterName] = useState(false);

  const handleSaveMasterName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMasterName.trim() || savingMasterName) return;
    setSavingMasterName(true);
    try {
      await userService.updateMasterAccount(account.uid, { displayName: newMasterName.trim() });
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
      const list = await fetchCharacters(account.uid);
      setCharacters(list);
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
      const char = await createCharacter(account.uid, newCodinome.trim());
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

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-4 relative overflow-y-auto bg-surface-sunken safe-area-pad min-h-0">
      <div className="noise-overlay" />
      <div className="scanlines" />

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }} className="w-full max-w-2xl z-10">
        <header className="mb-8 border-b border-border-accent pb-6 flex justify-between items-end">
          <div>
            <div className="text-protocol text-industrial-silver/40 mb-2">{t('character.eyebrow')}</div>
            <h1 className="text-display text-4xl text-white uppercase">
              {t('character.title')} <span className="text-accent">{t('character.titleAccent')}</span>
            </h1>
            <p className="text-mono-ui text-industrial-silver/50 mt-1">
              {t('character.operator', { name: account.displayName || account.masterName || account.email, count: characters.length })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onLogout} className="bg-error/10 hover:bg-error/20 text-error border border-error/30 w-10 h-10 rounded-control flex items-center justify-center transition-colors duration-(--duration-fast) active:scale-[0.97]" title={t('character.logoutTitle')}>
              <LogOut size={16} />
            </button>
            <button onClick={() => setIsCreating(true)} className="bg-accent/10 hover:bg-accent/20 text-accent border border-accent/30 px-4 py-2 rounded-control text-protocol transition-colors duration-(--duration-fast) flex items-center gap-2 group active:scale-[0.97]">
              <UserPlus size={14} className="group-hover:scale-110 transition-transform" /> {t('character.recruit')}
            </button>
          </div>
        </header>

        {errorMsg && (
          <div className="mb-4 bg-error-container/30 border border-error/40 rounded-control p-3 flex items-center gap-3 text-error animate-pulse">
            <AlertCircle size={18} />
            <span className="text-protocol">{errorMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatePresence mode="popLayout">
            {characters.map((char, i) => (
              <motion.div key={char.id} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05, duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                onClick={() => handleSelect(char)}
                className="bg-surface-raised border border-border hover:border-accent/60 rounded-card p-5 cursor-pointer transition-colors duration-(--duration-fast) group relative overflow-hidden shadow-hairline"
              >
                <div className="flex items-center gap-4 relative z-10">
                  <div className={`w-16 h-16 rounded-card overflow-hidden bg-surface-panel border ${char.agentStatus === 'morto' ? 'border-red-500/50' : 'border-border'} flex items-center justify-center`}>
                    {char.profilePhotoUrl ? (
                      <img src={char.profilePhotoUrl} alt={char.codinome} className="w-full h-full object-cover" />
                    ) : (
                      <User size={32} className="text-industrial-silver/30" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-display text-xl text-white uppercase group-hover:text-accent transition-colors duration-(--duration-fast)">
                      {char.codinome}
                    </h3>
                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${char.agentStatus === 'vivo' ? 'bg-phosphor-500 animate-pulse' : char.agentStatus === 'morto' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                        <span className={`text-protocol ${char.agentStatus === 'vivo' ? 'text-phosphor-500' : char.agentStatus === 'morto' ? 'text-red-500' : 'text-yellow-500'}`}>
                          {char.agentStatus}
                        </span>
                      </div>
                      {char.agentId && <span className="text-mono-ui text-industrial-silver/40">RM-{char.agentId}</span>}
                    </div>
                  </div>
                  {selectedCharId === char.id ? (
                    <RetroSpinner size="sm" className="text-accent" />
                  ) : (
                    <ChevronRight size={20} className="text-industrial-silver/20 group-hover:text-accent transition duration-(--duration-fast) group-hover:translate-x-1" />
                  )}
                </div>

                {/* Status-specific overlays */}
                {char.agentStatus === 'morto' && (
                  <div className="absolute inset-0 bg-red-950/10 pointer-events-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Skull className="text-red-500/20 w-24 h-24 rotate-12" />
                  </div>
                )}
                
                {/* Danger Level indicator */}
                <div className="absolute top-2 right-2 flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <div key={idx} className={`w-1 h-3 rounded-inset ${idx < char.dangerLevel ? 'bg-accent/40' : 'bg-border-subtle'}`} />
                  ))}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {characters.length === 0 && !isCreating && (
            <div className="col-span-full py-12 flex flex-col items-center justify-center border border-dashed border-border rounded-panel opacity-40">
              <Search size={48} className="mb-4" />
              <p className="text-protocol">{t('character.empty')}</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Create New Character Modal */}
      <AnimatePresence>
        {isCreating && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, y: 16 }} animate={{ scale: 1, y: 0 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }} className="w-full max-w-md bg-surface-raised border border-accent/30 rounded-card p-8 shadow-panel relative">
              <div className="absolute -top-3 left-6 bg-accent px-2 py-0.5 text-[10px] font-display font-bold text-black tracking-widest uppercase rounded-inset">
                {t('character.create.badge')}
              </div>
              <h2 className="text-display text-2xl text-white uppercase mb-6">
                {t('character.create.title')} <span className="text-accent">{t('character.create.titleAccent')}</span>
              </h2>
              <form onSubmit={handleCreate} className="space-y-6">
                <div className="group">
                  <label className="text-protocol text-industrial-silver/50 group-focus-within:text-accent transition-colors duration-(--duration-fast) mb-2 block">
                    {t('character.create.label')}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-industrial-silver/40 group-focus-within:text-accent transition-colors duration-(--duration-fast)">
                      <Shield size={16} />
                    </div>
                    <input type="text" autoFocus required value={newCodinome} onChange={e => setNewCodinome(e.target.value)}
                      placeholder={t('character.create.placeholder')}
                      className="w-full bg-surface-sunken border border-border rounded-control py-4 pl-12 pr-4 text-white font-sans text-base tracking-wide focus:ring-0 focus:border-border-accent placeholder:text-industrial-silver/20 outline-none uppercase transition-colors duration-(--duration-fast)" />
                    <div className="absolute bottom-0 left-4 right-4 h-px bg-accent scale-x-0 origin-left transition-transform duration-(--duration-base) ease-limbo group-focus-within:scale-x-100" />
                  </div>
                </div>
                
                <div className="bg-accent-05 border-l-2 border-accent/30 rounded-inset p-4 flex gap-3">
                  <AlertCircle size={18} className="text-accent shrink-0" />
                  <p className="text-protocol text-industrial-silver/70 leading-relaxed">
                    {t('character.create.warning')}
                  </p>
                </div>

                <div className="flex gap-4">
                  <button type="button" onClick={() => setIsCreating(false)} className="flex-1 py-4 text-protocol text-industrial-silver/50 hover:text-white transition-colors duration-(--duration-fast)">
                    {tCommon('cancel')}
                  </button>
                  <button type="submit" disabled={creating} className="flex-2 bg-accent hover:brightness-110 text-black font-display font-bold text-xs uppercase tracking-[0.2em] py-4 px-8 rounded-control transition duration-(--duration-fast) flex items-center justify-center gap-3 disabled:opacity-50 glow-orange">
                    {creating ? <RetroSpinner size="sm" /> : t('character.create.submit')}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mandatory Master Name Modal */}
      <AnimatePresence>
        {showMasterNamePrompt && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md">
            <motion.div initial={{ scale: 0.95, y: 16 }} animate={{ scale: 1, y: 0 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }} className="w-full max-w-md bg-surface-raised border border-accent/50 rounded-card p-8 shadow-panel relative glow-orange-subtle">
              <div className="absolute -top-3 left-6 bg-accent px-2 py-0.5 text-[10px] font-display font-bold text-black tracking-widest uppercase rounded-inset animate-pulse">
                {t('character.master.badge')}
              </div>
              <h2 className="text-display text-2xl text-white uppercase mb-4 mt-2">
                {t('character.master.title')} <span className="text-accent">{t('character.master.titleAccent')}</span>
              </h2>
              <p className="text-mono-ui text-industrial-silver/70 mb-8 leading-relaxed">
                {t('character.master.body')}
              </p>
              
              <form onSubmit={handleSaveMasterName} className="space-y-6">
                <div className="group">
                  <label className="text-protocol text-industrial-silver/50 group-focus-within:text-accent transition-colors duration-(--duration-fast) mb-2 block">
                    {t('character.master.label')}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-industrial-silver/40 group-focus-within:text-accent transition-colors duration-(--duration-fast)">
                      <User size={16} />
                    </div>
                    <input type="text" autoFocus required value={newMasterName} onChange={e => setNewMasterName(e.target.value)}
                      placeholder={t('character.master.placeholder')}
                      className="w-full bg-surface-sunken border border-border rounded-control py-4 pl-12 pr-4 text-white font-sans text-base tracking-wide focus:ring-0 focus:border-border-accent placeholder:text-industrial-silver/20 outline-none transition-colors duration-(--duration-fast)" />
                    <div className="absolute bottom-0 left-4 right-4 h-px bg-accent scale-x-0 origin-left transition-transform duration-(--duration-base) ease-limbo group-focus-within:scale-x-100" />
                  </div>
                </div>

                <button type="submit" disabled={savingMasterName} className="w-full bg-accent hover:brightness-110 text-black font-display font-bold text-xs uppercase tracking-[0.2em] py-4 rounded-control transition duration-(--duration-fast) flex items-center justify-center gap-3 disabled:opacity-50 glow-orange">
                  {savingMasterName ? <RetroSpinner size="sm" /> : t('character.master.submit')}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="absolute bottom-8 left-12 right-12 flex justify-between items-center opacity-30 pointer-events-none">
        <div className="text-protocol">{tCommon('brand.smileIndustries')}</div>
        <div className="text-mono-ui">{t('character.footer.grid', { id: account?.uid ? account.uid.slice(0, 8) : '--------' })}</div>
      </footer>
    </div>
  );
}
