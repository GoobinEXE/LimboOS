import { db } from '../lib/firebase';
import {
  doc,
  setDoc,
  serverTimestamp,
  updateDoc,
  writeBatch,
  arrayUnion,
  arrayRemove,
  deleteField,
} from 'firebase/firestore';
import type { Campaign } from '../data/campaigns';
import type { CampaignFeatures } from '../types/workspace';
import { campaignStateDoc, wsDoc } from '../lib/tenantScope';
import { activityLogger } from './ActivityLogger';

/** Referências a desfazer quando uma missão é apagada (ver `collectCampaignLinks`). */
export interface CampaignUnlinkPlan {
  /** `active`: a missão é a `campaignId` atual, além de (talvez) liberada. */
  groups: { id: string; active: boolean }[];
  characters: { uid: string; charId: string; active: boolean }[];
  achievementIds: string[];
  npcIds: string[];
}

/** Limite de operações por batch do Firestore é 500; folga para a marca de catálogo. */
const BATCH_LIMIT = 450;

export class CampaignAdminService {
  private static instance: CampaignAdminService;

  private constructor() {}

  public static getInstance(): CampaignAdminService {
    if (!CampaignAdminService.instance) {
      CampaignAdminService.instance = new CampaignAdminService();
    }
    return CampaignAdminService.instance;
  }

  public async saveCampaign(campaign: Partial<Campaign> & { id: string; name: string }): Promise<void> {
    await setDoc(
      wsDoc('campaigns', campaign.id),
      { ...campaign, updatedAt: serverTimestamp() },
      { merge: true }
    );
    activityLogger.logAdmin('mestre', 'campaign_saved', `Campanha salva: ${campaign.name}`, { campaignId: campaign.id });
  }

  /** Mini-apps ligados na missão. */
  public async setFeatures(campaignId: string, features: CampaignFeatures): Promise<void> {
    await updateDoc(wsDoc('campaigns', campaignId), { features, updatedAt: serverTimestamp() });
    activityLogger.logAdmin('mestre', 'campaign_features', `Mini-apps da missão atualizados`, { campaignId, features });
  }

  /**
   * Apaga a missão e desfaz as referências a ela: esquadrões e agentes perdem a
   * missão ativa e a liberada; conquistas e NPCs tiram o id do vínculo. Intel
   * marcada com a missão fica como está (limpar o campo a tornaria global).
   * A exclusão vai no último batch, para não sobrar missão sem limpeza.
   */
  public async deleteCampaign(id: string, unlink?: CampaignUnlinkPlan): Promise<void> {
    type Op = (batch: ReturnType<typeof writeBatch>) => void;
    const ops: Op[] = [];
    const unlinkPatch = (active: boolean) => ({
      unlockedCampaigns: arrayRemove(id),
      ...(active ? { campaignId: deleteField() } : {}),
    });
    unlink?.groups.forEach(({ id: groupId, active }) => {
      ops.push((b) => b.update(wsDoc('groups', groupId), unlinkPatch(active)));
    });
    unlink?.characters.forEach(({ uid, charId, active }) => {
      ops.push((b) => b.update(doc(db, 'users', uid, 'characters', charId), unlinkPatch(active)));
    });
    unlink?.achievementIds.forEach((defId) => {
      ops.push((b) => b.update(wsDoc('achievementDefs', defId), { campaignIds: arrayRemove(id) }));
    });
    unlink?.npcIds.forEach((npcId) => {
      ops.push((b) => b.update(wsDoc('npcContacts', npcId), { campaignIds: arrayRemove(id) }));
    });

    for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
      const batch = writeBatch(db);
      ops.slice(i, i + BATCH_LIMIT).forEach((op) => op(batch));
      await batch.commit();
    }

    const final = writeBatch(db);
    final.delete(campaignStateDoc(id, 'live'));
    final.delete(campaignStateDoc(id, 'settings'));
    final.delete(wsDoc('campaigns', id));
    await final.commit();

    activityLogger.logAdmin('mestre', 'campaign_deleted', `Campanha removida: ${id}`, {
      groupsUnlinked: unlink?.groups.length ?? 0,
      agentsUnlinked: unlink?.characters.length ?? 0,
      achievementsUnlinked: unlink?.achievementIds.length ?? 0,
      npcsUnlinked: unlink?.npcIds.length ?? 0,
    });
  }

  /** Itens persistentes entre as missões da pasta (antes: system/campaignSettings global). */
  public async setPersistentItems(itemIds: string[]): Promise<void> {
    await setDoc(
      wsDoc('config', 'settings'),
      { persistentItemIds: itemIds },
      { merge: true }
    );
  }

  public async unlockForGroup(groupId: string, campaignId: string, unlock: boolean): Promise<void> {
    await updateDoc(wsDoc('groups', groupId), {
      unlockedCampaigns: unlock ? arrayUnion(campaignId) : arrayRemove(campaignId),
    });
  }

  public async unlockForCharacter(
    uid: string,
    charId: string,
    campaignId: string,
    unlock: boolean
  ): Promise<void> {
    await updateDoc(doc(db, 'users', uid, 'characters', charId), {
      unlockedCampaigns: unlock ? arrayUnion(campaignId) : arrayRemove(campaignId),
    });
  }

  public async assignToGroup(groupId: string, campaignId: string): Promise<void> {
    await updateDoc(wsDoc('groups', groupId), { campaignId });
  }

  public async assignToCharacter(uid: string, charId: string, campaignId: string): Promise<void> {
    await updateDoc(doc(db, 'users', uid, 'characters', charId), { campaignId });
  }

  public async unassignFromGroup(groupId: string): Promise<void> {
    await updateDoc(wsDoc('groups', groupId), { campaignId: deleteField() });
  }

  public async unassignFromCharacter(uid: string, charId: string): Promise<void> {
    await updateDoc(doc(db, 'users', uid, 'characters', charId), { campaignId: deleteField() });
  }
}

export const campaignAdminService = CampaignAdminService.getInstance();
