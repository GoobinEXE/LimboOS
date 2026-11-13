import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import OverlayPortal from './OverlayPortal';
import { format } from 'date-fns';
import { motion } from 'motion/react';
import { userService } from '../../services/UserService';
import { intelRegistry } from '../../data/intel_registry';
import { db } from '../../lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import RetroSpinner from '../../components/player/RetroSpinner';
import { activityLogger } from '../../services/ActivityLogger';
import { CharacterData, PlayerStats, MasterAccount, Group } from '../../types/player';
import { intelService } from '../../services/IntelService';
import IntelDistributionDrawer from './IntelDistributionDrawer';
import { useModal } from './ConfirmModal';
import Screw from '../../components/player/Screw';
import { useAchievementCatalog } from '../../hooks/useAchievementCatalog';
import { achievementLabel, intelTitleLabel } from '../lib/entityLabels';
import { ADMIN_SPRING } from '../lib/motion';
import {
  isAchievementEarned,
  parseAchievementGrantId,
} from '../../services/AchievementManager';
import { resolveCampaignPlatform } from '../../data/campaigns';
import { extractSpotifyEmbedUrl, isValidSpotifyPlaylistInput } from '../../lib/spotify';
import { getScopedDocs } from '../../lib/tenantScope';
import MIcon from './MIcon';

interface AgentDossierViewProps {
  uid: string;
  character: CharacterData;
  masterAccount: MasterAccount;
  onClose: () => void;
  onUpdate: () => void;
}

export default function AgentDossierView({ uid, character, masterAccount, onClose, onUpdate }: AgentDossierViewProps) {
  const { t } = useTranslation('admin');
  const [details, setDetails] = useState<{
    intel: { id: string; unlockedAt: any }[];
    playCounts: any[];
    stats: PlayerStats | null;
    achievements: string[];
    groups: Group[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [editingChar, setEditingChar] = useState<Partial<CharacterData>>(character);
  const [saveLoading, setSaveLoading] = useState(false);
  const [spotifyError, setSpotifyError] = useState('');
  
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [allAccounts, setAllAccounts] = useState<MasterAccount[]>([]);
  const [transferTarget, setTransferTarget] = useState<string>('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showAchievementSelect, setShowAchievementSelect] = useState(false);

  // Use unified intelRegistry instead of direct Firestore listener
  const allAudios = useMemo(() => 
    intelRegistry.getAll().map(item => ({
      id: item.id,
      originalName: item.title || item.id,
      title: item.title,
      artist: item.metadata?.artist,
    })),
  []);

  const { showConfirm, modal } = useModal();
  const { achievements } = useAchievementCatalog();

  useEffect(() => {
    loadDetails();
  }, [uid, character.id]);

  const loadDetails = async () => {
    setLoading(true);
    try {
      const data = await userService.loadUserDetails(uid, character.id);
      
      // Load groups the character belongs to
      const groupDocs = await getScopedDocs('groups', 'list');
      const allGroupsList = groupDocs.map(d => ({ id: d.id, ...d.data() } as Group));
      const groups = allGroupsList.filter(g => g.characterSlots?.some(slot => slot.characterId === character.id));

      setDetails({ ...data, groups });
    } catch (error) {
      console.error("Error loading dossier details:", error);
    } finally {
      setLoading(false);
    }
  };


  const handleUpdateChar = async () => {
    const spotifyUrl = (editingChar.spotifyPlaylistUrl || '').trim();
    if (!isValidSpotifyPlaylistInput(spotifyUrl)) {
      setSpotifyError(t('dossier.spotifyInvalid'));
      return;
    }
    setSpotifyError('');
    setSaveLoading(true);
    try {
      await userService.updateCharacter(uid, character.id, {
        dangerLevel: editingChar.dangerLevel,
        agentStatus: editingChar.agentStatus,
        spotifyPlaylistUrl: spotifyUrl,
      });
      activityLogger.logAdmin(
        'mestre',
        'character_update',
        `Atualizou dossiê de ${character.codinome}`,
        { uid, charId: character.id, spotify: Boolean(spotifyUrl) }
      );
      onUpdate();
    } catch (error) {
      console.error("Error updating character:", error);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleArchiveChar = async () => {
    const isArchiving = !character.archived;
    const actionName = isArchiving ? 'Arquivar' : 'Desarquivar';
    const ok = await showConfirm(
      `${actionName} Agente`, 
      isArchiving 
        ? `Arquivar removerá o agente da lista principal, mas preservará todo o histórico. Continuar?`
        : `O agente voltará à ativa. Continuar?`, 
      actionName
    );
    if (!ok) return;
    setSaveLoading(true);
    try {
      await userService.archiveCharacter(uid, character.id, isArchiving);
      onUpdate();
      onClose();
    } catch (error) {
      console.error(`Error ${isArchiving ? 'archiving' : 'unarchiving'} character:`, error);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDeleteChar = async () => {
    const ok = await showConfirm(t('dossier.deleteTitle'), t('dossier.deleteBody', { name: character.codinome }), t('dossier.deleteAction'));
    if (!ok) return;
    setSaveLoading(true);
    try {
      await userService.deleteCharacter(uid, character.id);
      onUpdate();
      onClose();
    } catch (error) {
      console.error("Error deleting character:", error);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleOpenTransfer = async () => {
    setSaveLoading(true);
    try {
      const snap = await getDocs(collection(db, 'users'));
      const accs = snap.docs.map(d => ({ uid: d.id, ...d.data() } as MasterAccount)).filter(a => a.uid !== uid);
      setAllAccounts(accs);
      setShowTransferModal(true);
    } catch (e) {
      console.error(e);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleConfirmTransfer = async () => {
    if (!transferTarget) return;
    const ok = await showConfirm(t('dossier.transferTitle'), t('dossier.transferBody'), t('dossier.transferAction'));
    if (!ok) return;
    setSaveLoading(true);
    try {
      await userService.transferCharacter(uid, transferTarget, character.id);
      onUpdate();
      onClose();
    } catch (error) {
      console.error("Error transferring character:", error);
    } finally {
      setSaveLoading(false);
      setShowTransferModal(false);
    }
  };

  const handleRemoveIntel = async (intelId: string) => {
    const ok = await showConfirm(t('dossier.removeItemTitle'), t('dossier.removeItemBody'), t('jukebox.removeAction'));
    if (!ok) return;
    await intelService.revokeIntel(uid, character.id, intelId);
    activityLogger.logAdmin('mestre', 'inventory_remove', `Removeu intel ${intelId} de ${character.codinome}`, { uid, charId: character.id, intelId });
    await loadDetails();
  };

  const handleGrantAchievement = async (achId: string) => {
    const campaignId = character.campaignId || 'unscoped';
    const platform = resolveCampaignPlatform(character.campaignId);
    await userService.grantUserAchievement(uid, character.id, achId, { campaignId, platform });
    activityLogger.logAdmin('mestre', 'achievement_grant', `Outorgou medalha ${achId} para ${character.codinome}`, { uid, charId: character.id, achId, campaignId });
    setShowAchievementSelect(false);
    await loadDetails();
  };

  const handleRevokeAchievement = async (achId: string) => {
    const ok = await showConfirm(t('dossier.revokeMedalTitle'), t('dossier.revokeMedalBody', { id: achId }), t('dossier.revokeMedalAction'));
    if (!ok) return;
    await userService.revokeUserAchievement(uid, character.id, achId);
    activityLogger.logAdmin('mestre', 'achievement_revoke', `Revogou medalha ${achId} de ${character.codinome}`, { uid, charId: character.id, achId });
    await loadDetails();
  };

  // Esc fecha primeiro o que estiver aberto dentro do dossiê
  const handleEscape = () => {
    if (showTransferModal) setShowTransferModal(false);
    else if (showAchievementSelect) setShowAchievementSelect(false);
    else onClose();
  };

  if (loading) return (
    <OverlayPortal open onClose={onClose}>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-surface-scrim">
        <RetroSpinner />
      </div>
    </OverlayPortal>
  );

  return (
    <OverlayPortal open onClose={handleEscape}>
    <div className="fixed inset-0 z-[100] flex justify-end bg-surface-scrim animate-fade-in" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={ADMIN_SPRING}
        className="bg-surface-container-low border-l border-seam w-full max-w-5xl shadow-panel flex flex-col h-full relative overflow-hidden"
      >
        <Screw className="top-4 left-4" /><Screw className="top-4 right-4 -rotate-90" /><Screw className="bottom-4 left-4 -rotate-90" /><Screw className="bottom-4 right-4" />
        <div className="noise-overlay" /><div className="scanlines" />
        
        {/* Header */}
        <div className="p-8 border-b-4 border-seam flex justify-between items-start bg-black/40 relative z-20">
          <div className="flex gap-8 w-full">
             <div className="w-28 h-28 bg-black rounded-sm flex items-center justify-center overflow-hidden relative group shadow-panel shrink-0">
                {character.profilePhotoUrl ? (
                  <img src={character.profilePhotoUrl} alt={character.codinome} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition duration-500" />
                ) : (
                  <MIcon name="person" className="text-5xl text-ash-800" />
                )}
                <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity" />
             </div>
             <div className="flex flex-col flex-1 justify-between py-1">
                <div>
                  <div className="flex items-center justify-between">
                     <div className="flex items-center gap-4">
                       <h2 className="text-4xl font-black text-bone uppercase tracking-tighter">{character.codinome}</h2>
                       <span className={`px-3 py-1 rounded-sm text-[10px] font-black uppercase tracking-wider ${
                         character.agentStatus === 'vivo' ? 'bg-phosphor-500/10 text-phosphor-500' :
                         character.agentStatus === 'morto' ? 'bg-red-500/10 text-red-500' :
                         'bg-[#333] text-ash-500'
                       }`}>
                         {character.agentStatus}
                       </span>
                       {character.archived && (
                         <span className="px-3 py-1 rounded-sm text-[10px] font-black uppercase tracking-wider bg-yellow-500/10 text-yellow-500">
                           ARQUIVADO
                         </span>
                       )}
                     </div>
                     <button onClick={onClose} className="text-ash-500 hover:text-bone transition -mt-2"><MIcon name="close" /></button>
                  </div>
                  
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[10px] font-black text-primary uppercase tracking-wider bg-primary/10 px-2 py-0.5 rounded-sm">
                      Mestre: {masterAccount?.displayName || masterAccount?.masterName || masterAccount?.email}
                    </span>
                    <p className="font-mono text-[10px] text-ash-500 uppercase tracking-wider font-bold">
                      RM-{character.id} // {(masterAccount?.uid || "").slice(0,8)}
                    </p>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-8 items-end mt-4">
                   <div className="space-y-2">
                      <span className="text-[10px] font-black text-ash-500 uppercase tracking-wider block">Nível de Ameaça</span>
                      <div className="flex gap-1.5">
                        {[1,2,3,4,5].map(lv => (
                          <div 
                            key={lv} 
                            onClick={() => setEditingChar(prev => ({ ...prev, dangerLevel: lv }))}
                            className={`w-6 h-2.5 rounded-sm cursor-pointer transition ${lv <= (editingChar.dangerLevel || 1) ? 'bg-primary shadow-[0_0_8px_rgba(255,140,0,0.4)]' : 'bg-black hover:bg-accent-10'}`}
                          />
                        ))}
                      </div>
                   </div>
                   <div className="space-y-2">
                      <span className="text-[10px] font-black text-ash-500 uppercase tracking-wider block">Status Identidade</span>
                      <select 
                        value={editingChar.agentStatus} 
                        onChange={(e) => setEditingChar(prev => ({ ...prev, agentStatus: e.target.value as any }))}
                        className="bg-black/60 text-[10px] font-black text-primary px-4 py-2 outline-none uppercase rounded-sm focus:bg-accent-10"
                      >
                        <option value="vivo">{t('accounts.status.active')}</option>
                        <option value="morto">ELIMINADO</option>
                        <option value="desaparecido">DESAPARECIDO</option>
                      </select>
                   </div>
                   <div className="flex gap-3 ml-auto">
                      <button 
                        onClick={handleUpdateChar}
                        disabled={saveLoading}
                        className="bg-primary hover:bg-primary-container text-black px-6 py-2.5 rounded-sm font-black text-[10px] tracking-wider uppercase transition active:translate-y-px glow-orange shadow-lg"
                      >
                        {saveLoading ? 'SINC...' : 'SALVAR'}
                      </button>
                      <div className="relative">
                        <button 
                          onClick={() => setIsMenuOpen(!isMenuOpen)}
                          className="bg-seam text-ash-400 hover:text-bone px-3 py-2.5 rounded-sm transition"
                        >
                          <MIcon name="more_vert" className="text-sm" />
                        </button>
                        {isMenuOpen && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)} />
                            <div className="absolute top-full right-0 mt-2 bg-black shadow-panel rounded-sm w-48 z-50">
                              <button onClick={() => { setIsMenuOpen(false); handleOpenTransfer(); }} className="w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-ash-400 hover:text-bone hover:bg-white/5 transition flex items-center gap-2 border-b border-seam">
                                <MIcon name="swap_horiz" className="text-sm" /> {t('dossier.transferAction')}
                              </button>
                              <button onClick={() => { setIsMenuOpen(false); handleArchiveChar(); }} className="w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-ash-400 hover:text-yellow-500 hover:bg-yellow-500/10 transition flex items-center gap-2 border-b border-seam">
                                <MIcon name={character.archived ? 'unarchive' : 'inventory_2'} className="text-sm" /> 
                                {character.archived ? 'Desarquivar' : 'Arquivar'}
                              </button>
                              <button onClick={() => { setIsMenuOpen(false); handleDeleteChar(); }} className="w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-ash-500 hover:text-red-500 hover:bg-red-500/10 transition flex items-center gap-2">
                                <MIcon name="delete_forever" className="text-sm" /> {t('squads.confirm.deleteAction')}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                   </div>
                </div>
             </div>
          </div>
        </div>

        {/* Content Tabs */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative z-10">
          
          {/* Sidebar / Stats */}
          <div className="w-full lg:w-96 lg:shrink-0 border-seam bg-black/20 p-8 space-y-10 overflow-y-auto overflow-x-hidden custom-scrollbar min-w-0">
             <div>
                <div className="flex justify-between items-center mb-4 border-b border-border-subtle pb-2">
                   <h3 className="text-[10px] font-black text-ash-500 uppercase tracking-[0.12em]">Esquadrões Vinculados</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {details?.groups && details.groups.length > 0 ? (
                    details.groups.map(g => (
                      <span key={g.id} className="text-[10px] font-black bg-primary/10 text-primary px-3 py-1 rounded-sm uppercase tracking-wider">
                        {g.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-[10px] font-black text-ash-700 italic uppercase tracking-wider py-1">
                      Nenhum Esquadrão Vinculado
                    </span>
                  )}
                </div>
             </div>

             <div>
                <div className="flex flex-wrap justify-between items-center gap-2 mb-4 border-b border-border-subtle pb-2">
                   <h3 className="text-[10px] font-black text-ash-500 uppercase tracking-[0.12em]">{t('dossier.spotifyTitle')}</h3>
                   {(editingChar.spotifyPlaylistUrl || '').trim() && (
                     <button
                       type="button"
                       onClick={() => {
                         setEditingChar((prev) => ({ ...prev, spotifyPlaylistUrl: '' }));
                         setSpotifyError('');
                       }}
                       className="text-[10px] font-black uppercase tracking-wider text-ash-500 hover:text-red-400 transition-colors shrink-0"
                     >
                       {t('dossier.spotifyClear')}
                     </button>
                   )}
                </div>
                <div className="space-y-3">
                  <input
                    type="url"
                    value={editingChar.spotifyPlaylistUrl || ''}
                    onChange={(e) => {
                      setEditingChar((prev) => ({ ...prev, spotifyPlaylistUrl: e.target.value }));
                      setSpotifyError('');
                    }}
                    placeholder={t('dossier.spotifyPlaceholder')}
                    className="w-full bg-black/60 text-[10px] font-mono text-ash-300 px-3 py-2.5 outline-none rounded-sm placeholder:text-ash-500 focus:bg-accent-10"
                  />
                  <p className="text-[10px] font-bold text-ash-500 uppercase tracking-wider leading-relaxed">
                    {t('dossier.spotifyHint')}
                  </p>
                  {spotifyError && (
                    <p className="text-[10px] font-black text-red-400 uppercase tracking-wider">{spotifyError}</p>
                  )}
                  {extractSpotifyEmbedUrl(editingChar.spotifyPlaylistUrl || '') && (
                    <div className="overflow-hidden rounded-sm bg-black">
                      <iframe
                        src={extractSpotifyEmbedUrl(editingChar.spotifyPlaylistUrl || '')!}
                        width="100%"
                        height="152"
                        frameBorder="0"
                        allow="autoplay; encrypted-media; fullscreen"
                        loading="lazy"
                        title="Spotify"
                        className="block"
                      />
                    </div>
                  )}
                </div>
             </div>

             <div>
                <h3 className="text-[10px] font-black text-ash-500 uppercase tracking-[0.12em] mb-6 border-b border-border-subtle pb-2">Atividade em Campo</h3>
                <div className="grid grid-cols-2 gap-4">
                   <StatBox label="Tempo Escuta" value={formatSecs(details?.stats?.totalListenTime || 0)} />
                   <StatBox label="Fidget Log" value={details?.stats?.fidgetClicks || 0} />
                   <StatBox label="Screw Log" value={details?.stats?.screwClicks || 0} />
                   <StatBox label="Pico Volume" value={formatSecs(details?.stats?.maxVolumeTime || 0)} />
                </div>
             </div>

             <div>
                <div className="flex flex-wrap justify-between items-center gap-2 mb-6 border-b border-border-subtle pb-2">
                   <h3 className="text-[10px] font-black text-ash-500 uppercase tracking-[0.12em]">Medalhas Detectadas</h3>
                   <div className="relative shrink-0">
                     <button onClick={() => setShowAchievementSelect(!showAchievementSelect)} className="text-[10px] bg-primary/10 hover:bg-primary/20 text-primary px-2 py-1 rounded-sm uppercase font-black transition">OUTORGAR MEDALHA</button>
                     {showAchievementSelect && (
                       <>
                         <div className="fixed inset-0 z-40" onClick={() => setShowAchievementSelect(false)} />
                         <div className="absolute top-full right-0 mt-2 bg-black shadow-panel rounded-sm w-56 z-50 max-h-64 overflow-y-auto custom-scrollbar">
                           {achievements.filter(
                             (a) => !isAchievementEarned(details?.achievements || [], a.id, character.campaignId)
                           ).map((a) => (
                             <button key={a.id} onClick={() => handleGrantAchievement(a.id)} className="w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-ash-400 hover:text-bone hover:bg-white/5 transition flex items-center gap-3 border-b border-seam">
                               <img src={a.icon} alt="" className="w-6 h-6 object-cover rounded-sm" /> <span className="truncate">{a.title}</span>
                             </button>
                           ))}
                         </div>
                       </>
                     )}
                   </div>
                </div>
                <div className="space-y-3">
                   {details?.achievements && details.achievements.length > 0 ? (
                     details.achievements.map(achId => {
                       const { achievementId, campaignId: grantCamp } = parseAchievementGrantId(achId);
                       const achDef = achievements.find(a => a.id === achievementId);
                       return (
                         <div key={achId} className="flex items-center justify-between p-3 bg-black/40 rounded-sm group transition hover:bg-accent-10">
                            <div className="flex items-center gap-4">
                              <div className="w-8 h-8 overflow-hidden rounded-full shadow-lg bg-accent-10">
                                 {achDef?.icon ? (
                                   <img src={achDef.icon} alt="" className="w-full h-full object-cover" />
                                 ) : (
                                   <MIcon name="workspace_premium" className="text-[18px] text-primary flex items-center justify-center w-full h-full" />
                                 )}
                              </div>
                              <div className="min-w-0">
                                <span className="text-[10px] font-bold text-ash-400 uppercase tracking-wider group-hover:text-primary transition-colors block truncate">{achievementLabel(achievementId)}</span>
                                <span className="text-[10px] font-mono text-ash-500 uppercase">{grantCamp}</span>
                              </div>
                            </div>
                            <button onClick={() => handleRevokeAchievement(achId)} className="p-1.5 text-ash-800 hover:text-red-500 hover:bg-red-500/10 rounded-sm transition opacity-0 group-hover:opacity-100">
                              <MIcon name="delete" className="text-sm" />
                            </button>
                         </div>
                       );
                     })
                   ) : (
                     <div className="p-8 text-center rounded-sm text-ash-500">
                        <p className="text-[10px] font-black uppercase tracking-wider">Nenhuma Medalha</p>
                     </div>
                   )}
                </div>
             </div>

             <div className="pt-6">
                <button 
                  onClick={() => setShowGrantModal(true)}
                  className="w-full py-4 bg-primary/5 text-primary font-black text-[10px] uppercase tracking-[0.12em] hover:bg-primary hover:text-black transition flex items-center justify-center gap-3 rounded-sm active:translate-y-px shadow-lg"
                >
                  <MIcon name="add_box" className="text-sm" /> LIBERAR INTEL
                </button>
             </div>
          </div>

          {/* Main Inventory Grid */}
          <div className="flex-1 min-w-0 bg-black/40 p-8 overflow-y-auto custom-scrollbar">
             <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-3">
                   <div className="w-1.5 h-1.5 rounded-full bg-primary animate-led" />
                   <h3 className="text-[11px] font-black text-bone uppercase tracking-[0.12em]">Cofre de Evidências</h3>
                </div>
                <span className="text-[10px] font-bold text-ash-500 uppercase tracking-wider">Registros Totais: {details?.intel.length}</span>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {details?.intel.map(t => {
                  const intel = intelRegistry.get(t.id);
                  const label = intelTitleLabel(t.id, allAudios);
                  const type = intel ? intel.type : 'AUDIO';
                  const plays = details?.playCounts.find(pc => pc.tapeId === t.id)?.count || 0;
                  return (
                    <div key={t.id} className="group relative bg-seam p-6 transition rounded-card shadow-panel overflow-hidden active:scale-98 hover:bg-accent-10">
                       <div className="absolute top-0 right-0 w-10 h-10 bg-primary/5 rotate-45 translate-x-5 -translate-y-5 border-b border-primary/10" />
                       <div className="flex items-start justify-between mb-4">
                          <div className={`p-3 rounded-sm bg-black text-xs transition group-hover:bg-accent-10${
                            type === 'AUDIO' ? 'text-amber-500' :
                            type === 'VISUAL' ? 'text-tube-500' :
                            type === 'TEXT' ? 'text-phosphor-500' : 'text-primary'
                          }`}>
                             <MIcon name={type === 'AUDIO' ? 'album' : 
                                type === 'VISUAL' ? 'photo_library' : 
                                type === 'TEXT' ? 'description' : 'shield'} className="text-[20px]" />
                          </div>
                          <div className="flex items-center gap-2">
                            {plays > 0 && (
                               <div className="bg-black/60 px-2 py-1 rounded-sm flex items-center gap-1.5">
                                 <div className="w-1 h-1 bg-amber-500 rounded-full animate-led" />
                                 <span className="text-[10px] font-black text-amber-500 uppercase tracking-tighter">Plays: {plays}</span>
                               </div>
                            )}
                            <button 
                              onClick={() => handleRemoveIntel(t.id)}
                              className="p-1.5 text-ash-800 hover:text-red-500 hover:bg-red-500/10 rounded-sm transition"
                            >
                              <MIcon name="delete" className="text-sm" />
                            </button>
                          </div>
                       </div>
                       <h4 className="text-[12px] font-black text-bone uppercase truncate mb-1 group-hover:text-primary transition-colors">{label}</h4>
                       <p className="font-mono text-[10px] text-ash-500 font-bold uppercase truncate mb-4">ID: {t.id}</p>
                       <div className="flex justify-between items-center text-[10px] font-black text-ash-500 uppercase tracking-wider border-t border-border-subtle pt-4">
                          <span className="truncate max-w-[120px]">{intel?.metadata?.npc || allAudios.find((a) => a.id === t.id)?.artist || 'SISTEMA'}</span>
                          <span className="text-primary/40">LVL_{intel?.level || 1}</span>
                       </div>
                    </div>
                  );
                })}

                {details?.intel.length === 0 && (
                  <div className="col-span-full p-32 text-center rounded-panel text-ash-500 flex flex-col items-center justify-center">
                    <MIcon name="folder_off" className="text-6xl mb-4 text-ash-700" />
                    <p className="text-[12px] font-black uppercase tracking-[0.12em]">Inventário Inativo</p>
                  </div>
                )}
             </div>
          </div>
        </div>

        {/* Modals */}
        {showGrantModal && (
          <IntelDistributionDrawer
            uid={uid}
            character={character}
            campaignId={character.campaignId}
            existingItemIds={new Set(details?.intel.map(t => t.id) || [])}
            onClose={() => setShowGrantModal(false)}
            onSuccess={loadDetails}
          />
        )}
        
        {showTransferModal && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-surface-scrim p-4">
            <div className="bg-seam p-8 w-full max-w-md rounded-card shadow-panel relative">
              <h3 className="font-black text-lg text-bone uppercase tracking-wider mb-6">Transferir Personagem</h3>
              <p className="text-[10px] text-ash-400 uppercase tracking-wider mb-6 leading-relaxed">Selecione a nova conta mestre que assumirá o controle de {character.codinome}.</p>
              
              <select 
                value={transferTarget}
                onChange={(e) => setTransferTarget(e.target.value)}
                className="w-full bg-black text-[11px] font-black text-bone p-4 outline-none uppercase rounded-sm mb-8 focus:bg-accent-10"
              >
                <option value="">-- SELECIONE A CONTA DESTINO --</option>
                {allAccounts.map(a => (
                  <option key={a.uid} value={a.uid}>{a.masterName || a.email}</option>
                ))}
              </select>

              <div className="flex justify-end gap-3">
                <button onClick={() => setShowTransferModal(false)} className="px-6 py-3 text-[10px] font-black text-ash-500 hover:text-bone uppercase tracking-wider transition-colors">{t('accounts.cancel')}</button>
                <button 
                  onClick={handleConfirmTransfer} 
                  disabled={!transferTarget || saveLoading}
                  className="bg-primary text-black px-8 py-3 rounded-sm font-black text-[10px] tracking-wider uppercase hover:bg-primary-container transition active:translate-y-px disabled:opacity-50"
                >
                  Confirmar Transferência
                </button>
              </div>
            </div>
          </div>
        )}

        {modal}
      </motion.div>
    </div>
    </OverlayPortal>
  );
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-black/60 p-4 flex flex-col justify-center rounded-sm shadow-inner group transition hover:bg-accent-10">
      <span className="text-[10px] uppercase tracking-wider text-ash-500 mb-2 font-black">{label}</span>
      <span className="font-black text-sm text-ash-300 group-hover:text-primary transition-colors">{value}</span>
    </div>
  );
}

function formatSecs(secs: number) {
  if (!secs) return '0s';
  if (secs < 60) return `${Math.floor(secs)}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  return `${(mins / 60).toFixed(1)}h`;
}
