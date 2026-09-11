import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  getDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { MediaFolder } from '../types/media';
import { mediaService } from './MediaService';

type CampaignLike = { id: string; name: string };

class MediaFolderService {
  private collectionName = 'mediaFolders';

  subscribeFolders(callback: (folders: MediaFolder[]) => void): () => void {
    return onSnapshot(
      collection(db, this.collectionName),
      (snapshot) => {
        const folders = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as MediaFolder[];
        folders.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
        callback(folders);
      },
      (err) => console.warn('[MediaFolderService] subscribeFolders error:', err),
    );
  }

  /**
   * Garante uma pasta por campanha; renomeia se o nome mudou;
   * pastas cujo campaignId sumiu viram extras (campaignId = null).
   */
  async ensureCampaignFolders(
    campaigns: CampaignLike[],
    existingFolders: MediaFolder[],
  ): Promise<void> {
    const campaignIds = new Set(campaigns.map((c) => c.id));
    const byCampaign = new Map<string, MediaFolder>();
    for (const f of existingFolders) {
      if (f.campaignId) byCampaign.set(f.campaignId, f);
    }

    const ops: Promise<unknown>[] = [];

    for (const campaign of campaigns) {
      const folder = byCampaign.get(campaign.id);
      if (!folder) {
        ops.push(
          addDoc(collection(db, this.collectionName), {
            name: campaign.name,
            campaignId: campaign.id,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }),
        );
      } else if (folder.name !== campaign.name) {
        ops.push(
          updateDoc(doc(db, this.collectionName, folder.id), {
            name: campaign.name,
            updatedAt: serverTimestamp(),
          }),
        );
      }
    }

    for (const folder of existingFolders) {
      if (folder.campaignId && !campaignIds.has(folder.campaignId)) {
        ops.push(
          updateDoc(doc(db, this.collectionName, folder.id), {
            campaignId: null,
            updatedAt: serverTimestamp(),
          }),
        );
      }
    }

    if (ops.length > 0) {
      await Promise.all(ops);
    }
  }

  async createFolder(name: string): Promise<string> {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Nome da pasta é obrigatório.');
    const ref = await addDoc(collection(db, this.collectionName), {
      name: trimmed,
      campaignId: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  }

  async renameFolder(folderId: string, name: string): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Nome da pasta é obrigatório.');
    await updateDoc(doc(db, this.collectionName, folderId), {
      name: trimmed,
      updatedAt: serverTimestamp(),
    });
  }

  /**
   * Só pastas extras (sem campaignId). Remove a tag dos assets e apaga a pasta.
   */
  async deleteFolder(folder: MediaFolder): Promise<void> {
    if (folder.campaignId) {
      throw new Error('Pastas de campanha não podem ser apagadas enquanto a campanha existir.');
    }

    const assets = await mediaService.getAllMedia();
    const affected = assets.filter((a) => (a.metadata?.tags || []).includes(folder.id));

    const BATCH_LIMIT = 450;
    for (let i = 0; i < affected.length; i += BATCH_LIMIT) {
      const chunk = affected.slice(i, i + BATCH_LIMIT);
      const batch = writeBatch(db);
      for (const asset of chunk) {
        const nextTags = (asset.metadata?.tags || []).filter((t) => t !== folder.id);
        batch.update(doc(db, 'mediaAssets', asset.id), {
          'metadata.tags': nextTags,
        });
      }
      await batch.commit();
    }

    await deleteDoc(doc(db, this.collectionName, folder.id));
  }

  async setAssetFolders(assetId: string, folderIds: string[]): Promise<void> {
    const unique = [...new Set(folderIds.filter(Boolean))];
    await mediaService.updateMetadata(assetId, { tags: unique });
  }

  async toggleAssetFolder(assetId: string, folderId: string): Promise<void> {
    const snap = await getDoc(doc(db, 'mediaAssets', assetId));
    if (!snap.exists()) throw new Error('Asset não encontrado.');
    const data = snap.data() as { metadata?: { tags?: string[] } };
    const current = data.metadata?.tags || [];
    const next = current.includes(folderId)
      ? current.filter((t) => t !== folderId)
      : [...current, folderId];
    await mediaService.updateMetadata(assetId, { tags: next });
  }
}

export const mediaFolderService = new MediaFolderService();
