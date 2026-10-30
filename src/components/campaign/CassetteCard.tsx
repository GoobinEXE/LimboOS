import React, { memo, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, useTransform, MotionValue } from 'motion/react';
import { EASE_OUT } from '../../lib/motion';
import { Zap, ChevronRight, Lock } from 'lucide-react';
import { Campaign } from '../../data/campaigns';
import RetroSpinner from '../player/RetroSpinner';
import { useWebkitLite } from '../../lib/webkitLite';

interface CassetteCardProps {
  campaign: Campaign;
  onSelect: (campaign: Campaign) => void;
  index: number;
  dragX: MotionValue<number>;
  cardWidth: number;
  cardHeight: number;
  step: number;
  isActive: boolean;
  onSnapToSelf: () => void;
}

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=800&auto=format&fit=crop';

const pad = (n: number) => String(n).padStart(2, '0');

const Screw = ({ className }: { className: string }) => (
  <span
    aria-hidden
    className={`absolute w-1.5 h-1.5 rounded-full bg-surface-sunken shadow-[inset_0_1px_1px_#000,0_1px_0_#ffffff14] ${className}`}
  />
);

/** Bobina da fita — gira apenas no cartucho ativo. */
const Reel = ({ spinning, reverse = false }: { spinning: boolean; reverse?: boolean }) => (
  <div
    className={`relative w-8 h-8 rounded-full border-2 border-industrial-silver/25 bg-surface-panel flex items-center justify-center shrink-0 shadow-hairline animate-[spin_6s_linear_infinite] ${
      spinning ? '' : '[animation-play-state:paused]'
    } ${reverse ? '[animation-direction:reverse]' : ''}`}
  >
    {[0, 60, 120].map((deg) => (
      <span
        key={deg}
        className="absolute w-0.5 h-full bg-industrial-silver/20 rounded-full"
        style={{ transform: `rotate(${deg}deg)` }}
      />
    ))}
    <span className="relative z-10 w-2.5 h-2.5 rounded-full bg-surface-sunken border border-industrial-silver/40" />
  </div>
);

const Spec = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0 flex flex-col gap-0.5">
    <span className="text-protocol text-[8px] text-primary/50">{label}</span>
    <span className="text-mono-ui text-[10px] text-white/80 line-clamp-2 break-words leading-snug">{value}</span>
  </div>
);

export const CassetteCard = memo(({ campaign, onSelect, index, dragX, cardWidth, cardHeight, step, isActive, onSnapToSelf }: CassetteCardProps) => {
  const { t } = useTranslation('player');
  const isLocked = campaign.status === 'Bloqueada';
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const webkitLite = useWebkitLite();

  const cardX = useMemo(() => index * step, [index, step]);
  const relativePosition = useTransform(dragX, (val) => val + cardX);
  const distance = useTransform(relativePosition, Math.abs);

  const scale = useTransform(distance, [0, step, step * 2], [1, 0.86, 0.76], { clamp: true });
  const opacity = useTransform(distance, [0, step, step * 2], [1, 0.55, 0.25], { clamp: true });
  const rotateY = useTransform(relativePosition, [-step * 2, -step, 0, step, step * 2], [22, 14, 0, -14, -22], { clamp: true });
  const rotateX = useTransform(distance, [0, step], [0, 4], { clamp: true });
  const rotateZ = useTransform(relativePosition, [-step, 0, step], [-1.5, 0, 1.5], { clamp: true });
  const zIndex = useTransform(distance, [0, step], [10, 0]);
  const y = useTransform(distance, [0, step, step * 2], [0, 18, 32], { clamp: true });
  const filter = useTransform(
    distance,
    [0, step, step * 2],
    ['brightness(1)', 'brightness(0.65)', 'brightness(0.45)'],
    { clamp: true }
  );

  const tapeSideLabel = campaign.playerType === 'nokia' ? t('cassette.side.handset') : t('cassette.side.deck');

  const cardStyle = webkitLite
    ? { scale, opacity, zIndex, y, width: cardWidth, height: cardHeight }
    : { scale, opacity, rotateY, rotateX, rotateZ, zIndex, y, filter, width: cardWidth, height: cardHeight };

  return (
    <motion.div
      style={cardStyle}
      className="relative shrink-0 select-none origin-center will-change-transform group"
      onClick={() => {
        if (!isActive) {
          onSnapToSelf();
        } else if (!isLocked) {
          setIsExpanded(!isExpanded);
        }
      }}
    >
      {/* Moldura do encaixe ativo: aro fino em vez de halo borrado */}
      <motion.div
        aria-hidden
        className="absolute -inset-1.5 rounded-panel pointer-events-none border border-accent-40"
        initial={false}
        animate={{ opacity: isActive && !isLocked ? 1 : 0 }}
        transition={{ duration: 0.5, ease: EASE_OUT }}
      />

      <div
        className={`relative w-full h-full flex flex-col rounded-card bg-surface-panel border shadow-panel overflow-hidden transition-colors duration-300 ${
          isActive ? 'border-border-accent' : 'border-border-strong'
        }`}
      >
        <div aria-hidden className="absolute inset-0 rounded-card shadow-hairline pointer-events-none z-20" />
        <Screw className="top-2 left-2" />
        <Screw className="top-2 right-2" />
        <Screw className="bottom-2 left-2" />
        <Screw className="bottom-2 right-2" />

        {/* Cabeçalho — identificador */}
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 shrink-0">
          <div className="min-w-0">
            <span className="text-protocol text-[8px] text-primary/60">
              {t('cassette.mission', { n: pad(index + 1), side: tapeSideLabel })}
            </span>
            <h3 className="text-display text-[21px] text-white uppercase mt-1 truncate group-hover:text-primary transition-colors duration-300">
              {campaign.name}
            </h3>
          </div>
          <div
            className={`w-9 h-9 rounded-control border flex items-center justify-center shrink-0 transition-colors duration-300 ${
              isActive && !isLocked
                ? 'border-border-accent bg-accent-10 text-primary'
                : 'border-border bg-surface-sunken text-ash-600'
            }`}
          >
            {isLocked ? <Lock size={15} /> : <Zap size={16} />}
          </div>
        </div>

        {/* Etiqueta da fita — imagem + janela das bobinas */}
        <div className="mx-5 flex-1 min-h-0 relative rounded-inset overflow-hidden border border-border bg-surface-sunken">
          {!imageLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <RetroSpinner size="sm" className="opacity-20" />
            </div>
          )}
          {campaign.imageUrl ? (
            <img
              src={campaign.imageUrl}
              alt={campaign.name}
              onLoad={() => setImageLoaded(true)}
              onError={(e) => {
                setImageLoaded(true);
                e.currentTarget.src = FALLBACK_IMAGE;
              }}
              className={`w-full h-full object-cover transition duration-700 ease-limbo ${
                imageLoaded ? (isActive ? 'opacity-95 saturate-100' : 'opacity-70 saturate-[0.7]') : 'opacity-0'
              }`}
              draggable={false}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-ash-700">
              <Zap size={48} />
            </div>
          )}

          <div aria-hidden className="absolute inset-x-0 top-0 h-0.75 bg-linear-to-r from-accent via-accent-60 to-transparent" />
          <div aria-hidden className="absolute inset-0 pointer-events-none bg-linear-to-t from-black/85 via-black/10 to-transparent" />

          {/* Janela das bobinas */}
          <div className="absolute bottom-3 inset-x-4 h-12 rounded-full bg-black/80 border border-border-strong flex items-center px-2 shadow-hairline">
            <Reel spinning={isActive && !isLocked} />
            <div className="flex-1 mx-3 h-0.75 rounded-full bg-industrial-silver/15 relative overflow-hidden">
              <div className="absolute inset-y-0 left-0 w-2/5 rounded-full bg-industrial-silver/50" />
            </div>
            <Reel spinning={isActive && !isLocked} reverse />
          </div>

          {isLocked && (
            <div className="absolute inset-0 bg-surface-overlay flex flex-col items-center justify-center gap-2 z-20">
              <div className="-rotate-6 border-2 border-red-500/60 text-red-400 text-protocol px-3 py-1.5 rounded-inset bg-red-950/40">
                {t('cassette.denied')}
              </div>
              <span className="text-mono-ui text-[9px] text-red-400/60 uppercase">{t('cassette.deniedSub')}</span>
            </div>
          )}
        </div>

        {/* Descrição */}
        <div className={`mx-5 mt-3 shrink-0 relative overflow-hidden transition-[height] duration-300 ease-limbo ${isExpanded ? 'h-24' : 'h-10'}`}>
          <p
            className={`h-full text-[10.5px] leading-relaxed text-ash-400 font-sans border-l border-border-accent pl-3 custom-scrollbar ${
              isExpanded ? 'overflow-y-auto' : 'line-clamp-2'
            }`}
          >
            {campaign.description}
          </p>
        </div>

        {/* Especificações */}
        <div className="mx-5 mt-3 grid grid-cols-3 gap-3 border-t border-border-subtle pt-3 shrink-0">
          <Spec label={t('cassette.spec.system')} value={campaign.rpgSystem} />
          <Spec label={t('cassette.spec.sector')} value={campaign.location} />
          <Spec label={t('cassette.spec.year')} value={campaign.year} />
        </div>

        {/* Ação */}
        <div className="px-5 pb-5 pt-3 mt-auto shrink-0 relative z-20">
          {!isLocked ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!isActive) onSnapToSelf();
                else onSelect(campaign);
              }}
              className={`w-full text-protocol py-3.5 rounded-control transition duration-200 flex items-center justify-center gap-2 group/btn active:scale-[0.98] ${
                isActive
                  ? 'bg-accent text-black hover:bg-primary-container'
                  : 'bg-surface-raised text-ash-400 border border-border hover:border-border-accent hover:text-primary'
              }`}
            >
              {isActive ? t('cassette.start') : t('cassette.select')}
              {isActive && <ChevronRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />}
            </button>
          ) : (
            <button
              disabled
              className="w-full text-protocol py-3.5 rounded-control bg-surface-sunken text-ash-600 border border-border-subtle cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Lock size={12} /> {t('cassette.blocked')}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
});
