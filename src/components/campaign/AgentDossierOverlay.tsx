import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Trophy, Music, Shield, Radio, Camera, Pencil, Check } from 'lucide-react';
import { updateCodinome, uploadProfilePhoto } from '../../store/firestore';
import { ALL_ACHIEVEMENTS } from '../../data/achievements';
import { AchievementCatalog } from '../achievements/AchievementCatalog';
import type { PlayerData } from '../../types/player';
import { campaigns } from '../../data/campaigns';
import type { AccessLevel } from '../../types/intel';
import { ACCESS_LEVEL_LABELS } from '../../types/intel';
import { IntelManager, IntelBase, VisualIntel, TextIntel } from '../../services/IntelEngine';
import RetroSpinner from '../player/RetroSpinner';

const STATUS_CONFIG = {
  vivo: { label: 'ATIVO', color: 'text-green-400', dot: 'bg-green-400', border: 'border-green-500/30' },
  morto: { label: 'ELIMINADO', color: 'text-red-400', dot: 'bg-red-400', border: 'border-red-500/30' },
  desaparecido: { label: 'DESAPARECIDO', color: 'text-yellow-400', dot: 'bg-yellow-400', border: 'border-yellow-500/30' },
} as const;

const DANGER_LABELS = ['—', 'BAIXO', 'MODERADO', 'ELEVADO', 'ALTO', 'CRÍTICO'] as const;
const TABS = [
  { id: 'agente', label: 'Agente', Icon: Shield },
  { id: 'intel', label: 'Arquivos', Icon: Radio },
  { id: 'conquistas', label: 'Medalhas', Icon: Trophy },
] as const;

type DossierTab = typeof TABS[number]['id'];

const FALLBACK_PHOTO = 'https://images.unsplash.com/photo-1514516311115-91220997d662?q=80&w=800&auto=format&fit=crop';
const FALLBACK_EVIDENCE = 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=800&auto=format&fit=crop';

const extractSpotifyEmbedUrl = (url: string) => {
  if (!url) return null;
  try {
    if (url.startsWith('spotify:')) {
      const uriMatch = url.match(/^spotify:(playlist|album|track|episode|show):([a-zA-Z0-9]+)$/);
      if (!uriMatch) return null;
      return `https://open.spotify.com/embed/${uriMatch[1]}/${uriMatch[2]}?utm_source=generator&theme=0`;
    }
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'open.spotify.com') return null;
    const embedMatch = parsed.pathname.match(/^\/embed\/(playlist|album|track|episode|show)\/([a-zA-Z0-9]+)\/?$/);
    if (embedMatch) {
      return `https://open.spotify.com/embed/${embedMatch[1]}/${embedMatch[2]}?utm_source=generator&theme=0`;
    }
    const match = parsed.pathname.match(/^\/(playlist|album|track|episode|show)\/([a-zA-Z0-9]+)\/?$/);
    if (!match) return null;
    return `https://open.spotify.com/embed/${match[1]}/${match[2]}?utm_source=generator&theme=0`;
  } catch {
    return null;
  }
};

const CornerMarks = () => (
  <>
    <span aria-hidden className="absolute top-1 left-1 w-2.5 h-2.5 border-t border-l border-border-accent" />
    <span aria-hidden className="absolute top-1 right-1 w-2.5 h-2.5 border-t border-r border-border-accent" />
    <span aria-hidden className="absolute bottom-1 left-1 w-2.5 h-2.5 border-b border-l border-border-accent" />
    <span aria-hidden className="absolute bottom-1 right-1 w-2.5 h-2.5 border-b border-r border-border-accent" />
  </>
);

/** Linha de ficha datilografada: rótulo ..... valor */
const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-baseline gap-2 min-w-0">
    <span className="text-protocol text-[9px] text-industrial-silver/40 shrink-0">{label}</span>
    <span aria-hidden className="flex-1 border-b border-dotted border-border-strong -translate-y-0.75" />
    <span className="text-mono-ui text-[11px] text-right min-w-0 truncate">{children}</span>
  </div>
);

const SectionLabel = ({ index, title, tone = 'text-primary' }: { index: string; title: string; tone?: string }) => (
  <div className="flex items-center gap-3">
    <span className="text-mono-ui text-[10px] text-industrial-silver/30">{index}</span>
    <h3 className={`text-protocol ${tone}`}>{title}</h3>
    <span aria-hidden className="flex-1 h-px bg-border-subtle" />
  </div>
);

interface AgentDossierOverlayProps {
  onClose: () => void;
  playerData: PlayerData;
  intelManager: IntelManager | null;
}

export const AgentDossierOverlay = ({ onClose, playerData, intelManager }: AgentDossierOverlayProps) => {
  const [activeTab, setActiveTab] = useState<DossierTab>('agente');
  const [selectedIntel, setSelectedIntel] = useState<IntelBase | null>(null);
  const [activeLevel, setActiveLevel] = useState<AccessLevel>(1);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(playerData.character.codinome);
  const [savingName, setSavingName] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [currentPhotoUrl, setCurrentPhotoUrl] = useState(playerData.character.profilePhotoUrl || '');
  const [currentUsername, setCurrentUsername] = useState(playerData.character.codinome);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const stats = useMemo(() => ({
    statusCfg: STATUS_CONFIG[playerData.character.agentStatus || 'vivo'],
    dangerLevel: playerData.character.dangerLevel || 0,
    dangerLabel: DANGER_LABELS[playerData.character.dangerLevel || 0],
    lastCampaign: campaigns.find(c => c.id === playerData.character.campaignId),
    earnedIds: new Set(playerData.achievementIds || []),
    embedUrl: extractSpotifyEmbedUrl(playerData.character.spotifyPlaylistUrl || ''),
    initials: currentUsername.split(/[\s\-_]+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
  }), [playerData, currentUsername]);

  const levelItems = intelManager?.getByLevel(activeLevel) ?? [];
  const isOpenable = (item: IntelBase) => item instanceof VisualIntel || item instanceof TextIntel;

  const handleSaveName = async () => {
    const trimmed = editName.trim();
    if (!trimmed || trimmed === currentUsername) return setIsEditingName(false);
    setSavingName(true);
    try { await updateCodinome(playerData.uid, playerData.activeCharacterId, trimmed); setCurrentUsername(trimmed); } catch (err) { console.error(err); }
    finally { setSavingName(false); setIsEditingName(false); }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || uploading) return;
    if (!/^image\/(jpeg|jpg|png|webp|gif)$/i.test(file.type)) {
      console.error('Tipo de imagem inválido');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      console.error('Imagem maior que 5MB');
      return;
    }
    setUploading(true);
    try { const photo = await uploadProfilePhoto(playerData.uid, playerData.activeCharacterId, file); setCurrentPhotoUrl(photo.url); } catch (err) { console.error(err); }
    finally { setUploading(false); }
  };

  return (
    <div className="w-full h-full bg-surface flex flex-col overflow-hidden touch-none relative">
      <div className="noise-overlay" />
      <div className="scanlines" />
      <div aria-hidden className="absolute inset-x-0 top-0 h-56 pointer-events-none bg-linear-to-b from-accent-05 to-transparent z-0" />
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handlePhotoUpload} />

      {/* Cabeçalho — identidade */}
      <header className="px-5 sm:px-6 pt-[max(1.25rem,env(safe-area-inset-top))] pb-5 border-b border-border flex justify-between items-center gap-4 bg-surface-raised/70 backdrop-blur-md relative z-20 shrink-0">
        <div className="flex items-center gap-4 min-w-0">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Alterar foto"
            className="relative w-16 h-16 rounded-card overflow-hidden bg-surface-sunken border border-border-strong flex items-center justify-center text-primary text-display text-xl shrink-0 group glow-orange-subtle"
          >
            {currentPhotoUrl ? (
              <img
                src={currentPhotoUrl}
                alt="Perfil"
                className="w-full h-full object-cover"
                onError={(e) => { e.currentTarget.src = FALLBACK_PHOTO; }}
              />
            ) : <span>{stats.initials || '?'}</span>}
            <div aria-hidden className="absolute inset-0 pointer-events-none opacity-25 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,#00000066_2px,#00000066_3px)]" />
            <CornerMarks />
            <div className="absolute inset-0 bg-accent/70 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-black"><Camera size={18} /></div>
            {uploading && <div className="absolute inset-0 bg-black/70 flex items-center justify-center"><RetroSpinner size="sm" /></div>}
          </button>
          <div className="flex-1 min-w-0">
            <span className="text-protocol text-[8px] text-primary/60">Dossiê do Agente</span>
            {isEditingName ? (
              <div className="flex items-center gap-2 mt-0.5">
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="text-display text-xl uppercase text-white bg-transparent border-b border-border-accent outline-none w-full min-w-0"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                />
                <button type="button" onClick={handleSaveName} disabled={savingName} className="p-1.5 text-green-400 hover:bg-green-500/10 rounded-control transition-colors">{savingName ? <RetroSpinner size="sm" /> : <Check size={16} />}</button>
                <button type="button" onClick={() => { setIsEditingName(false); setEditName(currentUsername); }} className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-control transition-colors"><X size={16} /></button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-0.5 min-w-0">
                <h4 className="text-display text-xl uppercase text-white truncate">{currentUsername}</h4>
                <button type="button" onClick={() => setIsEditingName(true)} aria-label="Editar codinome" className="p-1 text-primary/30 hover:text-primary transition-colors shrink-0"><Pencil size={13} /></button>
              </div>
            )}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-inset border bg-surface-raised text-protocol text-[8px] ${stats.statusCfg.border} ${stats.statusCfg.color}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${stats.statusCfg.dot} animate-pulse`} />
                {stats.statusCfg.label}
              </span>
              {playerData.character.agentId && <span className="text-mono-ui text-[10px] text-industrial-silver/40">RM-{playerData.character.agentId}</span>}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar dossiê"
          className="w-11 h-11 rounded-control border border-border bg-surface-panel text-primary flex items-center justify-center hover:border-border-accent hover:bg-accent-10 active:scale-95 transition-all duration-200 group shrink-0"
        >
          <X size={20} className="group-hover:rotate-90 transition-transform duration-300" />
        </button>
      </header>

      {/* Leituras */}
      <div className="flex border-b border-border-subtle bg-surface-sunken/60 shrink-0 relative z-20">
        {[
          { val: intelManager?.getAll().length || 0, lab: 'Total Intel' },
          { val: stats.earnedIds.size, lab: 'Medalhas' },
          { val: intelManager?.getByType('VISUAL').length || 0, lab: 'Evidências' }
        ].map((s, i) => (
          <div key={i} className="flex-1 flex flex-col items-center py-3 border-r border-border-subtle last:border-r-0">
            <span className="text-mono-ui text-xl font-semibold text-primary leading-none">{String(s.val).padStart(2, '0')}</span>
            <span className="text-protocol text-[8px] text-industrial-silver/40 mt-1.5">{s.lab}</span>
          </div>
        ))}
      </div>

      {/* Abas */}
      <nav className="flex bg-surface-raised/50 shrink-0 relative z-20 border-b border-border">
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex-1 flex items-center justify-center gap-2 py-3.5 text-protocol text-[9px] transition-colors duration-200 ${
                isActive ? 'text-primary' : 'text-industrial-silver/40 hover:text-industrial-silver/70'
              }`}
            >
              <tab.Icon size={13} /> <span>{tab.label}</span>
              {isActive && (
                <motion.span
                  layoutId="dossier-tab-indicator"
                  className="absolute inset-x-6 -bottom-px h-0.5 bg-primary glow-orange-subtle"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                />
              )}
            </button>
          );
        })}
      </nav>

      <main className="flex-1 overflow-y-auto relative z-10 custom-scrollbar">
        <AnimatePresence mode="wait">
          {activeTab === 'agente' && (
            <motion.div key="agente" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="p-5 sm:p-6 space-y-5">
              {/* Ficha classificada */}
              <div className="relative rounded-card bg-surface-panel border border-border-strong shadow-panel p-5 space-y-4 overflow-hidden">
                <div aria-hidden className="absolute inset-x-0 top-0 h-0.75 bg-linear-to-r from-accent via-accent-60 to-transparent" />
                <span aria-hidden className="absolute top-4 right-4 -rotate-6 border border-red-500/40 text-red-400/70 text-protocol text-[7px] px-1.5 py-0.5 rounded-inset">
                  Classificado
                </span>
                <SectionLabel index="01" title="Ficha de Campo" />
                <div className="space-y-2.5 pt-1">
                  <Row label="Agent_ID"><span className="text-primary font-semibold">RM-{playerData.character.agentId || '...'}</span></Row>
                  <Row label="Codinome"><span className="text-white">{currentUsername}</span></Row>
                  <Row label="Status"><span className={stats.statusCfg.color}>{stats.statusCfg.label}</span></Row>
                  <Row label="Última_Missão"><span className="text-white/80">{stats.lastCampaign?.name || 'SEM REGISTRO'}</span></Row>
                  {stats.lastCampaign && <Row label="Setor"><span className="text-white/80">{stats.lastCampaign.location}</span></Row>}
                </div>
                <div className="pt-4 border-t border-border-subtle">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-protocol text-[9px] text-industrial-silver/40">Periculosidade</span>
                    <span className={`text-protocol text-[9px] ${stats.dangerLevel >= 4 ? 'text-red-400' : stats.dangerLevel >= 2 ? 'text-primary' : 'text-industrial-silver/40'}`}>{stats.dangerLabel}</span>
                  </div>
                  <div className="flex gap-1.5">
                    {Array.from({ length: 5 }, (_, i) => (
                      <div
                        key={i}
                        className={`h-2 flex-1 rounded-inset transition-all duration-700 ${
                          i < stats.dangerLevel
                            ? stats.dangerLevel >= 4 ? 'bg-red-500 shadow-[0_0_8px_#ef444466]' : 'bg-primary glow-orange-subtle'
                            : 'bg-surface-sunken border border-border-subtle'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Deck */}
              <div className="space-y-3">
                <SectionLabel index="02" title="Deck do Agente" tone="text-[#1DB954]" />
                {stats.embedUrl ? (
                  <div className="rounded-card overflow-hidden border border-border bg-surface-sunken shadow-[0_0_24px_-8px_rgba(29,185,84,0.25)]">
                    <iframe src={stats.embedUrl} width="100%" height="152" frameBorder="0" allow="autoplay; encrypted-media; fullscreen" loading="lazy" className="block" title="Spotify" />
                  </div>
                ) : (
                  <div className="rounded-card border border-dashed border-border bg-surface-raised/40 p-6 text-center flex flex-col items-center gap-2">
                    <Music size={20} className="text-[#1DB954]/50" />
                    <p className="text-protocol text-[9px] text-industrial-silver/40">Nenhuma playlist sincronizada</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'intel' && (
            <motion.div key="intel" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="p-5 sm:p-6 space-y-4">
              <div className="flex gap-1 p-1 rounded-card border border-border bg-surface-sunken shadow-hairline">
                {([1, 2, 3, 4] as AccessLevel[]).map(lvl => {
                  const isActive = activeLevel === lvl;
                  return (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setActiveLevel(lvl)}
                      className={`relative flex-1 py-2 rounded-control text-protocol text-[8px] transition-colors duration-200 ${
                        isActive ? 'text-black' : 'text-primary/40 hover:text-primary/70'
                      }`}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="dossier-level-indicator"
                          className="absolute inset-0 rounded-control bg-accent glow-orange-subtle"
                          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                        />
                      )}
                      <span className="relative z-10 flex flex-col items-center leading-none gap-1">
                        <span className="text-mono-ui text-[9px] opacity-70">N{lvl}</span>
                        <span className="hidden min-[400px]:inline">{ACCESS_LEVEL_LABELS[lvl]}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between px-1">
                <span className="text-protocol text-[8px] text-industrial-silver/40">{ACCESS_LEVEL_LABELS[activeLevel]}</span>
                <span className="text-mono-ui text-[10px] text-industrial-silver/30">{String(levelItems.length).padStart(2, '0')} registros</span>
              </div>

              <div className="space-y-2">
                {levelItems.length === 0 ? (
                  <div className="rounded-card border border-dashed border-border bg-surface-raised/40 p-10 text-center flex flex-col items-center gap-3 text-industrial-silver/30">
                    <Radio size={28} />
                    <span className="text-protocol text-[9px]">Nenhum registro encontrado</span>
                  </div>
                ) : (
                  levelItems.map((item, i) => {
                    const openable = isOpenable(item);
                    return (
                      <motion.button
                        type="button"
                        key={item.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        onClick={() => openable && setSelectedIntel(item)}
                        disabled={!openable}
                        className={`w-full text-left rounded-card bg-surface-raised border border-border p-3.5 flex items-center gap-3.5 transition-all duration-200 group ${
                          openable ? 'cursor-pointer hover:border-border-accent hover:bg-accent-05 active:scale-[0.99]' : 'cursor-default'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-control border border-border bg-surface-sunken flex items-center justify-center shrink-0 group-hover:border-border-accent transition-colors">
                          <span className="text-lg leading-none">{item.getTypeIcon()}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-semibold text-white group-hover:text-primary transition-colors truncate uppercase tracking-wide">{item.title}</p>
                          <p className="text-mono-ui text-[9px] text-industrial-silver/40 mt-0.5 truncate">{item.metadata?.npc || 'Sistema de Campo'} · {item.getTypeLabel()}</p>
                        </div>
                        <span className="text-mono-ui text-[9px] text-industrial-silver/30 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                      </motion.button>
                    );
                  })
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'conquistas' && (
            <motion.div key="conquistas" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between px-1">
                <span className="text-protocol text-[8px] text-industrial-silver/40">Registros operacionais</span>
                <span className="text-mono-ui text-[10px] text-industrial-silver/30">{stats.earnedIds.size}/{ALL_ACHIEVEMENTS.length}</span>
              </div>
              <AchievementCatalog
                grantDocIds={playerData.achievementIds || []}
                campaignId={playerData.character.campaignId}
                unlockedCampaignIds={playerData.character.unlockedCampaigns}
                revealed={playerData.character.achievementsRevealed}
                variant="dossier"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="px-5 sm:px-6 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex justify-between items-center bg-surface-raised/80 border-t border-border-subtle shrink-0 relative z-20">
        <div className="flex items-center gap-2 text-protocol text-[8px] text-industrial-silver/50">
          <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse glow-orange-subtle" /> Conexão Segura
        </div>
        <div className="text-mono-ui text-[9px] text-industrial-silver/25">Grid Node: RM-LINK-84</div>
      </footer>

      <AnimatePresence>
        {selectedIntel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-110 bg-surface-overlay backdrop-blur-md flex flex-col items-center justify-center p-5"
            onClick={() => setSelectedIntel(null)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className="relative max-w-sm w-full"
              onClick={e => e.stopPropagation()}
            >
              <div className="relative rounded-card bg-surface-panel border border-border-strong shadow-panel overflow-hidden">
                <div aria-hidden className="absolute inset-x-0 top-0 h-0.75 bg-linear-to-r from-accent via-accent-60 to-transparent z-10" />
                <div className="flex items-center justify-between px-4 pt-4">
                  <span className="text-protocol text-[8px] text-primary/70">Arquivo Desbloqueado</span>
                  <span className="text-mono-ui text-[9px] text-industrial-silver/30">{selectedIntel.getFormattedLevel()}</span>
                </div>
                {selectedIntel instanceof VisualIntel ? (
                  <div className="p-4">
                    <div className="relative rounded-inset border border-border bg-surface-sunken overflow-hidden">
                      <img
                        src={selectedIntel.mediaUrl}
                        alt={selectedIntel.title}
                        loading="lazy"
                        decoding="async"
                        className="w-full max-h-[50vh] object-contain"
                        onError={(e) => { e.currentTarget.src = FALLBACK_EVIDENCE; }}
                      />
                      <CornerMarks />
                    </div>
                  </div>
                ) : (
                  <div className="p-4">
                    <div className="rounded-inset border border-border bg-surface-sunken p-4 text-mono-ui text-[11px] text-primary/80 max-h-[50vh] overflow-y-auto custom-scrollbar leading-relaxed">
                      <p className="whitespace-pre-wrap">{selectedIntel instanceof TextIntel ? selectedIntel.content : selectedIntel.description}</p>
                    </div>
                  </div>
                )}
                <div className="px-4 pb-4 border-t border-border-subtle pt-3">
                  <p className="text-display text-base text-white uppercase">{selectedIntel.title}</p>
                  <p className="text-industrial-silver/50 text-[10px] mt-1.5 leading-relaxed font-sans">{selectedIntel.description}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedIntel(null)}
                aria-label="Fechar"
                className="absolute -top-3 -right-3 w-9 h-9 rounded-full bg-surface-panel border border-border-strong flex items-center justify-center text-primary hover:border-border-accent hover:bg-accent-10 transition-colors shadow-panel"
              >
                <X size={14} />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
