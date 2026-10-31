import type { Campaign } from '../../data/campaigns';
import type { IntelItem } from '../../types/intel';
import type { AchievementDef } from '../../types/achievement';
import type { NpcContact, NpcDialogue } from '../../types/npcSms';
import type { Group } from '../../types/player';
import { isLocalIntel } from './intelDisplay';

/**
 * Escopo de campanha usado pelos filtros dos catálogos admin:
 * `all` mostra tudo, `global` só o que vale para qualquer missão,
 * e qualquer outro valor é o id de uma campanha (apenas vínculos explícitos).
 */
export type CampaignScope = 'all' | 'global' | (string & {});

type CampaignBinding = string[] | 'global';

/** Lista vazia não é global: o AchievementManager trata `[]` como "nenhuma missão". */
export function isGlobalBinding(campaignIds: CampaignBinding): boolean {
  return campaignIds === 'global';
}

export function bindingIncludes(campaignIds: CampaignBinding, campaignId: string): boolean {
  return campaignIds !== 'global' && campaignIds.includes(campaignId);
}

export function matchesBindingScope(campaignIds: CampaignBinding, scope: CampaignScope): boolean {
  if (scope === 'all') return true;
  if (scope === 'global') return isGlobalBinding(campaignIds);
  return bindingIncludes(campaignIds, scope);
}

export function matchesIntelScope(item: IntelItem, scope: CampaignScope): boolean {
  if (scope === 'all') return true;
  if (scope === 'global') return !item.campaignId;
  return item.campaignId === scope;
}

/** Nomes legíveis para um vínculo de campanha (ids desconhecidos aparecem como estão). */
export function bindingLabels(campaignIds: CampaignBinding, campaigns: Campaign[]): string[] {
  if (isGlobalBinding(campaignIds)) return [];
  return (campaignIds as string[]).map(
    (id) => campaigns.find((c) => c.id === id)?.name || id,
  );
}

export interface CampaignResourceSummary {
  intel: IntelItem[];
  /** Intel sem campanha (vale em qualquer missão), sem contar a lore fixa do código. */
  globalIntelCount: number;
  achievements: AchievementDef[];
  globalAchievementCount: number;
  npcs: NpcContact[];
  globalNpcCount: number;
  /** Diálogos dos NPCs vinculados a esta missão. */
  dialogues: NpcDialogue[];
  authorizedGroups: Group[];
  operatingGroups: Group[];
}

export function summarizeCampaignResources(
  campaignId: string,
  sources: {
    intel: IntelItem[];
    achievements: AchievementDef[];
    npcs: NpcContact[];
    dialogues: NpcDialogue[];
    groups: Group[];
  },
): CampaignResourceSummary {
  const npcs = sources.npcs.filter((n) => bindingIncludes(n.campaignIds, campaignId));
  const npcIds = new Set(npcs.map((n) => n.id));
  return {
    intel: sources.intel.filter((i) => i.campaignId === campaignId),
    globalIntelCount: sources.intel.filter((i) => !i.campaignId && !isLocalIntel(i)).length,
    achievements: sources.achievements.filter((a) => bindingIncludes(a.campaignIds, campaignId)),
    globalAchievementCount: sources.achievements.filter(
      (a) => a.enabled !== false && isGlobalBinding(a.campaignIds),
    ).length,
    npcs,
    globalNpcCount: sources.npcs.filter(
      (n) => n.enabled !== false && isGlobalBinding(n.campaignIds),
    ).length,
    dialogues: sources.dialogues.filter((d) => npcIds.has(d.npcId)),
    authorizedGroups: sources.groups.filter((g) => (g.unlockedCampaigns || []).includes(campaignId)),
    operatingGroups: sources.groups.filter((g) => g.campaignId === campaignId),
  };
}

export type ReadinessState = 'ok' | 'partial' | 'missing' | 'na';

export type ReadinessCheckId =
  | 'briefing'
  | 'cover'
  | 'intel'
  | 'achievements'
  | 'npcs'
  | 'squads';

export interface ReadinessCheck {
  id: ReadinessCheckId;
  state: ReadinessState;
}

/**
 * Checklist de prontidão de uma missão. `partial` indica que a missão
 * funciona, mas só com recursos globais (nada próprio dela).
 */
export function campaignReadiness(
  campaign: Partial<Pick<Campaign, 'description' | 'imageUrl' | 'playerType'>>,
  summary: CampaignResourceSummary,
): ReadinessCheck[] {
  const usesSms = campaign.playerType === 'nokia';
  return [
    { id: 'briefing', state: campaign.description?.trim() ? 'ok' : 'missing' },
    { id: 'cover', state: campaign.imageUrl?.trim() ? 'ok' : 'missing' },
    {
      id: 'intel',
      state: summary.intel.length > 0 ? 'ok' : summary.globalIntelCount > 0 ? 'partial' : 'missing',
    },
    {
      id: 'achievements',
      state:
        summary.achievements.length > 0
          ? 'ok'
          : summary.globalAchievementCount > 0
            ? 'partial'
            : 'missing',
    },
    {
      id: 'npcs',
      state: !usesSms
        ? 'na'
        : summary.npcs.length > 0 && summary.dialogues.length > 0
          ? 'ok'
          : summary.globalNpcCount > 0
            ? 'partial'
            : 'missing',
    },
    {
      id: 'squads',
      state:
        summary.authorizedGroups.length > 0 || summary.operatingGroups.length > 0 ? 'ok' : 'missing',
    },
  ];
}

export function readinessScore(checks: ReadinessCheck[]): { done: number; total: number } {
  const relevant = checks.filter((c) => c.state !== 'na');
  return {
    done: relevant.filter((c) => c.state === 'ok').length,
    total: relevant.length,
  };
}
