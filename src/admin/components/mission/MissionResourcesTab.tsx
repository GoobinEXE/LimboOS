import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Campaign } from '../../../data/campaigns';
import { ACHIEVEMENT_TIER_LABELS } from '../../../services/AchievementManager';
import type { CampaignScopedArea, MissionSectionId } from '../../lib/adminNavigation';
import {
  campaignReadiness,
  readinessScore,
  type CampaignResourceSummary,
  type ReadinessCheck,
  type ReadinessState,
} from '../../lib/campaignResources';
import { INTEL_TYPE_OPTIONS, accessLevelLabel } from '../../lib/intelDisplay';

interface MissionResourcesTabProps {
  campaign: Partial<Campaign>;
  summary: CampaignResourceSummary;
  onGoToTab: (section: MissionSectionId) => void;
  /** `create`: abre o editor sobre a página; sem ele, empilha o catálogo filtrado. */
  onOpenScoped: (area: CampaignScopedArea, create?: boolean) => void;
  onWriteDialogue: () => void;
}

const LIST_LIMIT = 6;

const STATE_STYLE: Record<ReadinessState, { icon: string; tone: string; bar: string }> = {
  ok: { icon: 'check_circle', tone: 'text-phosphor-400', bar: 'bg-phosphor-500' },
  partial: { icon: 'adjust', tone: 'text-amber-400', bar: 'bg-amber-500/80' },
  missing: { icon: 'radio_button_unchecked', tone: 'text-ash-500', bar: 'bg-ash-800' },
  na: { icon: 'remove', tone: 'text-ash-700', bar: 'bg-transparent border border-border-subtle' },
};

/**
 * Aba "Recursos" da missão: o que já existe para esta campanha em cada
 * catálogo modular (intel, conquistas, NPCs) e o que falta para jogá-la.
 * Criar abre o editor sobre a página; "Ver no catálogo" leva ao catálogo
 * filtrado pela missão, e o Voltar retorna para cá.
 */
export default function MissionResourcesTab({
  campaign,
  summary,
  onGoToTab,
  onOpenScoped,
  onWriteDialogue,
}: MissionResourcesTabProps) {
  const { t } = useTranslation('admin');
  const checks = campaignReadiness(campaign, summary);
  const { done, total } = readinessScore(checks);
  const usesSms = campaign.playerType === 'nokia';

  const detail = (check: ReadinessCheck): string => {
    const k = `missions.resources.check.${check.id}`;
    switch (check.id) {
      case 'intel':
        return check.state === 'ok'
          ? t(`${k}.ok`, { count: summary.intel.length })
          : check.state === 'partial'
            ? t(`${k}.partial`, { count: summary.globalIntelCount })
            : t(`${k}.missing`);
      case 'achievements':
        return check.state === 'ok'
          ? t(`${k}.ok`, { count: summary.achievements.length })
          : check.state === 'partial'
            ? t(`${k}.partial`, { count: summary.globalAchievementCount })
            : t(`${k}.missing`);
      case 'npcs':
        if (check.state === 'na') return t(`${k}.na`);
        if (check.state === 'ok') {
          return t(`${k}.ok`, { npcs: summary.npcs.length, dialogues: summary.dialogues.length });
        }
        if (summary.npcs.length > 0) return t(`${k}.noDialogues`, { count: summary.npcs.length });
        return check.state === 'partial'
          ? t(`${k}.partial`, { count: summary.globalNpcCount })
          : t(`${k}.missing`);
      case 'squads':
        return check.state === 'ok'
          ? t(`${k}.ok`, {
              count: new Set([...summary.authorizedGroups, ...summary.operatingGroups].map((g) => g.id))
                .size,
            })
          : t(`${k}.missing`);
      default:
        return t(`${k}.${check.state}`);
    }
  };

  const action = (check: ReadinessCheck): { label: string; run: () => void } | null => {
    if (check.state === 'ok' || check.state === 'na') return null;
    switch (check.id) {
      case 'briefing':
      case 'cover':
        return { label: t('missions.resources.action.editData'), run: () => onGoToTab('dados') };
      case 'intel':
        return { label: t('missions.resources.action.createIntel'), run: () => onOpenScoped('intel', true) };
      case 'achievements':
        return {
          label: t('missions.resources.action.createAchievement'),
          run: () => onOpenScoped('achievements', true),
        };
      case 'npcs':
        return summary.npcs.length > 0
          ? { label: t('missions.resources.action.writeDialogue'), run: onWriteDialogue }
          : { label: t('missions.resources.action.createNpc'), run: () => onOpenScoped('sms', true) };
      case 'squads':
        return { label: t('missions.resources.action.openAccess'), run: () => onGoToTab('vinculos') };
      default:
        return null;
    }
  };

  return (
    <div className="space-y-8">
      <section aria-labelledby="mission-readiness-title" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h4
              id="mission-readiness-title"
              className="font-display font-bold uppercase tracking-[0.18em] text-sm text-bone"
            >
              {t('missions.resources.readinessTitle')}
            </h4>
            <p className="text-[12px] text-ash-400 mt-1">{t('missions.resources.readinessLead')}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[12px] text-ash-300 tabular-nums">
              {t('missions.resources.readinessScore', { done, total })}
            </span>
            <span className="flex gap-0.5" aria-hidden>
              {checks.map((c) => (
                <span key={c.id} className={`h-2 w-4 rounded-[1px] ${STATE_STYLE[c.state].bar}`} />
              ))}
            </span>
          </div>
        </div>

        <ul className="border border-seam rounded-inset divide-y divide-border-subtle bg-surface-container-lowest">
          {checks.map((check) => {
            const style = STATE_STYLE[check.state];
            const act = action(check);
            return (
              <li
                key={check.id}
                className="grid grid-cols-[1.25rem_minmax(0,8rem)_minmax(0,1fr)_auto] items-center gap-x-3 px-4 min-h-12 py-2"
              >
                <span className={`material-symbols-outlined text-[18px] ${style.tone}`} aria-hidden>
                  {style.icon}
                </span>
                <span
                  className={`font-display font-bold uppercase tracking-[0.14em] text-[11px] ${
                    check.state === 'na' ? 'text-ash-600' : 'text-bone'
                  }`}
                >
                  {t(`missions.resources.check.${check.id}.label`)}
                </span>
                <span
                  className={`text-[12px] truncate ${
                    check.state === 'partial' ? 'text-amber-300/90' : 'text-ash-400'
                  }`}
                >
                  <span className="sr-only">{t(`missions.resources.state.${check.state}`)}: </span>
                  {detail(check)}
                </span>
                {act ? (
                  <button type="button" onClick={act.run} className="lmb-btn h-8 min-h-8">
                    {act.label}
                  </button>
                ) : (
                  <span />
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="mission-kit-title" className="space-y-4">
        <h4
          id="mission-kit-title"
          className="font-display font-bold uppercase tracking-[0.18em] text-sm text-bone"
        >
          {t('missions.resources.kitTitle')}
        </h4>

        <div className="grid grid-cols-1 lg:grid-cols-3 border border-seam rounded-inset bg-surface-container-lowest divide-y lg:divide-y-0 lg:divide-x divide-border-subtle">
          <ResourceColumn
            icon="hub"
            title={t('missions.resources.section.intel')}
            count={summary.intel.length}
            globalCount={summary.globalIntelCount}
            emptyText={t('missions.resources.empty.intel')}
            onView={() => onOpenScoped('intel')}
            onCreate={() => onOpenScoped('intel', true)}
            createLabel={t('missions.resources.action.createIntel')}
          >
            {summary.intel.slice(0, LIST_LIMIT).map((item) => (
              <ResourceRow
                key={item.id}
                icon={INTEL_TYPE_OPTIONS.find((o) => o.value === item.type)?.icon || 'description'}
                title={item.title || item.id}
                meta={accessLevelLabel(item.level)}
              />
            ))}
          </ResourceColumn>

          <ResourceColumn
            icon="emoji_events"
            title={t('missions.resources.section.achievements')}
            count={summary.achievements.length}
            globalCount={summary.globalAchievementCount}
            emptyText={t('missions.resources.empty.achievements')}
            onView={() => onOpenScoped('achievements')}
            onCreate={() => onOpenScoped('achievements', true)}
            createLabel={t('missions.resources.action.createAchievement')}
          >
            {summary.achievements.slice(0, LIST_LIMIT).map((ach) => (
              <ResourceRow
                key={ach.id}
                icon="emoji_events"
                title={ach.title}
                meta={ACHIEVEMENT_TIER_LABELS[ach.tier]}
                muted={ach.enabled === false}
                mutedLabel={t('missions.resources.disabled')}
              />
            ))}
          </ResourceColumn>

          <ResourceColumn
            icon="sms"
            title={t('missions.resources.section.npcs')}
            count={summary.npcs.length}
            globalCount={summary.globalNpcCount}
            emptyText={
              usesSms ? t('missions.resources.empty.npcs') : t('missions.resources.empty.npcsWalkman')
            }
            note={usesSms ? undefined : t('missions.resources.walkmanSmsNote')}
            onView={() => onOpenScoped('sms')}
            onCreate={() => onOpenScoped('sms', true)}
            createLabel={t('missions.resources.action.createNpc')}
          >
            {summary.npcs.slice(0, LIST_LIMIT).map((npc) => {
              const dialogues = summary.dialogues.filter((d) => d.npcId === npc.id).length;
              return (
                <ResourceRow
                  key={npc.id}
                  icon="person"
                  title={npc.name}
                  meta={t('missions.resources.dialogueCount', { count: dialogues })}
                  warn={dialogues === 0}
                  muted={npc.enabled === false}
                  mutedLabel={t('missions.resources.disabled')}
                />
              );
            })}
          </ResourceColumn>
        </div>
      </section>
    </div>
  );
}

function ResourceColumn({
  icon,
  title,
  count,
  globalCount,
  emptyText,
  note,
  onView,
  onCreate,
  createLabel,
  children,
}: {
  icon: string;
  title: string;
  count: number;
  globalCount: number;
  emptyText: string;
  note?: string;
  onView: () => void;
  onCreate: () => void;
  createLabel: string;
  children: React.ReactNode;
}) {
  const { t } = useTranslation('admin');
  const overflow = count - LIST_LIMIT;

  return (
    <div className="flex flex-col min-w-0 p-4 gap-3">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-[18px] text-ash-500" aria-hidden>
          {icon}
        </span>
        <h5 className="font-display font-bold uppercase tracking-[0.16em] text-[11px] text-bone">{title}</h5>
        <span className="font-mono text-[12px] text-primary tabular-nums">{count}</span>
        <button
          type="button"
          onClick={onCreate}
          title={createLabel}
          aria-label={createLabel}
          className="lmb-btn lmb-btn-ghost lmb-btn-icon ml-auto h-8 min-h-8 w-8"
        >
          <span className="material-symbols-outlined text-[18px] tracking-normal normal-case" aria-hidden>
            add
          </span>
        </button>
      </div>

      {count === 0 ? (
        <p className="text-[12px] text-ash-500 leading-relaxed">{emptyText}</p>
      ) : (
        <ul className="space-y-1">
          {children}
          {overflow > 0 && (
            <li className="text-[11px] text-ash-500 pl-7">{t('missions.resources.more', { count: overflow })}</li>
          )}
        </ul>
      )}

      {note && count > 0 && <p className="text-[11px] text-amber-300/80 leading-relaxed">{note}</p>}

      <div className="mt-auto pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle">
        <span className="text-[11px] text-ash-500">
          {globalCount > 0 ? t('missions.resources.globalsNote', { count: globalCount }) : ' '}
        </span>
        <button
          type="button"
          onClick={onView}
          className="inline-flex items-center gap-1 text-[11px] font-display font-bold uppercase tracking-[0.14em] text-ash-400 hover:text-primary transition-colors"
        >
          {t('missions.resources.action.viewCatalog')}
          <span className="material-symbols-outlined text-sm" aria-hidden>
            arrow_forward
          </span>
        </button>
      </div>
    </div>
  );
}

function ResourceRow({
  icon,
  title,
  meta,
  muted,
  mutedLabel,
  warn,
}: {
  icon: string;
  title: string;
  meta: string;
  muted?: boolean;
  mutedLabel?: string;
  warn?: boolean;
}) {
  return (
    <li className={`flex items-center gap-2 min-h-7 ${muted ? 'opacity-50' : ''}`}>
      <span className="material-symbols-outlined text-base text-ash-600 w-5 shrink-0" aria-hidden>
        {icon}
      </span>
      <span className="text-[12px] text-ash-200 truncate flex-1 min-w-0">{title}</span>
      {muted && mutedLabel && (
        <span className="text-[10px] uppercase tracking-[0.12em] text-ash-500 shrink-0">{mutedLabel}</span>
      )}
      <span
        className={`text-[10px] font-mono uppercase shrink-0 ${warn ? 'text-amber-300/90' : 'text-ash-500'}`}
      >
        {meta}
      </span>
    </li>
  );
}
