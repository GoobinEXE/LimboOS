import {
  addDoc,
  deleteDoc,
  where,
  serverTimestamp,
  updateDoc,
  getDoc,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { storage } from '../lib/firebase';
import {
  getScopedDocs,
  requireTenantScope,
  subscribeScoped,
  wsCollection,
  wsDoc,
} from '../lib/tenantScope';
import { MediaAsset, MediaType } from '../types/media';

function uploadedMillis(a: MediaAsset): number {
  const v = a.uploadedAt as unknown as { toMillis?: () => number; getTime?: () => number } | undefined;
  if (typeof v?.toMillis === 'function') return v.toMillis();
  if (typeof v?.getTime === 'function') return v.getTime();
  return 0;
}

function toAssets(docs: QueryDocumentSnapshot<DocumentData>[]): MediaAsset[] {
  return docs
    .map((d) => ({ id: d.id, ...d.data() }) as MediaAsset)
    .sort((a, b) => uploadedMillis(b) - uploadedMillis(a));
}

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const ALLOWED_MIME_PREFIXES = ['audio/', 'image/', 'video/', 'application/pdf'] as const;

export type UploadMediaOptions = {
  folderIds?: string[];
  onProgress?: (progress: number) => void;
  /**
   * Campanha do item. Sem campanha o item fica só na biblioteca do dono;
   * co-mestre sempre grava numa campanha dele.
   */
  campaignId?: string | null;
};

class MediaService {
  private collectionName = 'mediaAssets';

  private getMediaType(mimeType: string): MediaType {
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('application/pdf')) return 'document';
    return 'other';
  }

  private assertAllowedUpload(file: File): void {
    const allowed =
      ALLOWED_MIME_PREFIXES.some((prefix) =>
        prefix.endsWith('/') ? file.type.startsWith(prefix) : file.type === prefix,
      );
    if (!allowed || this.getMediaType(file.type) === 'other') {
      throw new Error('Tipo de arquivo não permitido. Use áudio, imagem, vídeo ou PDF.');
    }
    if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
      throw new Error('Arquivo inválido ou maior que 100MB.');
    }
  }

  private sanitizeFilename(name: string): string {
    const base = name.split(/[/\\]/).pop() || 'upload';
    return base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'upload';
  }

  /**
   * Upload file and create asset record.
   * `folderIds` (opcional) grava IDs de pastas em metadata.tags.
   */
  async uploadMedia(
    file: File,
    uploadedBy: string,
    onProgressOrOptions?: ((progress: number) => void) | UploadMediaOptions,
  ): Promise<MediaAsset> {
    const options: UploadMediaOptions =
      typeof onProgressOrOptions === 'function'
        ? { onProgress: onProgressOrOptions }
        : onProgressOrOptions || {};

    this.assertAllowedUpload(file);
    const type = this.getMediaType(file.type);
    const timestamp = Date.now();
    const safeName = this.sanitizeFilename(file.name);
    const scope = requireTenantScope();
    const campaignId =
      options.campaignId
      ?? (scope.campaignIds === null ? null : scope.campaignIds[0] ?? null);
    if (scope.campaignIds !== null && (!campaignId || !scope.campaignIds.includes(campaignId))) {
      throw new Error('Escolha uma das suas campanhas para enviar a mídia.');
    }
    const base = campaignId
      ? `workspaces/${scope.wsId}/campaigns/${campaignId}/media`
      : `workspaces/${scope.wsId}/media`;
    const storagePath = `${base}/${type}/${timestamp}_${safeName}`;
    const storageRef = ref(storage, storagePath);

    return new Promise((resolve, reject) => {
      const uploadTask = uploadBytesResumable(storageRef, file, {
        contentType: file.type,
      });

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          options.onProgress?.(progress);
        },
        (error) => reject(error),
        async () => {
          try {
            const url = await getDownloadURL(uploadTask.snapshot.ref);

            const metadata: MediaAsset['metadata'] = {
              title: safeName.replace(/\.[^/.]+$/, ''),
            };

            if (type === 'audio' && typeof (file as File & { duration?: number }).duration === 'number') {
              metadata.duration = Math.round((file as File & { duration?: number }).duration!);
            }

            const folderIds = [...new Set((options.folderIds || []).filter(Boolean))];
            if (folderIds.length > 0) {
              metadata.tags = folderIds;
            }

            const assetData: Omit<MediaAsset, 'id'> & { campaignId: string | null } = {
              filename: safeName,
              originalName: file.name,
              url,
              storagePath,
              mimeType: file.type,
              size: file.size,
              type,
              uploadedAt: serverTimestamp() as any,
              uploadedBy: scope.actorName || uploadedBy,
              metadata,
              campaignId,
            };

            const docRef = await addDoc(wsCollection(this.collectionName), assetData);
            resolve({ id: docRef.id, ...assetData } as MediaAsset);
          } catch (error) {
            reject(error);
          }
        },
      );
    });
  }

  /** Mídia da pasta (co-mestre: só das campanhas dele), mais recente primeiro. */
  subscribeToMedia(callback: (assets: MediaAsset[]) => void, type?: MediaType) {
    return subscribeScoped(
      this.collectionName,
      'single',
      type ? [where('type', '==', type)] : [],
      (docs) => callback(toAssets(docs)),
      (err) => console.warn('[MediaService] subscribeToMedia error:', err),
    );
  }

  async deleteMedia(asset: MediaAsset) {
    try {
      const storageRef = ref(storage, asset.storagePath);
      await deleteObject(storageRef).catch((err) => {
        console.warn('File not found in storage, proceeding with Firestore deletion', err);
      });
      await deleteDoc(wsDoc(this.collectionName, asset.id));
    } catch (error) {
      console.error('Error deleting media asset:', error);
      throw error;
    }
  }

  /**
   * Merge parcial de metadata (não substitui o objeto inteiro).
   */
  async updateMetadata(assetId: string, metadata: Partial<MediaAsset['metadata']>) {
    const docRef = wsDoc(this.collectionName, assetId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error('Asset não encontrado.');
    const existing = (snap.data().metadata || {}) as MediaAsset['metadata'];
    const merged = { ...existing, ...metadata };
    await updateDoc(docRef, { metadata: merged });
  }

  async getAllMedia(type?: MediaType): Promise<MediaAsset[]> {
    const docs = await getScopedDocs(this.collectionName, 'single', type ? [where('type', '==', type)] : []);
    return toAssets(docs);
  }
}

export const mediaService = new MediaService();
