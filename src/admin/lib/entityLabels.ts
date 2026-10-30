import type { MasterAccount } from '../../types/player';
import type { Campaign } from '../../data/campaigns';
import { campaigns as localCampaigns } from '../../data/campaigns';
import { intelRegistry } from '../../data/intel_registry';
import { achievementManager } from '../../services/AchievementManager';
import i18n from '../../i18n';

type AccountLike = Partial<Pick<MasterAccount, 'masterName' | 'email' | 'displayName'>> | null | undefined;

function entityT(key: string): string {
  return i18n.t(key, { ns: 'admin' });
}

export function masterAccountLabel(acc: AccountLike, fallback?: string): string {
  const fb = fallback ?? entityT('entity.unknown');
  if (!acc) return fb;
  return acc.masterName?.trim() || acc.email?.trim() || acc.displayName?.trim() || fb;
}

export function masterAccountLabelByUid(
  uid: string,
  users: MasterAccount[],
  fallback?: string,
): string {
  const user = users.find((u) => u.uid === uid);
  return masterAccountLabel(user, fallback);
}

export function campaignLabel(campaignId: string, campaigns: Campaign[]): string {
  const found = campaigns.find((c) => c.id === campaignId);
  if (found?.name) return found.name;
  const local = localCampaigns.find((c) => c.id === campaignId);
  return local?.name || entityT('entity.missionUnknown');
}

export interface IntelTitleSource {
  id: string;
  title?: string;
  originalName?: string;
  filename?: string;
  metadata?: { title?: string };
}

export function intelTitleLabel(
  intelId: string,
  sources?: IntelTitleSource[],
): string {
  const intel = intelRegistry.get(intelId);
  if (intel?.title) return intel.title;

  const remote = sources?.find((s) => s.id === intelId);
  if (remote?.title) return remote.title;
  if (remote?.metadata?.title) return remote.metadata.title;
  if (remote?.originalName) return remote.originalName;
  if (remote?.filename) return remote.filename;

  return entityT('entity.intelUnknown');
}

export function achievementLabel(achId: string): string {
  const baseId = achId.includes('__') ? achId.slice(0, achId.lastIndexOf('__')) : achId;
  const ach = achievementManager.getAchievement(baseId);
  return ach?.title || entityT('entity.achievementUnknown');
}

export function characterLabelByKey(
  uid: string,
  characterId: string,
  characterMap: Map<string, string>,
  fallback?: string,
): string {
  return characterMap.get(`${uid}_${characterId}`) || fallback || entityT('entity.agentUnknown');
}
