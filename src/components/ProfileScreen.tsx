import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, LogOut, Trophy, Music, Pencil, Check, X, ExternalLink, Image, Map as MapIcon, User, Phone, ChevronRight } from 'lucide-react';
import { ALL_ACHIEVEMENTS } from '../data/achievements';
import PlayerGallery from './PlayerGallery';
import { AchievementCatalog } from './achievements/AchievementCatalog';
import { useLandscapeLayout } from '../player/hooks/useLandscapeLayout';
import type { GalleryImage, PlayerData } from '../types/player';

interface ProfileScreenProps {
  profile: PlayerData;
  galleryImages?: GalleryImage[];
  onBack: () => void;
  onLogout: () => void;
  onUpdateSpotify?: (url: string) => void;
  onUpdatePhoneNumber?: (phoneNumber: string) => void;
  onChangeMission?: () => void;
  onChangeCharacter?: () => void;
  variant?: 'default' | 'nokia';
}

function extractSpotifyEmbedUrl(url: string): string | null {
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
    if (match) {
      return `https://open.spotify.com/embed/${match[1]}/${match[2]}?utm_source=generator&theme=0`;
    }
    return null;
  } catch {
    return null;
  }
}

type AgentStatusKey = 'vivo' | 'morto' | 'desaparecido';

const STATUS_CONFIG: Map<AgentStatusKey, { label: string; color: string; dot: string; border: string }> = new Map([
  ['vivo', { label: 'ATIVO', color: 'text-green-400', dot: 'bg-green-400', border: 'border-green-500/30' }],
  ['morto', { label: 'ELIMINADO', color: 'text-red-400', dot: 'bg-red-400', border: 'border-red-500/30' }],
  ['desaparecido', { label: 'DESAPARECIDO', color: 'text-yellow-400', dot: 'bg-yellow-400', border: 'border-yellow-500/30' }],
]);
const DEFAULT_STATUS = { label: 'ATIVO', color: 'text-green-400', dot: 'bg-green-400', border: 'border-green-500/30' };

const DANGER_LABELS = ['—', 'BAIXO', 'MODERADO', 'ELEVADO', 'ALTO', 'CRÍTICO'] as const;

export function generateRandomUSPhoneNumber(): string {
  const areaCode = Math.floor(100 + Math.random() * 900); // 100-999
  const exchangeCode = Math.floor(100 + Math.random() * 900); // 100-999
  const subscriberNumber = Math.floor(1000 + Math.random() * 9000); // 1000-9999
  return `(${areaCode}) ${exchangeCode}-${subscriberNumber}`;
}

/* ─── Peças do tema Deck (escuro) ─────────────────────────────── */

const CornerMarks = () => (
  <>
    <span aria-hidden className="absolute top-1 left-1 w-2.5 h-2.5 border-t border-l border-border-accent" />
    <span aria-hidden className="absolute top-1 right-1 w-2.5 h-2.5 border-t border-r border-border-accent" />
    <span aria-hidden className="absolute bottom-1 left-1 w-2.5 h-2.5 border-b border-l border-border-accent" />
    <span aria-hidden className="absolute bottom-1 right-1 w-2.5 h-2.5 border-b border-r border-border-accent" />
  </>
);

const SectionHeader = ({
  index,
  title,
  Icon,
  tone = 'text-primary',
  action,
}: {
  index: string;
  title: string;
  Icon: React.FC<{ size?: number; className?: string }>;
  tone?: string;
  action?: React.ReactNode;
}) => (
  <div className="flex items-center gap-3 mb-3">
    <span className="text-mono-ui text-[10px] text-industrial-silver/30">{index}</span>
    <h2 className={`text-protocol flex items-center gap-2 ${tone}`}>
      <Icon size={12} />
      {title}
    </h2>
    <span aria-hidden className="flex-1 h-px bg-border-subtle" />
    {action}
  </div>
);

const Stat = ({ value, label }: { value: React.ReactNode; label: string }) => (
  <div className="flex-1 flex flex-col items-center py-3 border-r border-border-subtle last:border-r-0">
    <span className="text-mono-ui text-xl font-semibold text-primary leading-none">{value}</span>
    <span className="text-protocol text-[8px] text-industrial-silver/40 mt-1.5">{label}</span>
  </div>
);

const ActionRow = ({
  onClick,
  Icon,
  title,
  sub,
}: {
  onClick?: () => void;
  Icon: React.FC<{ size?: number; className?: string }>;
  title: string;
  sub: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full flex items-center gap-3 px-3.5 py-3 rounded-card border border-border bg-surface-raised hover:border-border-accent hover:bg-accent-05 active:scale-[0.99] transition-all duration-200 group text-left"
  >
    <div className="w-9 h-9 rounded-control bg-surface-sunken border border-border text-primary flex items-center justify-center shrink-0 group-hover:bg-accent-10 group-hover:border-border-accent transition-colors">
      <Icon size={15} />
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-protocol text-white text-[10px]">{title}</div>
      <div className="text-mono-ui text-[10px] text-industrial-silver/40 mt-0.5 truncate">{sub}</div>
    </div>
    <ChevronRight size={16} className="text-primary/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
  </button>
);

/* ─── Peças do tema Handset (LCD mono) ────────────────────────── */

const NokiaSection = ({
  index,
  title,
  action,
  children,
}: {
  index: string;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <section className="border-2 border-[#111e14] p-1.5 shadow-[2px_2px_0px_#111e14] bg-[#edfeed]">
    <div className="flex justify-between items-center mb-1.5 pb-1 border-b border-dotted border-[#111e14]/60">
      <span className="text-[8px] font-black flex items-center gap-1.5">
        <span className="opacity-50">{index}</span>
        <span>{title}</span>
      </span>
      {action}
    </div>
    {children}
  </section>
);

export default function ProfileScreen({
  profile,
  galleryImages = [],
  onBack,
  onLogout,
  onUpdateSpotify,
  onUpdatePhoneNumber,
  onChangeMission,
  onChangeCharacter,
  variant = 'default'
}: ProfileScreenProps) {
  const { isLandscape } = useLandscapeLayout();

  const [isEditingSpotify, setIsEditingSpotify] = useState(false);
  const [spotifyInput, setSpotifyInput] = useState(profile.character.spotifyPlaylistUrl || '');
  const [spotifyError, setSpotifyError] = useState('');

  const initials = profile.character.codinome
    .split(/[\s\-_]+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  const embedUrl = extractSpotifyEmbedUrl(profile.character.spotifyPlaylistUrl || '');
  const statusCfg = STATUS_CONFIG.get((profile.character.agentStatus || 'vivo') as AgentStatusKey) ?? DEFAULT_STATUS;
  const dangerLevel = profile.character.dangerLevel || 0;
  const dangerLabel = DANGER_LABELS[dangerLevel] ?? '—';
  const agentCode = `RM-${profile.character.agentId || 'XXXX'}`;

  const handleSaveSpotify = () => {
    const trimmed = spotifyInput.trim();
    if (trimmed && !extractSpotifyEmbedUrl(trimmed)) {
      setSpotifyError('Link inválido. Use o link de uma playlist do Spotify.');
      return;
    }
    setSpotifyError('');
    onUpdateSpotify?.(trimmed);
    setIsEditingSpotify(false);
  };

  const handleCancelEdit = () => {
    setSpotifyInput(profile.character.spotifyPlaylistUrl || '');
    setSpotifyError('');
    setIsEditingSpotify(false);
  };

  const startEditingSpotify = () => {
    setIsEditingSpotify(true);
    setSpotifyInput(profile.character.spotifyPlaylistUrl || '');
  };

  const handleGeneratePhone = () => onUpdatePhoneNumber?.(generateRandomUSPhoneNumber());

  if (variant === 'nokia') {
    return (
      <div className="w-full h-full bg-[#edfeed] text-[#111e14] flex flex-col p-1 font-mono uppercase text-[10px] select-none tracking-widest relative">
        {/* Header */}
        <div className="flex justify-between items-center border-b-2 border-[#111e14] pb-1 shrink-0 font-bold mb-2">
          <button onClick={onBack} className="hover:bg-[#111e14] hover:text-[#edfeed] px-1 active:scale-95 transition-all">
            [VOLTAR]
          </button>
          <span className="text-[8px] flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-[#111e14] animate-pulse" />
            FICHA_AGENTE
          </span>
          <button onClick={onLogout} className="hover:bg-[#111e14] hover:text-[#edfeed] px-1 active:scale-95 transition-all">
            [SAIR]
          </button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 space-y-2.5 pb-2 pr-1" style={{ scrollbarWidth: 'none' }}>

          {/* Identidade */}
          <div className="border-2 border-[#111e14] p-2 relative overflow-hidden shadow-[2px_2px_0px_#111e14]">
            <span className="absolute top-1 right-1 text-[6px] font-black border border-[#111e14] px-1 -rotate-3 opacity-70">CLASSIFICADO</span>
            <div className="flex gap-3 mb-2">
              <div className="w-12 h-12 border-2 border-[#111e14] bg-[#edfeed] shrink-0 flex items-center justify-center font-black text-[16px] relative overflow-hidden shadow-[1px_1px_0px_#111e14]">
                {profile.character.profilePhotoUrl ? (
                  <img
                    src={profile.character.profilePhotoUrl}
                    alt="Perfil"
                    className="w-full h-full object-cover grayscale contrast-150 brightness-75 mix-blend-multiply"
                  />
                ) : (
                  <span>{initials}</span>
                )}
                <div className="absolute inset-0 opacity-10 pointer-events-none bg-[repeating-linear-gradient(0deg,transparent,transparent_1px,#111e14_1px,#111e14_2px)]" />
              </div>

              <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <div className="text-[12px] font-black leading-none truncate pr-14">{profile.character.codinome}</div>
                  <div className="text-[8px] opacity-60 font-bold tracking-tighter">ID: {agentCode}</div>
                </div>
                <div className={`self-start px-1.5 py-0.5 border border-[#111e14] text-[7px] font-black ${profile.character.agentStatus === 'vivo' || !profile.character.agentStatus ? 'bg-[#111e14] text-[#edfeed]' : ''}`}>
                  STATUS: {statusCfg.label}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 border-y border-dotted border-[#111e14]/60 py-2 my-2">
              {[
                { label: 'PROVAS', value: profile.unlockedIntelIds.length },
                { label: 'MEDALHAS', value: profile.achievementIds.length },
                { label: 'IMAGENS', value: galleryImages.length },
              ].map((s) => (
                <div key={s.label} className="flex flex-col">
                  <span className="text-[7px] opacity-60 font-bold tracking-tighter">{s.label}</span>
                  <span className="text-[14px] font-black leading-none mt-1">{String(s.value).padStart(2, '0')}</span>
                </div>
              ))}
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[7px] opacity-60 font-bold">PERICULOSIDADE</span>
                <span className="text-[7px] font-black">{dangerLabel}</span>
              </div>
              <div className="flex gap-0.5 h-1.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className={`flex-1 border border-[#111e14] ${i < dangerLevel ? 'bg-[#111e14]' : ''}`} />
                ))}
              </div>
            </div>
          </div>

          {/* Ações */}
          <div className="space-y-1">
            <button onClick={onChangeMission} className="w-full border-2 border-[#111e14] flex justify-between px-2 py-2 hover:bg-[#111e14] hover:text-[#edfeed] font-black active:scale-95 transition-all shadow-[1px_1px_0px_#111e14]">
              <span>&gt; ALVO / MISSÃO</span>
              <span>&raquo;</span>
            </button>
            <button onClick={onChangeCharacter} className="w-full border-2 border-[#111e14] flex justify-between px-2 py-2 hover:bg-[#111e14] hover:text-[#edfeed] font-black active:scale-95 transition-all shadow-[1px_1px_0px_#111e14]">
              <span>&gt; TROCAR AGENTE</span>
              <span>&raquo;</span>
            </button>
          </div>

          {/* Deck */}
          <NokiaSection
            index="01"
            title="DECK / REDE_SCN"
            action={
              onUpdateSpotify && !isEditingSpotify ? (
                <button onClick={startEditingSpotify} className="hover:bg-[#111e14] hover:text-[#edfeed] px-1 active:scale-95 transition-all text-[8px] border border-[#111e14]">
                  [{embedUrl ? 'EDIT' : 'LINK'}]
                </button>
              ) : undefined
            }
          >
            {isEditingSpotify ? (
              <div className="space-y-1">
                <input
                  type="url"
                  value={spotifyInput}
                  onChange={(e) => { setSpotifyInput(e.target.value); setSpotifyError(''); }}
                  placeholder="URL SPOTIFY..."
                  className="w-full bg-[#edfeed] border border-[#111e14] px-1 py-1 text-[9px] text-[#111e14] focus:outline-none placeholder:text-[#111e14]/50"
                  autoFocus
                />
                {spotifyError && <p className="text-[8px] animate-pulse">ERRO: {spotifyError}</p>}
                <div className="flex gap-1 justify-end">
                  <button onClick={handleCancelEdit} className="border border-[#111e14] px-2 py-0.5 hover:bg-[#111e14] hover:text-[#edfeed] active:scale-95 transition-all text-[8px]">[CANC]</button>
                  <button onClick={handleSaveSpotify} className="border border-[#111e14] px-2 py-0.5 hover:bg-[#111e14] hover:text-[#edfeed] active:scale-95 transition-all font-black text-[8px]">[SALV]</button>
                </div>
              </div>
            ) : embedUrl ? (
              <div className="border border-dashed border-[#111e14] p-0.5 opacity-90">
                <iframe src={embedUrl} width="100%" height="80" frameBorder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" title="Spotify Deck" />
              </div>
            ) : (
              <div className="text-[8px] text-center border border-dashed border-[#111e14] py-3 opacity-60 font-bold italic">
                SEM CONEXÃO DE ÁUDIO.
              </div>
            )}
          </NokiaSection>

          {/* Handset */}
          <NokiaSection index="02" title="CONTATO / SMS_LINK">
            {profile.character.phoneNumber ? (
              <div className="flex justify-between items-center bg-[#111e14] text-[#edfeed] p-1.5">
                <span className="text-[8px] font-black">LINHA:</span>
                <span className="text-[10px] font-mono tracking-tighter">{profile.character.phoneNumber}</span>
              </div>
            ) : (
              <button
                onClick={handleGeneratePhone}
                className="w-full border-2 border-[#111e14] py-1.5 text-center hover:bg-[#111e14] hover:text-[#edfeed] active:scale-95 transition-all text-[9px] font-black"
              >
                [GERAR NÚMERO US]
              </button>
            )}
          </NokiaSection>

          {/* Galeria */}
          <NokiaSection index="03" title="ARQUIVOS_VISUAIS">
            <PlayerGallery images={galleryImages} variant="nokia" />
          </NokiaSection>

          {/* Conquistas */}
          <NokiaSection index="04" title="REGISTROS_OPERACIONAIS" action={<span className="text-[7px] opacity-60">{profile.achievementIds.length}/{ALL_ACHIEVEMENTS.length}</span>}>
            <AchievementCatalog
              grantDocIds={profile.achievementIds}
              campaignId={profile.character.campaignId}
              unlockedCampaignIds={profile.character.unlockedCampaigns}
              revealed={profile.character.achievementsRevealed}
              variant="nokia"
            />
          </NokiaSection>
        </div>
      </div>
    );
  }

  const iconButtonClass =
    'w-10 h-10 rounded-control border border-border bg-surface-panel flex items-center justify-center active:scale-95 transition-all duration-200 shrink-0';

  return (
    <motion.div
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'spring', damping: 24, stiffness: 200 }}
      className={`relative w-full h-full bg-surface-container-high rounded-4xl border-8 border-surface-sunken shadow-panel flex flex-col overflow-hidden z-50 p-2 ${
        isLandscape ? 'max-w-none max-h-none' : 'max-w-sm max-h-187.5 lg:max-w-md xl:max-w-lg lg:max-h-205'
      }`}
    >
      {/* Tela do dispositivo */}
      <div className="relative flex-1 min-h-0 flex flex-col bg-surface rounded-device overflow-hidden shadow-hairline border border-border-subtle">
        <div aria-hidden className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_40%_at_50%_0%,var(--color-accent-05),transparent_70%)]" />

        {/* Header */}
        <header className="relative z-10 flex items-center justify-between px-4 pt-4 pb-3 shrink-0 border-b border-border-subtle bg-surface-raised/70 backdrop-blur-sm">
          <button
            type="button"
            onClick={onBack}
            aria-label="Voltar ao deck"
            className={`${iconButtonClass} text-primary hover:border-border-accent hover:bg-accent-10`}
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex flex-col items-center gap-0.5 min-w-0">
            <span className="text-protocol text-[8px] text-industrial-silver/40">Ficha do Agente</span>
            <span className="text-mono-ui text-[10px] text-primary/70">{agentCode}</span>
          </div>
          <button
            type="button"
            onClick={onLogout}
            aria-label="Desconectar"
            className={`${iconButtonClass} text-red-400 hover:border-red-500/40 hover:bg-red-500/10`}
          >
            <LogOut size={15} />
          </button>
        </header>

        {/* Identidade */}
        <section className="relative z-10 px-4 pt-5 pb-4 shrink-0">
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 rounded-card overflow-hidden border border-border-strong bg-surface-sunken shrink-0 flex items-center justify-center glow-orange-subtle">
              {profile.character.profilePhotoUrl ? (
                <img src={profile.character.profilePhotoUrl} alt="Perfil" className="w-full h-full object-cover" />
              ) : (
                <span className="text-display text-2xl text-primary">{initials || '?'}</span>
              )}
              <div aria-hidden className="absolute inset-0 pointer-events-none opacity-30 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,#00000066_2px,#00000066_3px)]" />
              <CornerMarks />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-display text-[22px] text-white uppercase truncate">{profile.character.codinome}</h1>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-inset border bg-surface-raised text-protocol text-[8px] ${statusCfg.border} ${statusCfg.color}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot} animate-pulse`} />
                  {statusCfg.label}
                </span>
                <span className="text-mono-ui text-[10px] text-industrial-silver/40">
                  Nível <span className={dangerLevel >= 4 ? 'text-red-400' : dangerLevel >= 2 ? 'text-primary' : ''}>{dangerLabel}</span>
                </span>
              </div>
              <div className="mt-3 flex gap-1">
                {Array.from({ length: 5 }, (_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 flex-1 rounded-inset transition-all duration-700 ${
                      i < dangerLevel
                        ? dangerLevel >= 4 ? 'bg-red-500' : 'bg-primary'
                        : 'bg-surface-sunken border border-border-subtle'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Leituras */}
        <div className="relative z-10 mx-4 flex rounded-card border border-border bg-surface-raised shadow-hairline overflow-hidden shrink-0">
          <Stat value={profile.unlockedIntelIds.length} label="Provas" />
          <Stat value={profile.achievementIds.length} label="Conquistas" />
          <Stat value={galleryImages.length} label="Imagens" />
        </div>

        <div className="relative z-10 flex-1 overflow-y-auto min-h-0 custom-scrollbar">
          {/* Ações */}
          <div className="px-4 pt-4 pb-2 space-y-2">
            <ActionRow onClick={onChangeMission} Icon={MapIcon} title="Alternar Missão" sub="Trocar a realidade ativa" />
            <ActionRow onClick={onChangeCharacter} Icon={User} title="Trocar Agente" sub="Assumir nova identidade" />
          </div>

          {/* Deck */}
          <section className="px-4 pt-5 pb-2">
            <SectionHeader
              index="01"
              title="Meu Deck"
              Icon={Music}
              tone="text-[#1DB954]"
              action={
                onUpdateSpotify && !isEditingSpotify ? (
                  <button
                    type="button"
                    onClick={startEditingSpotify}
                    className="flex items-center gap-1 text-protocol text-[8px] text-industrial-silver/40 hover:text-[#1DB954] transition-colors"
                  >
                    <Pencil size={9} />
                    {embedUrl ? 'Editar' : 'Conectar'}
                  </button>
                ) : undefined
              }
            />
            <AnimatePresence mode="wait">
              {isEditingSpotify ? (
                <motion.div
                  key="edit"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="space-y-2"
                >
                  <div className="rounded-card border border-border bg-surface-raised p-3">
                    <label className="text-protocol text-[8px] text-industrial-silver/40 block mb-2">
                      Cole o link da sua playlist do Spotify
                    </label>
                    <input
                      type="url"
                      value={spotifyInput}
                      onChange={(e) => { setSpotifyInput(e.target.value); setSpotifyError(''); }}
                      placeholder="https://open.spotify.com/playlist/..."
                      className="w-full bg-surface-sunken border border-border rounded-control px-3 py-2 text-base text-white placeholder:text-industrial-silver/20 focus:border-[#1DB954]/60 focus:outline-none transition-colors font-mono"
                      autoFocus
                    />
                    {spotifyError && <p className="text-red-400 text-[10px] mt-1.5 font-sans">{spotifyError}</p>}
                    <p className="text-[9px] text-industrial-silver/30 mt-2 leading-relaxed font-sans">
                      Abra o Spotify → Playlist → Compartilhar → Copiar link
                    </p>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-control border border-border bg-surface-raised text-industrial-silver/60 text-protocol text-[8px] hover:text-white transition-colors"
                    >
                      <X size={10} /> Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveSpotify}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-control bg-[#1DB954]/15 text-[#1DB954] text-protocol text-[8px] border border-[#1DB954]/30 hover:bg-[#1DB954]/25 transition-colors"
                    >
                      <Check size={10} /> Salvar
                    </button>
                  </div>
                </motion.div>
              ) : embedUrl ? (
                <motion.div
                  key="player"
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  className="rounded-card overflow-hidden border border-border bg-surface-sunken shadow-[0_0_24px_-8px_rgba(29,185,84,0.25)]"
                >
                  <iframe
                    src={embedUrl}
                    width="100%"
                    height="352"
                    frameBorder="0"
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    loading="lazy"
                    className="block"
                    title="Spotify Deck"
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="rounded-card border border-dashed border-border bg-surface-raised/40 p-6 text-center"
                >
                  <div className="w-12 h-12 rounded-control bg-surface-sunken border border-border flex items-center justify-center mx-auto mb-3 text-[#1DB954]/60">
                    <Music size={20} />
                  </div>
                  <p className="text-protocol text-industrial-silver/50 mb-1">Nenhuma playlist conectada</p>
                  <p className="text-[10px] text-industrial-silver/30 font-sans">Conecte sua playlist do Spotify para personalizar seu Deck.</p>
                  {onUpdateSpotify && (
                    <button
                      type="button"
                      onClick={() => setIsEditingSpotify(true)}
                      className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-control bg-[#1DB954]/15 text-[#1DB954] text-protocol text-[8px] border border-[#1DB954]/25 hover:bg-[#1DB954]/25 transition-colors"
                    >
                      <ExternalLink size={10} />
                      Conectar Spotify
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {/* Linha de contato */}
          <section className="px-4 pt-5 pb-2">
            <SectionHeader index="02" title="Linha de Contato" Icon={Phone} />
            <div className="rounded-card border border-border bg-surface-raised p-3">
              {profile.character.phoneNumber ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-mono-ui text-sm text-white">{profile.character.phoneNumber}</span>
                  <span className="inline-flex items-center gap-1.5 text-protocol text-[8px] text-primary">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" /> Ativa
                  </span>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <p className="text-[10px] text-industrial-silver/50 leading-relaxed font-sans">
                    Você precisa de um número americano para enviar mensagens no grupo.
                  </p>
                  <button
                    type="button"
                    onClick={handleGeneratePhone}
                    className="w-full py-2.5 rounded-control bg-accent text-black text-protocol hover:bg-primary-container active:scale-[0.98] transition-all glow-orange-subtle"
                  >
                    Gerar Número Aleatório
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* Galeria */}
          <section className="px-4 pt-5 pb-2">
            <SectionHeader index="03" title="Arquivo Visual" Icon={Image} />
            <PlayerGallery images={galleryImages} />
          </section>

          {/* Conquistas */}
          <section className="px-4 pt-5 pb-6">
            <SectionHeader
              index="04"
              title="Conquistas"
              Icon={Trophy}
              action={<span className="text-mono-ui text-[10px] text-industrial-silver/40">{profile.achievementIds.length}/{ALL_ACHIEVEMENTS.length}</span>}
            />
            <AchievementCatalog
              grantDocIds={profile.achievementIds}
              campaignId={profile.character.campaignId}
              unlockedCampaignIds={profile.character.unlockedCampaigns}
              revealed={profile.character.achievementsRevealed}
              variant="deck"
            />
          </section>
        </div>
      </div>
    </motion.div>
  );
}
