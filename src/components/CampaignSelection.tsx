import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion, useMotionValue, useSpring, animate } from 'motion/react';
import { Menu, ChevronLeft, ChevronRight } from 'lucide-react';
import { Campaign } from '../data/campaigns';
import { campaignService } from '../services/CampaignService';
import { groupService } from '../services/GroupService';
import type { PlayerData, Group } from '../types/player';

import { Barcode, AnalogLogo } from './campaign/Common';
import { CassetteCard } from './campaign/CassetteCard';
const SecurityMenu = React.lazy(() => import('./campaign/SecurityMenu').then(m => ({ default: m.SecurityMenu })));
const MetadataOverlay = React.lazy(() => import('./campaign/MetadataOverlay').then(m => ({ default: m.MetadataOverlay })));
import { TapeProgress } from './campaign/TapeProgress';
import { getMetrics, SNAP_SPRING } from './campaign/constants';
import RetroLoading from './player/RetroLoading';
import { useWebkitLite } from '../lib/webkitLite';

interface CampaignSelectionProps {
  onSelect: (campaign: Campaign) => void;
  onLogout?: () => void;
  onShowProfile?: () => void;
  onChangeCharacter?: () => void;
  /** Volta ao player quando o agente já tem campanha (ex.: troca de missão pelo perfil). */
  onBack?: () => void;
  playerData?: PlayerData | null;
}

export default function CampaignSelection({ 
  onSelect, 
  onLogout, 
  onShowProfile, 
  onChangeCharacter,
  onBack,
  playerData 
}: CampaignSelectionProps) {
  const { t } = useTranslation('player');
  const canGoBack = Boolean(onBack && playerData?.character.campaignId);
  const webkitLite = useWebkitLite();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [overlays, setOverlays] = useState({ menu: false, metadata: false });
  const [containerSize, setContainerSize] = useState({ width: 460, height: 0 });
  // Mede só a área do carrossel (sem o navegador de fitas) para o cartucho nunca cobrir o controle.
  const mainRef = useRef<HTMLDivElement>(null);

  const metrics = useMemo(() => getMetrics(containerSize.width, containerSize.height), [containerSize]);
  const x = useMotionValue(0);
  const springX = useSpring(x, SNAP_SPRING);

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const update = () => el.clientWidth > 0 && setContainerSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!playerData) return;

    let activeCampaigns: Campaign[] = [];
    let characterGroups: Group[] = [];

    const updateVisibleCampaigns = () => {
      // 1. Collect all unlocked IDs (including active/assigned campaigns)
      const unlockedIds = new Set<string>([
        ...(playerData.character.unlockedCampaigns || []),
        ...(playerData.character.campaignId ? [playerData.character.campaignId] : []),
        ...characterGroups.flatMap(g => [
          ...(g.unlockedCampaigns || []),
          ...(g.campaignId ? [g.campaignId] : [])
        ])
      ]);

      // 2. Filter active campaigns
      const visible = playerData.role === 'admin'
        ? activeCampaigns
        : activeCampaigns.filter(c => unlockedIds.has(c.id));

      setCampaigns(visible);
      setLoading(false);
    };

    // Listen to groups
    const unsubGroups = groupService.subscribeToGroupsForCharacter(
      playerData.activeCharacterId,
      (groups) => {
        characterGroups = groups;
        updateVisibleCampaigns();
      },
      playerData.uid
    );

    // Listen to active campaigns
    const unsubCampaigns = campaignService.subscribeToActiveCampaigns(
      (list) => {
        activeCampaigns = list;
        updateVisibleCampaigns();
      }
    );

    return () => {
      unsubGroups();
      unsubCampaigns();
    };
  }, [playerData]);

  // Ensure `x` stays perfectly aligned if the container is resized (e.g. mobile URL bar hiding)
  const prevStepRef = useRef(metrics.step);
  useEffect(() => {
    if (prevStepRef.current !== metrics.step) {
      x.jump(-currentIndex * metrics.step);
      prevStepRef.current = metrics.step;
    }
  }, [metrics.step, currentIndex, x]);

  const snapTo = useCallback((index: number) => {
    if (!campaigns.length) return;
    const clamped = Math.max(0, Math.min(campaigns.length - 1, index));
    animate(x, -clamped * metrics.step, SNAP_SPRING);
    setCurrentIndex(clamped);
  }, [x, campaigns.length, metrics.step]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (overlays.menu || overlays.metadata) return;
      if (e.key === 'Escape' && canGoBack) {
        onBack?.();
        return;
      }
      if (e.key === 'ArrowLeft') snapTo(currentIndex - 1);
      else if (e.key === 'ArrowRight') snapTo(currentIndex + 1);
      else if ((e.key === 'Enter' || e.key === ' ') && campaigns[currentIndex]?.status !== 'Bloqueada') onSelect(campaigns[currentIndex]);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [currentIndex, campaigns, overlays, snapTo, onSelect, canGoBack, onBack]);

  if (loading) return <RetroLoading message={t('campaign.loading')} subMessage={t('campaign.loadingSub')} />;

  const iconButtonClass =
    'w-10 h-10 sm:w-11 sm:h-11 rounded-control border border-border bg-surface-panel text-primary flex items-center justify-center hover:border-border-accent hover:bg-accent-10 active:scale-[0.97] transition duration-200 shrink-0';

  return (
    <div className="w-full h-full flex flex-col relative overflow-hidden bg-surface">
      <div className="noise-overlay" />
      <div className="scanlines" />

      <header className="flex justify-between items-center min-h-16 sm:min-h-20 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 sm:py-0 px-4 sm:px-8 relative z-30 border-b border-border bg-surface-raised/95">
        <div className="flex items-center gap-3 sm:gap-5 min-w-0">
          {canGoBack ? (
            <button type="button" onClick={onBack} className={iconButtonClass} aria-label={t('campaign.backAria')}>
              <ChevronLeft size={22} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setOverlays(v => ({ ...v, menu: true }))}
              className={iconButtonClass}
              aria-label={t('campaign.menuAria')}
            >
              <Menu size={22} />
            </button>
          )}
          <div className="min-w-0">
            <p className="text-protocol text-[8px] sm:text-[9px] text-primary/60 truncate">
              {canGoBack ? t('campaign.eyebrow.back') : t('campaign.eyebrow.default')}
            </p>
            <h1 className="text-display text-lg sm:text-2xl text-bone uppercase truncate mt-0.5">
              {t('campaign.title')} <span className="text-primary">{t('campaign.titleAccent')}</span>
            </h1>
          </div>
          {canGoBack && (
            <button
              type="button"
              onClick={() => setOverlays(v => ({ ...v, menu: true }))}
              className={iconButtonClass}
              aria-label={t('campaign.menuAria')}
            >
              <Menu size={20} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-4 shrink-0 ml-2">
          <div className="hidden sm:flex flex-col items-end text-mono-ui text-[10px] text-ash-500 leading-tight">
            <span>{t('campaign.node')}</span>
            <span className="text-primary/70 flex items-center gap-1.5">
              <span className="lmb-led text-accent animate-led w-1 h-1" aria-hidden /> {t('campaign.linkActive')}
            </span>
          </div>
          <Barcode onClick={() => setOverlays(v => ({ ...v, metadata: true }))} className="text-primary opacity-50 hover:opacity-100 transition-opacity cursor-pointer shrink-0" />
        </div>
      </header>

      <main className="flex-1 relative flex flex-col min-h-0 overflow-hidden">
        <div ref={mainRef} className="flex-1 relative cursor-grab active:cursor-grabbing select-none touch-none overflow-hidden">
          {/* Palco: luz central + trilho onde o cartucho "repousa" */}
          <div aria-hidden className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_50%_at_50%_45%,var(--color-accent-05),transparent_70%)]" />
            <div className={`absolute left-1/2 bottom-3 -translate-x-1/2 w-[55%] h-8 rounded-full bg-black/70 ${webkitLite ? '' : 'blur-xl'}`} />
            <div className="absolute inset-x-6 sm:inset-x-12 bottom-4 h-px bg-linear-to-r from-transparent via-border-strong to-transparent" />
            <div className="absolute inset-x-16 sm:inset-x-24 bottom-4 h-px bg-linear-to-r from-transparent via-accent-40 to-transparent opacity-60" />
          </div>

          <motion.div 
            drag="x" 
            dragConstraints={{ left: -(campaigns.length - 1) * metrics.step, right: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, info) => {
              const projectedX = x.get() + info.velocity.x * 0.2;
              snapTo(Math.round(-projectedX / metrics.step));
            }}
            style={{ x }} 
            className="absolute inset-0 will-change-transform touch-none"
          >
            {campaigns.map((c, i) => (
              <div 
                key={c.id} 
                className="absolute top-1/2 left-1/2" 
                style={{ 
                  transform: `translate(calc(-50% + ${i * metrics.step}px), -50%)`,
                  ...(webkitLite ? {} : { perspective: '1200px' }),
                }}
              >
                <CassetteCard campaign={c} onSelect={onSelect} index={i} dragX={x} cardWidth={metrics.cardWidth} cardHeight={metrics.cardHeight} step={metrics.step} isActive={currentIndex === i} onSnapToSelf={() => snapTo(i)} />
              </div>
            ))}
          </motion.div>

          {currentIndex > 0 && (
            <button
              type="button"
              onClick={() => snapTo(currentIndex - 1)}
              aria-label={t('campaign.prevTape')}
              className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-surface-panel/80 border border-border text-primary hover:border-border-accent hover:bg-accent-10 active:scale-[0.97] transition duration-200 flex items-center justify-center shadow-panel"
            >
              <ChevronLeft size={22} />
            </button>
          )}
          {currentIndex < campaigns.length - 1 && (
            <button
              type="button"
              onClick={() => snapTo(currentIndex + 1)}
              aria-label={t('campaign.nextTape')}
              className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-surface-panel/80 border border-border text-primary hover:border-border-accent hover:bg-accent-10 active:scale-[0.97] transition duration-200 flex items-center justify-center shadow-panel"
            >
              <ChevronRight size={22} />
            </button>
          )}
        </div>

        <div className="shrink-0 flex justify-center pt-3 pb-4 z-20 relative">
          {campaigns.length > 0 ? (
            <TapeProgress total={campaigns.length} current={currentIndex} onChange={snapTo} />
          ) : (
            <span className="text-protocol text-ash-600">{t('campaign.noTapes')}</span>
          )}
        </div>
      </main>

      <footer className="px-4 sm:px-8 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex justify-between items-center bg-surface-raised/80 border-t border-border-subtle relative z-30">
        <div className="flex items-center gap-2 sm:gap-3 text-protocol text-[8px] sm:text-[10px] text-ash-400 truncate">
          <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-primary rounded-full animate-pulse glow-orange-subtle shrink-0" />
          {t('campaign.signal')}
        </div>
        <div className="text-mono-ui text-[8px] sm:text-[10px] text-ash-600 shrink-0 ml-2">
          {t('campaign.footerSys')}
        </div>
      </footer>

      <AnimatePresence>
        {overlays.menu && (
          <React.Suspense fallback={null}>
            <SecurityMenu 
              onClose={() => setOverlays(v => ({ ...v, menu: false }))} 
              onLogout={() => { setOverlays(v => ({ ...v, menu: false })); onLogout?.(); }} 
              onShowProfile={() => { setOverlays(v => ({ ...v, menu: false })); onShowProfile?.(); }}
              onChangeCharacter={() => { setOverlays(v => ({ ...v, menu: false })); onChangeCharacter?.(); }}
            />
          </React.Suspense>
        )}
        {overlays.metadata && (
          <React.Suspense fallback={null}>
            <MetadataOverlay onClose={() => setOverlays(v => ({ ...v, metadata: false }))} agent={playerData ? { uid: playerData.uid, characterId: playerData.activeCharacterId, username: playerData.character.codinome, agentId: playerData.character.agentId, agentStatus: playerData.character.agentStatus, dangerLevel: playerData.character.dangerLevel, lastCampaignName: campaigns.find(c => c.id === playerData.character.campaignId)?.name || playerData.character.campaignId } : null} />
          </React.Suspense>
        )}
      </AnimatePresence>
    </div>
  );
}
