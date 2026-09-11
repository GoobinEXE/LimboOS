import type { PlayerStats } from '../types/player';
import type { IntelItem } from '../types/intel';

export type AchievementCategory = 'progression' | 'exploration' | 'lore' | 'mechanics' | 'honor';
export type AchievementTier = 'common' | 'rare' | 'legendary';
/** Plataforma do device; `global` = qualquer device. */
export type PlayerPlatform = 'walkman' | 'nokia' | 'global';

export const ACHIEVEMENT_CATEGORY_LABELS: Record<AchievementCategory, string> = {
  progression: 'Progressão',
  exploration: 'Exploração',
  lore: 'Lore',
  mechanics: 'Mecânica',
  honor: 'Honra',
};

export const ACHIEVEMENT_TIER_LABELS: Record<AchievementTier, string> = {
  common: 'Comum',
  rare: 'Rara',
  legendary: 'Lendária',
};

export const PLATFORM_LABELS: Record<PlayerPlatform, string> = {
  walkman: 'Walkman',
  nokia: 'Nokia',
  global: 'Agência',
};

export const ACHIEVEMENT_CATEGORY_ORDER: AchievementCategory[] = [
  'progression',
  'exploration',
  'lore',
  'mechanics',
  'honor',
];

export const ACHIEVEMENT_GRANT_SEP = '__';

export function achievementGrantDocId(achievementId: string, campaignId: string): string {
  return `${achievementId}${ACHIEVEMENT_GRANT_SEP}${campaignId}`;
}

export function parseAchievementGrantId(docId: string): { achievementId: string; campaignId: string } {
  const idx = docId.lastIndexOf(ACHIEVEMENT_GRANT_SEP);
  if (idx <= 0) return { achievementId: docId, campaignId: 'legacy' };
  return {
    achievementId: docId.slice(0, idx),
    campaignId: docId.slice(idx + ACHIEVEMENT_GRANT_SEP.length),
  };
}

/** IDs base conquistados na campanha (aceita docs legados sem sufixo). */
export function earnedBaseIdsForCampaign(
  grantDocIds: string[],
  campaignId: string | undefined
): Set<string> {
  const set = new Set<string>();
  for (const docId of grantDocIds) {
    const { achievementId, campaignId: cid } = parseAchievementGrantId(docId);
    if (!campaignId || cid === campaignId || cid === 'legacy') {
      set.add(achievementId);
    }
  }
  return set;
}

export function isAchievementEarned(
  grantDocIds: string[],
  achievementId: string,
  campaignId: string | undefined
): boolean {
  if (campaignId && grantDocIds.includes(achievementGrantDocId(achievementId, campaignId))) {
    return true;
  }
  // Legado: doc id == achievementId puro
  return grantDocIds.includes(achievementId);
}

export interface EvaluationContext {
  profile: {
    unlockedIntelIds: string[];
    achievementIds: string[];
    stats: PlayerStats;
  };
  unlockedIntel: IntelItem[];
  rapidScanCount: number;
  campaignId: string;
  platform: PlayerPlatform;
}

export abstract class AchievementRule {
  abstract evaluate(context: EvaluationContext): boolean;
}

export class TapeCountRule extends AchievementRule {
  constructor(private targetCount: number) { super(); }
  evaluate(context: EvaluationContext): boolean {
    return context.profile.unlockedIntelIds.length >= this.targetCount;
  }
}

/** Conta apenas intel do tipo AUDIO (fitas reais). */
export class AudioTapeCountRule extends AchievementRule {
  constructor(private targetCount: number) { super(); }
  evaluate(context: EvaluationContext): boolean {
    const audioCount = context.unlockedIntel.filter((t) => t.type === 'AUDIO').length;
    return audioCount >= this.targetCount;
  }
}

export class ListenTimeRule extends AchievementRule {
  constructor(private targetSeconds: number) { super(); }
  evaluate(context: EvaluationContext): boolean {
    return context.profile.stats.totalListenTime >= this.targetSeconds;
  }
}

export class SecretTapeRule extends AchievementRule {
  evaluate(context: EvaluationContext): boolean {
    return context.unlockedIntel.some((t) => t.metadata?.isSecret);
  }
}

export class LoreRule extends AchievementRule {
  constructor(private keyword: string) { super(); }
  evaluate(context: EvaluationContext): boolean {
    const kw = this.keyword.toLowerCase();
    return context.unlockedIntel.some((t) =>
      (t.metadata?.artist || '').toLowerCase().includes(kw) ||
      (t.metadata?.chapter || '').toLowerCase().includes(kw) ||
      t.title.toLowerCase().includes(kw)
    );
  }
}

export class RapidScanRule extends AchievementRule {
  constructor(private targetCount: number) { super(); }
  evaluate(context: EvaluationContext): boolean {
    return context.rapidScanCount >= this.targetCount;
  }
}

export class MechanicsRule extends AchievementRule {
  constructor(
    private statKey: keyof PlayerStats,
    private targetValue: number
  ) { super(); }
  evaluate(context: EvaluationContext): boolean {
    return (context.profile.stats[this.statKey] as number) >= this.targetValue;
  }
}

/** Flag one-shot: stat >= 1. */
export class FlagRule extends AchievementRule {
  constructor(private statKey: keyof PlayerStats) { super(); }
  evaluate(context: EvaluationContext): boolean {
    return (context.profile.stats[this.statKey] as number) >= 1;
  }
}

/** Todas as flags listadas devem estar >= 1. */
export class AllFlagsRule extends AchievementRule {
  constructor(private statKeys: (keyof PlayerStats)[]) { super(); }
  evaluate(context: EvaluationContext): boolean {
    return this.statKeys.every((key) => (context.profile.stats[key] as number) >= 1);
  }
}

export class ManualRule extends AchievementRule {
  evaluate(): boolean {
    return false;
  }
}

export class Achievement {
  public id: string;
  public title: string;
  public description: string;
  public icon: string;
  public hint: string;
  public isSecret: boolean;
  public rule: AchievementRule;
  public unlockCondition: string;
  public category: AchievementCategory;
  public tier: AchievementTier;
  public platforms: PlayerPlatform[];
  public campaignIds: string[] | 'global';

  constructor(
    id: string,
    title: string,
    description: string,
    icon: string,
    hint: string,
    rule: AchievementRule,
    unlockCondition: string = 'Nenhuma condição detalhada fornecida.',
    category: AchievementCategory = 'progression',
    tier: AchievementTier = 'common',
    isSecret: boolean = true,
    platforms: PlayerPlatform[] = ['global'],
    campaignIds: string[] | 'global' = 'global'
  ) {
    this.id = id;
    this.title = title;
    this.description = description;
    this.icon = icon;
    this.hint = hint;
    this.rule = rule;
    this.unlockCondition = unlockCondition;
    this.category = category;
    this.tier = tier;
    this.isSecret = isSecret;
    this.platforms = platforms;
    this.campaignIds = campaignIds;
  }

  /** Plataforma visual primária para chrome de UI. */
  get primaryPlatform(): PlayerPlatform {
    if (this.platforms.includes('walkman')) return 'walkman';
    if (this.platforms.includes('nokia')) return 'nokia';
    return 'global';
  }

  matchesScope(campaignId: string, platform: PlayerPlatform): boolean {
    const campOk =
      this.campaignIds === 'global' ||
      this.campaignIds.includes(campaignId);
    const platOk =
      this.platforms.includes('global') ||
      this.platforms.includes(platform);
    return campOk && platOk;
  }

  canUnlock(context: EvaluationContext): boolean {
    if (!this.matchesScope(context.campaignId, context.platform)) return false;
    if (isAchievementEarned(context.profile.achievementIds, this.id, context.campaignId)) {
      return false;
    }
    return this.rule.evaluate(context);
  }
}

export function filterAchievementsForScope(
  achievements: Achievement[],
  campaignId: string | undefined,
  platform: PlayerPlatform
): Achievement[] {
  const cid = campaignId || 'unscoped';
  return achievements.filter((a) => a.matchesScope(cid, platform));
}

export function groupAchievementsByCategory(achievements: Achievement[]): {
  category: AchievementCategory;
  label: string;
  items: Achievement[];
}[] {
  return ACHIEVEMENT_CATEGORY_ORDER.map((category) => ({
    category,
    label: ACHIEVEMENT_CATEGORY_LABELS[category],
    items: achievements.filter((a) => a.category === category),
  })).filter((group) => group.items.length > 0);
}

export class AchievementManager {
  private static instance: AchievementManager;
  private achievements: Map<string, Achievement> = new Map();

  private constructor() {}

  public static getInstance(): AchievementManager {
    if (!AchievementManager.instance) {
      AchievementManager.instance = new AchievementManager();
    }
    return AchievementManager.instance;
  }

  public register(ach: Achievement) {
    this.achievements.set(ach.id, ach);
  }

  public getAchievement(id: string): Achievement | undefined {
    return this.achievements.get(id);
  }

  public getAll(): Achievement[] {
    return Array.from(this.achievements.values());
  }

  public evaluateNewAchievements(context: EvaluationContext): Achievement[] {
    const newUnlocks: Achievement[] = [];
    for (const ach of this.achievements.values()) {
      if (ach.canUnlock(context)) {
        newUnlocks.push(ach);
      }
    }
    return newUnlocks;
  }
}

export const achievementManager = AchievementManager.getInstance();
