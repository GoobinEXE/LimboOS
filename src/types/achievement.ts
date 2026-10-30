import type { PlayerStats } from './player';
import type {
  AchievementCategory,
  AchievementTier,
  PlayerPlatform,
} from '../services/AchievementManager';

export type AchievementRuleType =
  | 'manual'
  | 'audioTapeCount'
  | 'tapeCount'
  | 'listenTime'
  | 'secretTape'
  | 'loreKeyword'
  | 'rapidScan'
  | 'mechanics'
  | 'flag'
  | 'allFlags';

export type AchievementRuleSpec =
  | { type: 'manual' }
  | { type: 'audioTapeCount'; count: number }
  | { type: 'tapeCount'; count: number }
  | { type: 'listenTime'; seconds: number }
  | { type: 'secretTape' }
  | { type: 'loreKeyword'; keyword: string }
  | { type: 'rapidScan'; count: number }
  | { type: 'mechanics'; statKey: keyof PlayerStats; target: number }
  | { type: 'flag'; statKey: keyof PlayerStats }
  | { type: 'allFlags'; statKeys: (keyof PlayerStats)[] };

export type AchievementDefSource = 'custom' | 'suggestion';

/** Definição persistida em `achievementDefs/{id}`. */
export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  hint: string;
  iconUrl: string;
  category: AchievementCategory;
  tier: AchievementTier;
  platforms: PlayerPlatform[];
  campaignIds: string[] | 'global';
  isSecret: boolean;
  unlockCondition: string;
  rule: AchievementRuleSpec;
  enabled: boolean;
  source: AchievementDefSource;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type AchievementDefInput = Omit<AchievementDef, 'createdAt' | 'updatedAt'>;
