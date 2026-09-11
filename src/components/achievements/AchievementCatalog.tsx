import React, { useMemo, useState } from 'react';
import { Lock } from 'lucide-react';
import { ALL_ACHIEVEMENTS } from '../../data/achievements';
import { campaigns, getCampaignById, resolveCampaignPlatform } from '../../data/campaigns';
import {
  groupAchievementsByCategory,
  ACHIEVEMENT_TIER_LABELS,
  PLATFORM_LABELS,
  filterAchievementsForScope,
  isAchievementEarned,
  type Achievement,
  type AchievementTier,
  type PlayerPlatform,
} from '../../services/AchievementManager';

function platformBorder(platform: PlayerPlatform, earned: boolean): string {
  if (!earned) return 'border-border-subtle';
  if (platform === 'nokia') return 'border-emerald-500/45';
  if (platform === 'walkman') return 'border-orange-500/45';
  return 'border-amber-400/45';
}

function tierBadge(tier: AchievementTier) {
  return (
    <span className="text-[7px] uppercase tracking-widest text-amber-500/60 font-mono shrink-0">
      {ACHIEVEMENT_TIER_LABELS[tier]}
    </span>
  );
}

function AchievementIcon({
  ach,
  earned,
  size = 'md',
}: {
  ach: Achievement;
  earned: boolean;
  size?: 'sm' | 'md';
}) {
  const dim = size === 'sm' ? 'w-7 h-7' : 'w-9 h-9';
  if (!earned) {
    return <Lock size={size === 'sm' ? 14 : 16} className="text-industrial-silver/40" />;
  }
  return (
    <img
      src={ach.icon}
      alt=""
      className={`${dim} rounded-md object-cover border border-border-subtle shrink-0`}
    />
  );
}

function AchievementCard({
  ach,
  earned,
  revealed,
  campaignLabel,
}: {
  ach: Achievement;
  earned: boolean;
  revealed: boolean;
  campaignLabel?: string;
}) {
  const title = earned || revealed ? ach.title : 'Conquista Bloqueada';
  const description = earned
    ? revealed
      ? `${ach.description} (${ach.unlockCondition})`
      : ach.description
    : revealed
      ? `Como desbloquear: ${ach.unlockCondition}`
      : 'Permaneça atento e explore mais.';

  return (
    <div
      className={`relative rounded-card p-3 border flex flex-col gap-1.5 transition-colors ${
        earned
          ? `bg-accent-05 ${platformBorder(ach.primaryPlatform, true)}`
          : `bg-surface-raised ${platformBorder(ach.primaryPlatform, false)} opacity-60`
      }`}
    >
      <div className="flex items-center justify-between gap-1">
        <AchievementIcon ach={ach} earned={earned} />
        {earned && tierBadge(ach.tier)}
      </div>
      <p
        className={`text-[11px] font-semibold leading-tight wrap-break-word min-w-0 ${
          earned ? 'text-primary' : 'text-industrial-silver/50'
        }`}
      >
        {title}
      </p>
      <p className="text-[9px] text-industrial-silver/40 leading-snug wrap-break-word min-w-0 font-sans">
        {description}
      </p>
      {earned && (
        <p className="text-[7px] uppercase tracking-widest text-industrial-silver/35 font-mono">
          {PLATFORM_LABELS[ach.primaryPlatform]}
          {campaignLabel ? ` · ${campaignLabel}` : ''}
        </p>
      )}
    </div>
  );
}

function NokiaAchievementRow({
  ach,
  earned,
  revealed,
}: {
  ach: Achievement;
  earned: boolean;
  revealed: boolean;
}) {
  const title = earned || revealed ? ach.title : 'BLOQUEADO';
  return (
    <div
      className={`p-1.5 border border-[#111e14] flex gap-2 items-center ${!earned ? 'opacity-40 border-dashed' : ''}`}
    >
      <span className="text-[11px] shrink-0 font-black">{earned ? '[X]' : '[ ]'}</span>
      {earned ? (
        <img src={ach.icon} alt="" className="w-5 h-5 object-cover rounded-sm shrink-0 border border-[#111e14]" />
      ) : (
        <span className="w-5 h-5 shrink-0 border border-dashed border-[#111e14]" />
      )}
      <div className="leading-tight truncate min-w-0">
        <div className="font-black truncate text-[9px] tracking-tighter flex items-center gap-1.5">
          <span className="truncate">{title}</span>
          {earned && (
            <span className="text-[6px] opacity-50 shrink-0 uppercase">{ACHIEVEMENT_TIER_LABELS[ach.tier]}</span>
          )}
        </div>
        {earned && (
          <div className="text-[7px] truncate opacity-60 mt-0.5 lowercase tracking-tight">{ach.description}</div>
        )}
      </div>
    </div>
  );
}

export function AchievementCatalog({
  grantDocIds,
  campaignId,
  revealed,
  variant = 'deck',
  unlockedCampaignIds,
}: {
  grantDocIds: string[];
  campaignId?: string;
  revealed?: boolean;
  variant?: 'deck' | 'nokia' | 'dossier';
  /** Campanhas que o personagem já tocou (para seletor). */
  unlockedCampaignIds?: string[];
}) {
  const selectableCampaigns = useMemo(() => {
    const ids = new Set<string>([
      ...(campaignId ? [campaignId] : []),
      ...(unlockedCampaignIds || []),
      'last-rewind',
    ]);
    return campaigns.filter((c) => ids.has(c.id) && c.status !== 'Bloqueada');
  }, [campaignId, unlockedCampaignIds]);

  const [selectedCampaignId, setSelectedCampaignId] = useState(
    campaignId || selectableCampaigns[0]?.id || 'last-rewind'
  );

  const activeCampaignId = selectedCampaignId || campaignId || 'unscoped';
  const platform = resolveCampaignPlatform(activeCampaignId);
  const campaign = getCampaignById(activeCampaignId);

  const scoped = useMemo(
    () => filterAchievementsForScope(ALL_ACHIEVEMENTS, activeCampaignId, platform),
    [activeCampaignId, platform]
  );

  const groups = groupAchievementsByCategory(scoped);
  const earnedCount = scoped.filter((a) =>
    isAchievementEarned(grantDocIds, a.id, activeCampaignId)
  ).length;
  const rareEarned = scoped.filter(
    (a) =>
      isAchievementEarned(grantDocIds, a.id, activeCampaignId) &&
      (a.tier === 'rare' || a.tier === 'legendary')
  ).length;

  const platformChrome =
    platform === 'nokia'
      ? 'text-emerald-400/70'
      : platform === 'walkman'
        ? 'text-orange-400/70'
        : 'text-amber-400/70';

  return (
    <div className="space-y-4">
      {selectableCampaigns.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {selectableCampaigns.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedCampaignId(c.id)}
              className={`text-[8px] uppercase tracking-widest px-2 py-1 border rounded-sm transition-colors ${
                activeCampaignId === c.id
                  ? 'border-accent text-accent bg-accent-05'
                  : 'border-border-subtle text-industrial-silver/50 hover:text-industrial-silver'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 px-0.5">
        <span className={`text-protocol text-[8px] uppercase tracking-[0.2em] ${platformChrome}`}>
          {PLATFORM_LABELS[platform === 'nokia' ? 'nokia' : platform === 'walkman' ? 'walkman' : 'global']}
          {campaign ? ` · ${campaign.year}` : ''}
        </span>
        <span className="text-mono-ui text-[9px] text-industrial-silver/35">
          {earnedCount}/{scoped.length}
          {variant === 'deck' ? ` · raras ${rareEarned}` : ''}
        </span>
      </div>

      {variant === 'nokia' ? (
        <div className="space-y-3">
          {groups.map((group) => (
            <div key={group.category} className="space-y-1">
              <div className="text-[7px] font-black uppercase tracking-[0.2em] opacity-50 border-b border-[#111e14] pb-0.5">
                {group.label}
              </div>
              {group.items.map((ach) => (
                <NokiaAchievementRow
                  key={ach.id}
                  ach={ach}
                  earned={isAchievementEarned(grantDocIds, ach.id, activeCampaignId)}
                  revealed={!!revealed}
                />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <div key={group.category} className="space-y-2">
              <div className="flex items-center gap-2 px-0.5">
                <span className="text-protocol text-[8px] text-industrial-silver/45 uppercase tracking-[0.2em]">
                  {group.label}
                </span>
                <span aria-hidden className="flex-1 h-px bg-border-subtle" />
                <span className="text-mono-ui text-[9px] text-industrial-silver/30">
                  {group.items.filter((a) => isAchievementEarned(grantDocIds, a.id, activeCampaignId)).length}/
                  {group.items.length}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {group.items.map((ach) => (
                  <AchievementCard
                    key={ach.id}
                    ach={ach}
                    earned={isAchievementEarned(grantDocIds, ach.id, activeCampaignId)}
                    revealed={!!revealed}
                    campaignLabel={campaign?.name}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
