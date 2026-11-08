/**
 * Modelo multi-tenant: cada mestre tem uma pasta em `workspaces/{wsId}`, com
 * `wsId === uid do dono`. Co-mestres e jogadores entram por convite.
 */

/** `workspaces/{wsId}` */
export interface Workspace {
  id: string;
  ownerUid: string;
  name: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

/** Papel de quem está usando o painel numa pasta. */
export type WorkspaceRole = 'owner' | 'cogm';

/** `workspaces/{wsId}/members/{uid}`: co-mestre convidado para campanhas específicas. */
export interface WorkspaceMember {
  uid: string;
  campaignIds: string[];
  displayName?: string;
  invitedBy?: string;
  joinedAt?: unknown;
}

/** `workspaces/{wsId}/players/{uid}`: roster da mesa, mantido por Cloud Functions. */
export interface WorkspacePlayer {
  uid: string;
  displayName?: string;
  masterName?: string;
  characterIds: string[];
  campaignIds: string[];
  joinedAt?: unknown;
  status?: 'active' | 'removed';
}

/**
 * `users/{uid}/memberships/{wsId}`: índice das pastas de que a conta participa,
 * escrito por Cloud Functions. A mesma conta pode ser co-mestre e jogadora na pasta.
 */
export interface WorkspaceMembership {
  wsId: string;
  workspaceName?: string;
  /** Campanhas em que a conta é co-mestre (vazio = não é co-mestre). */
  cogmCampaignIds?: string[];
  /** A conta tem agente nesta mesa. */
  isPlayer?: boolean;
  updatedAt?: unknown;
}

export type InviteKind = 'cogm' | 'player';

/** Visão de um convite devolvida por `listInvites` (o token nunca volta). */
export interface InviteSummary {
  id: string;
  kind: InviteKind;
  campaignId: string;
  squadId?: string | null;
  createdAt?: string | null;
  expiresAt?: string | null;
  maxUses: number;
  uses: number;
  revoked: boolean;
}

/** Resposta de `getInvitePreview`, exibida antes de aceitar. */
export interface InvitePreview {
  kind: InviteKind;
  workspaceName: string;
  campaignName: string;
  valid: boolean;
  reason?: 'expired' | 'revoked' | 'exhausted' | 'not-found';
}

/** Mini-apps narrativos que o mestre liga por campanha. */
export interface CampaignFeatures {
  bios: boolean;
  limbo: boolean;
  win95: boolean;
  terminal: boolean;
  mac: boolean;
  diskRepair: boolean;
}

export const DEFAULT_CAMPAIGN_FEATURES: CampaignFeatures = {
  bios: false,
  limbo: false,
  win95: false,
  terminal: false,
  mac: false,
  diskRepair: false,
};

/** `workspaces/{wsId}/campaigns/{c}/state/live`: antigo `system/limboState` + `system/gameEvents`. */
export interface CampaignLiveState {
  seized?: boolean;
  seizedBy?: string | null;
  seizedAt?: unknown;
  readThreadIds?: string[];
  diskRepairAllowed?: boolean;
}

/** `workspaces/{wsId}/campaigns/{c}/state/settings`: antigo `system/campaignSettings`. */
export interface CampaignSettingsState {
  persistentItemIds?: string[];
}
