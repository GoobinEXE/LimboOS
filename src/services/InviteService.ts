import { firebaseAnalytics } from './FirebaseAnalyticsService';
import { getDocs, onSnapshot } from 'firebase/firestore';
import { callFunction } from '../lib/functions';
import { requireTenantScope, wsCollection } from '../lib/tenantScope';
import type {
  InviteKind,
  InvitePreview,
  InviteSummary,
  WorkspaceMember,
} from '../types/workspace';

export interface CreatedInvite {
  token: string;
  inviteId: string;
  expiresAt: string;
  maxUses: number;
}

export interface AcceptedInvite {
  kind: InviteKind;
  wsId: string;
  campaignId: string;
  characterId: string | null;
}

/** Link que a pessoa convidada abre. */
export function inviteUrl(token: string): string {
  return `${window.location.origin}/convite/${encodeURIComponent(token)}`;
}

/**
 * Convites e equipe da pasta. Convites só existem no servidor (o token volta
 * uma vez, na criação); co-mestres e roster são escritos pelas Functions.
 */
class InviteService {
  private static instance: InviteService;

  public static getInstance(): InviteService {
    if (!InviteService.instance) InviteService.instance = new InviteService();
    return InviteService.instance;
  }

  async create(input: {
    kind: InviteKind;
    campaignId: string;
    squadId?: string | null;
    maxUses?: number;
    expiresInDays?: number;
  }): Promise<CreatedInvite> {
    const { wsId } = requireTenantScope();
    return callFunction<Record<string, unknown>, CreatedInvite>('createInvite', { wsId, ...input });
  }

  async list(campaignId?: string): Promise<InviteSummary[]> {
    const { wsId } = requireTenantScope();
    const res = await callFunction<Record<string, unknown>, { invites: InviteSummary[] }>('listInvites', {
      wsId,
      ...(campaignId ? { campaignId } : {}),
    });
    return res.invites || [];
  }

  async revoke(inviteId: string): Promise<void> {
    const { wsId } = requireTenantScope();
    await callFunction('revokeInvite', { wsId, inviteId });
  }

  async preview(token: string): Promise<InvitePreview> {
    return callFunction<{ token: string }, InvitePreview>('getInvitePreview', { token });
  }

  async accept(token: string, codinome?: string): Promise<AcceptedInvite> {
    const accepted = await callFunction<Record<string, unknown>, AcceptedInvite>('acceptInvite', {
      token,
      ...(codinome ? { codinome } : {}),
    });
    firebaseAnalytics.logJoinGroup(accepted.kind);
    return accepted;
  }

  /** Co-mestres da pasta (só o dono lista). */
  subscribeMembers(callback: (members: WorkspaceMember[]) => void): () => void {
    return onSnapshot(
      wsCollection('members'),
      (snap) => callback(snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as WorkspaceMember)),
      (err) => {
        console.warn('[InviteService] members listener error:', err.code || err);
        callback([]);
      },
    );
  }

  async listMembers(): Promise<WorkspaceMember[]> {
    const snap = await getDocs(wsCollection('members'));
    return snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as WorkspaceMember);
  }

  async removeCoGm(uid: string, campaignId?: string): Promise<void> {
    const { wsId } = requireTenantScope();
    await callFunction('removeCoGm', { wsId, uid, ...(campaignId ? { campaignId } : {}) });
  }
}

export const inviteService = InviteService.getInstance();
