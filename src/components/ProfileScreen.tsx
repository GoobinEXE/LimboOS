import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, LogOut, Trophy, Music, Pencil, Check, X, ExternalLink, Image, Map as MapIcon, User, Phone, ChevronRight } from 'lucide-react';
import PlayerGallery from './PlayerGallery';
import { AchievementCatalog } from './achievements/AchievementCatalog';
import LanguageSelector from './LanguageSelector';
import { useLandscapeLayout } from '../player/hooks/useLandscapeLayout';
import { useAchievementCatalog } from '../hooks/useAchievementCatalog';
import type { GalleryImage, PlayerData } from '../types/player';
import { extractSpotifyEmbedUrl } from '../lib/spotify';

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

type AgentStatusKey = 'vivo' | 'morto' | 'desaparecido';

const STATUS_STYLE: Map<AgentStatusKey, { color: string; dot: string; border: string }> = new Map([
  ['vivo', { color: 'text-phosphor-400', dot: 'bg-phosphor-400', border: 'border-phosphor-500/30' }],
  ['morto', { color: 'text-red-400', dot: 'bg-red-400', border: 'border-red-500/30' }],
  ['desaparecido', { color: 'text-yellow-400', dot: 'bg-yellow-400', border: 'border-yellow-500/30' }],
]);
const DEFAULT_STATUS_STYLE = { color: 'text-phosphor-400', dot: 'bg-phosphor-400', border: 'border-phosphor-500/30' };

const STATUS_LABEL_KEY: Record<AgentStatusKey, 'ativo' | 'eliminado' | 'desaparecido'> = {
  vivo: 'ativo',
  morto: 'eliminado',
  desaparecido: 'desaparecido',
};

const DANGER_KEYS = ['none', 'baixo', 'moderado', 'elevado', 'alto', 'critico'] as const;

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
    className="w-full flex items-center gap-3 px-3.5 py-3 rounded-card border border-border bg-surface-raised hover:border-border-accent hover:bg-accent-05 active:scale-[0.99] transition duration-200 group text-left"
  >
    <div className="w-9 h-9 rounded-control bg-surface-sunken border border-border text-primary flex items-center justify-center shrink-0 group-hover:bg-accent-10 group-hover:border-border-accent transition-colors">
      <Icon size={15} />
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-protocol text-white text-[10px]">{title}</div>
      <div className="text-mono-ui text-[10px] text-industrial-silver/40 mt-0.5 truncate">{sub}</div>
    </div>
    <ChevronRight size={16} className="text-primary/40 group-hover:text-primary group-hover:translate-x-0.5 transition shrink-0" />
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
  <section className="border-2 border-lcd-ink p-1.5 shadow-[2px_2px_0px_#111e14] bg-lcd-paper">
    <div className="flex justify-between items-center mb-1.5 pb-1 border-b border-dotted border-lcd-ink/60">
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
  const { t } = useTranslation('player');
  const { achievements } = useAchievementCatalog();
  const { t: tCommon } = useTranslation('common');
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
  const agentStatus = (profile.character.agentStatus || 'vivo') as AgentStatusKey;
  const statusStyle = STATUS_STYLE.get(agentStatus) ?? DEFAULT_STATUS_STYLE;
  const statusLabel = tCommon(`status.${STATUS_LABEL_KEY[agentStatus] ?? 'ativo'}`);
  const statusCfg = { ...statusStyle, label: statusLabel };
  const dangerLevel = profile.character.dangerLevel || 0;
  const dangerLabel = tCommon(`danger.${DANGER_KEYS[dangerLevel] ?? 'none'}`);
  const agentCode = `RM-${profile.character.agentId || 'XXXX'}`;

  const handleSaveSpotify = () => {
    const trimmed = spotifyInput.trim();
    if (trimmed && !extractSpotifyEmbedUrl(trimmed)) {
      setSpotifyError(t('profile.deck.error'));
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
      <div className="w-full h-full bg-lcd-paper text-lcd-ink flex flex-col p-1 font-mono uppercase text-[10px] select-none tracking-widest relative">
        {/* Header */}
        <div className="flex justify-between items-center border-b-2 border-lcd-ink pb-1 shrink-0 font-bold mb-2">
          <button onClick={onBack} className="hover:bg-lcd-ink hover:text-lcd-paper px-1 active:scale-[0.97] transition">
            {tCommon('actions.backBracket')}
          </button>
          <span className="text-[8px] flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-lcd-ink animate-pulse" />
            {t('profile.header.nokia')}
          </span>
          <button onClick={onLogout} className="hover:bg-lcd-ink hover:text-lcd-paper px-1 active:scale-[0.97] transition">
            {tCommon('actions.exitBracket')}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 space-y-2.5 pb-2 pr-1" style={{ scrollbarWidth: 'none' }}>

          {/* Identidade */}
          <div className="border-2 border-lcd-ink p-2 relative overflow-hidden shadow-[2px_2px_0px_#111e14]">
            <span className="absolute top-1 right-1 text-[6px] font-black border border-lcd-ink px-1 -rotate-3 opacity-70">{tCommon('classified')}</span>
            <div className="flex gap-3 mb-2">
              <div className="w-12 h-12 border-2 border-lcd-ink bg-lcd-paper shrink-0 flex items-center justify-center font-black text-[16px] relative overflow-hidden shadow-[1px_1px_0px_#111e14]">
                {profile.character.profilePhotoUrl ? (
                  <img
                    src={profile.character.profilePhotoUrl}
                    alt={tCommon('profileAlt')}
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
                  <div className="text-[8px] opacity-60 font-bold tracking-tighter">{tCommon('id')}: {agentCode}</div>
                </div>
                <div className={`self-start px-1.5 py-0.5 border border-lcd-ink text-[7px] font-black ${profile.character.agentStatus === 'vivo' || !profile.character.agentStatus ? 'bg-lcd-ink text-lcd-paper' : ''}`}>
                  {t('profile.statusPrefix', { status: statusCfg.label })}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 border-y border-dotted border-lcd-ink/60 py-2 my-2">
              {[
                { label: t('profile.stat.proofsUpper'), value: profile.unlockedIntelIds.length },
                { label: t('profile.stat.medalsUpper'), value: profile.achievementIds.length },
                { label: t('profile.stat.imagesUpper'), value: galleryImages.length },
              ].map((s) => (
                <div key={s.label} className="flex flex-col">
                  <span className="text-[7px] opacity-60 font-bold tracking-tighter">{s.label}</span>
                  <span className="text-[14px] font-black leading-none mt-1">{String(s.value).padStart(2, '0')}</span>
                </div>
              ))}
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[7px] opacity-60 font-bold">{tCommon('danger.labelUpper')}</span>
                <span className="text-[7px] font-black">{dangerLabel}</span>
              </div>
              <div className="flex gap-0.5 h-1.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className={`flex-1 border border-lcd-ink ${i < dangerLevel ? 'bg-lcd-ink' : ''}`} />
                ))}
              </div>
            </div>
          </div>

          {/* Ações */}
          <div className="space-y-1">
            <button onClick={onChangeMission} className="w-full border-2 border-lcd-ink flex justify-between px-2 py-2 hover:bg-lcd-ink hover:text-lcd-paper font-black active:scale-[0.97] transition shadow-[1px_1px_0px_#111e14]">
              <span>{t('profile.action.missionNokia')}</span>
              <span>&raquo;</span>
            </button>
            <button onClick={onChangeCharacter} className="w-full border-2 border-lcd-ink flex justify-between px-2 py-2 hover:bg-lcd-ink hover:text-lcd-paper font-black active:scale-[0.97] transition shadow-[1px_1px_0px_#111e14]">
              <span>{t('profile.action.agentNokia')}</span>
              <span>&raquo;</span>
            </button>
          </div>

          <NokiaSection index="00" title={t('profile.languageSection')}>
            <LanguageSelector variant="nokia" />
          </NokiaSection>

          {/* Deck */}
          <NokiaSection
            index="01"
            title={t('profile.deck.nokia')}
            action={
              onUpdateSpotify && !isEditingSpotify ? (
                <button onClick={startEditingSpotify} className="hover:bg-lcd-ink hover:text-lcd-paper px-1 active:scale-[0.97] transition text-[8px] border border-lcd-ink">
                  {embedUrl ? t('profile.deck.editShort') : t('profile.deck.linkShort')}
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
                  placeholder={t('profile.deck.placeholderNokia')}
                  className="w-full bg-lcd-paper border border-lcd-ink px-1 py-1 text-[9px] text-lcd-ink focus:outline-none placeholder:text-lcd-ink/50"
                  autoFocus
                />
                {spotifyError && <p className="text-[8px] animate-pulse">{tCommon('error')}: {spotifyError}</p>}
                <div className="flex gap-1 justify-end">
                  <button onClick={handleCancelEdit} className="border border-lcd-ink px-2 py-0.5 hover:bg-lcd-ink hover:text-lcd-paper active:scale-[0.97] transition text-[8px]">{tCommon('actions.cancelShort')}</button>
                  <button onClick={handleSaveSpotify} className="border border-lcd-ink px-2 py-0.5 hover:bg-lcd-ink hover:text-lcd-paper active:scale-[0.97] transition font-black text-[8px]">{tCommon('actions.saveShort')}</button>
                </div>
              </div>
            ) : embedUrl ? (
              <div className="border border-dashed border-lcd-ink p-0.5 opacity-90">
                <iframe src={embedUrl} width="100%" height="80" frameBorder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" title={t('profile.deck.iframeTitle')} />
              </div>
            ) : (
              <div className="text-[8px] text-center border border-dashed border-lcd-ink py-3 opacity-60 font-bold italic">
                {t('profile.deck.noAudioNokia')}
              </div>
            )}
          </NokiaSection>

          {/* Handset */}
          <NokiaSection index="02" title={t('profile.contact.nokia')}>
            {profile.character.phoneNumber ? (
              <div className="flex justify-between items-center bg-lcd-ink text-lcd-paper p-1.5">
                <span className="text-[8px] font-black">{t('profile.contact.line')}</span>
                <span className="text-[10px] font-mono tracking-tighter">{profile.character.phoneNumber}</span>
              </div>
            ) : (
              <button
                onClick={handleGeneratePhone}
                className="w-full border-2 border-lcd-ink py-1.5 text-center hover:bg-lcd-ink hover:text-lcd-paper active:scale-[0.97] transition text-[9px] font-black"
              >
                {t('profile.contact.generateNokia')}
              </button>
            )}
          </NokiaSection>

          {/* Galeria */}
          <NokiaSection index="03" title={t('profile.gallery.nokia')}>
            <PlayerGallery images={galleryImages} variant="nokia" />
          </NokiaSection>

          {/* Conquistas */}
          <NokiaSection index="04" title={t('profile.achievements.nokia')} action={<span className="text-[7px] opacity-60">{profile.achievementIds.length}/{achievements.length}</span>}>
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
    'w-10 h-10 rounded-control border border-border bg-surface-panel flex items-center justify-center active:scale-[0.97] transition duration-200 shrink-0';

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
            aria-label={t('profile.backAria')}
            className={`${iconButtonClass} text-primary hover:border-border-accent hover:bg-accent-10`}
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex flex-col items-center gap-0.5 min-w-0">
            <span className="text-protocol text-[8px] text-industrial-silver/40">{t('profile.header.agentFile')}</span>
            <span className="text-mono-ui text-[10px] text-primary/70">{agentCode}</span>
          </div>
          <button
            type="button"
            onClick={onLogout}
            aria-label={t('profile.logoutAria')}
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
                <img src={profile.character.profilePhotoUrl} alt={tCommon('profileAlt')} className="w-full h-full object-cover" />
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
                  {tCommon('nivel')} <span className={dangerLevel >= 4 ? 'text-red-400' : dangerLevel >= 2 ? 'text-primary' : ''}>{dangerLabel}</span>
                </span>
              </div>
              <div className="mt-3 flex gap-1">
                {Array.from({ length: 5 }, (_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 flex-1 rounded-inset transition duration-700 ${
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
          <Stat value={profile.unlockedIntelIds.length} label={t('profile.stat.proofs')} />
          <Stat value={profile.achievementIds.length} label={t('profile.stat.achievements')} />
          <Stat value={galleryImages.length} label={t('profile.stat.images')} />
        </div>

        <div className="relative z-10 flex-1 overflow-y-auto min-h-0 custom-scrollbar">
          {/* Ações */}
          <div className="px-4 pt-4 pb-2 space-y-2">
            <ActionRow onClick={onChangeMission} Icon={MapIcon} title={t('profile.action.mission')} sub={t('profile.action.missionSub')} />
            <ActionRow onClick={onChangeCharacter} Icon={User} title={t('profile.action.agent')} sub={t('profile.action.agentSub')} />
          </div>

          <section className="px-4 pt-4 pb-2">
            <div className="rounded-card border border-border bg-surface-raised/60 p-3">
              <div className="text-protocol text-[8px] text-industrial-silver/40 mb-2">{t('profile.languageSection')}</div>
              <LanguageSelector variant="deck" />
            </div>
          </section>

          {/* Deck */}
          <section className="px-4 pt-5 pb-2">
            <SectionHeader
              index="01"
              title={t('profile.deck.title')}
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
                    {embedUrl ? t('profile.deck.edit') : t('profile.deck.connect')}
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
                      {t('profile.deck.label')}
                    </label>
                    <input
                      type="url"
                      value={spotifyInput}
                      onChange={(e) => { setSpotifyInput(e.target.value); setSpotifyError(''); }}
                      placeholder={t('profile.deck.placeholder')}
                      className="w-full bg-surface-sunken border border-border rounded-control px-3 py-2 text-base text-white placeholder:text-industrial-silver/20 focus:border-[#1DB954]/60 focus:outline-none transition-colors font-mono"
                      autoFocus
                    />
                    {spotifyError && <p className="text-red-400 text-[10px] mt-1.5 font-sans">{spotifyError}</p>}
                    <p className="text-[9px] text-industrial-silver/30 mt-2 leading-relaxed font-sans">
                      {t('profile.deck.hint')}
                    </p>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-control border border-border bg-surface-raised text-industrial-silver/60 text-protocol text-[8px] hover:text-white transition-colors"
                    >
                      <X size={10} /> {tCommon('cancel')}
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveSpotify}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-control bg-[#1DB954]/15 text-[#1DB954] text-protocol text-[8px] border border-[#1DB954]/30 hover:bg-[#1DB954]/25 transition-colors"
                    >
                      <Check size={10} /> {tCommon('save')}
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
                    title={t('profile.deck.iframeTitle')}
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
                  <p className="text-protocol text-industrial-silver/50 mb-1">{t('profile.deck.emptyTitle')}</p>
                  <p className="text-[10px] text-industrial-silver/30 font-sans">{t('profile.deck.emptyHint')}</p>
                  {onUpdateSpotify && (
                    <button
                      type="button"
                      onClick={() => setIsEditingSpotify(true)}
                      className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-control bg-[#1DB954]/15 text-[#1DB954] text-protocol text-[8px] border border-[#1DB954]/25 hover:bg-[#1DB954]/25 transition-colors"
                    >
                      <ExternalLink size={10} />
                      {t('profile.deck.connectCta')}
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {/* Linha de contato */}
          <section className="px-4 pt-5 pb-2">
            <SectionHeader index="02" title={t('profile.contact.title')} Icon={Phone} />
            <div className="rounded-card border border-border bg-surface-raised p-3">
              {profile.character.phoneNumber ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-mono-ui text-sm text-white">{profile.character.phoneNumber}</span>
                  <span className="inline-flex items-center gap-1.5 text-protocol text-[8px] text-primary">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" /> {tCommon('active')}
                  </span>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <p className="text-[10px] text-industrial-silver/50 leading-relaxed font-sans">
                    {t('profile.contact.needUs')}
                  </p>
                  <button
                    type="button"
                    onClick={handleGeneratePhone}
                    className="w-full py-2.5 rounded-control bg-accent text-black text-protocol hover:bg-primary-container active:scale-[0.98] transition glow-orange-subtle"
                  >
                    {t('profile.contact.generate')}
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* Galeria */}
          <section className="px-4 pt-5 pb-2">
            <SectionHeader index="03" title={t('profile.gallery.title')} Icon={Image} />
            <PlayerGallery images={galleryImages} />
          </section>

          {/* Conquistas */}
          <section className="px-4 pt-5 pb-6">
            <SectionHeader
              index="04"
              title={t('profile.achievements.title')}
              Icon={Trophy}
              action={<span className="text-mono-ui text-[10px] text-industrial-silver/40">{profile.achievementIds.length}/{achievements.length}</span>}
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
