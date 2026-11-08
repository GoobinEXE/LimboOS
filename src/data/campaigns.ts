import type { CampaignFeatures } from '../types/workspace';

export type PlayerDeviceType = 'walkman' | 'nokia';

export interface Campaign {
  id: string;
  name: string;
  description: string;
  location: string;
  year: string;
  rpgSystem: string;
  status: 'Ativa' | 'Arquivada' | 'Bloqueada';
  imageUrl: string;
  playerType?: PlayerDeviceType;
  /** Mini-apps narrativos ligados nesta campanha (ausente = todos desligados). */
  features?: Partial<CampaignFeatures>;
}

/**
 * Campanhas carregadas da pasta ativa (preenchido pelo CampaignService). Serve
 * para resoluções síncronas por id, como a plataforma (walkman/nokia) da missão.
 */
const registry = new Map<string, Campaign>();

export function registerCampaigns(list: Campaign[]): void {
  list.forEach((c) => registry.set(c.id, c));
}

export function listRegisteredCampaigns(): Campaign[] {
  return Array.from(registry.values());
}

export function clearCampaignRegistry(): void {
  registry.clear();
}

export function getCampaignById(id: string | undefined): Campaign | undefined {
  if (!id) return undefined;
  return registry.get(id);
}

export function resolveCampaignPlatform(campaignId: string | undefined): 'walkman' | 'nokia' {
  const c = getCampaignById(campaignId);
  return c?.playerType === 'nokia' ? 'nokia' : 'walkman';
}
