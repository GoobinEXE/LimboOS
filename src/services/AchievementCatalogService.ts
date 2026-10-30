import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import type { AchievementDef, AchievementDefInput } from '../types/achievement';
import { achievementManager } from './AchievementManager';
import { SUGGESTED_ACHIEVEMENTS } from '../data/achievements';

const COLLECTION = 'achievementDefs';
const ICON_PREFIX = 'achievementIcons';
const MAX_ICON_BYTES = 5 * 1024 * 1024;

function normalizeDef(id: string, raw: Record<string, unknown>): AchievementDef {
  const campaignIds = raw.campaignIds;
  return {
    id,
    title: String(raw.title ?? id),
    description: String(raw.description ?? ''),
    hint: String(raw.hint ?? '???'),
    iconUrl: String(raw.iconUrl ?? `/achievements/${id}.png`),
    category: (raw.category as AchievementDef['category']) || 'progression',
    tier: (raw.tier as AchievementDef['tier']) || 'common',
    platforms: Array.isArray(raw.platforms) && raw.platforms.length
      ? (raw.platforms as AchievementDef['platforms'])
      : ['global'],
    campaignIds:
      campaignIds === 'global' || campaignIds == null
        ? 'global'
        : Array.isArray(campaignIds)
          ? (campaignIds as string[])
          : 'global',
    isSecret: raw.isSecret !== false,
    unlockCondition: String(raw.unlockCondition ?? ''),
    rule: (raw.rule as AchievementDef['rule']) || { type: 'manual' },
    enabled: raw.enabled !== false,
    source: raw.source === 'suggestion' ? 'suggestion' : 'custom',
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

function applyCatalogToManager(defs: AchievementDef[]) {
  if (defs.length === 0) {
    achievementManager.replaceCatalog(SUGGESTED_ACHIEVEMENTS);
    return;
  }
  achievementManager.replaceCatalog(defs);
}

class AchievementCatalogService {
  private static instance: AchievementCatalogService;
  private defs: AchievementDef[] = [];
  private listeners = new Set<(defs: AchievementDef[]) => void>();
  private unsubFirestore: (() => void) | null = null;
  private startCount = 0;

  private constructor() {}

  public static getInstance(): AchievementCatalogService {
    if (!AchievementCatalogService.instance) {
      AchievementCatalogService.instance = new AchievementCatalogService();
    }
    return AchievementCatalogService.instance;
  }

  /** Inicia listener Firestore (refcount). Fallback em memória se vazio. */
  start(): () => void {
    this.startCount += 1;

    if (!this.unsubFirestore) {
      if (this.defs.length === 0 && achievementManager.getAll().length === 0) {
        applyCatalogToManager([]);
      }

      this.unsubFirestore = onSnapshot(
        collection(db, COLLECTION),
        (snap) => {
          const next = snap.docs.map((d) =>
            normalizeDef(d.id, d.data() as Record<string, unknown>),
          );
          this.defs = next;
          applyCatalogToManager(next);
          this.notify();
        },
        (err) => {
          console.warn('[AchievementCatalogService] subscribe error:', err);
          if (this.defs.length === 0) {
            applyCatalogToManager([]);
            this.notify();
          }
        },
      );
    }

    return () => {
      this.startCount = Math.max(0, this.startCount - 1);
      if (this.startCount === 0) this.stop();
    };
  }

  stop() {
    this.unsubFirestore?.();
    this.unsubFirestore = null;
    this.startCount = 0;
  }

  getDefs(): AchievementDef[] {
    return this.defs;
  }

  /** Catálogo efetivo para UI (remoto ou sugestões em memória). */
  getEffectiveDefs(): AchievementDef[] {
    if (this.defs.length > 0) return this.defs;
    return SUGGESTED_ACHIEVEMENTS;
  }

  isUsingRemote(): boolean {
    return this.defs.length > 0;
  }

  subscribe(listener: (defs: AchievementDef[]) => void): () => void {
    this.listeners.add(listener);
    listener(this.getEffectiveDefs());
    const stop = this.start();
    return () => {
      this.listeners.delete(listener);
      stop();
    };
  }

  private notify() {
    const payload = this.getEffectiveDefs();
    this.listeners.forEach((fn) => {
      try {
        fn(payload);
      } catch (err) {
        console.warn('[AchievementCatalogService] listener error:', err);
      }
    });
  }

  async list(): Promise<AchievementDef[]> {
    const snap = await getDocs(collection(db, COLLECTION));
    return snap.docs.map((d) =>
      normalizeDef(d.id, d.data() as Record<string, unknown>),
    );
  }

  async create(input: AchievementDefInput): Promise<AchievementDef> {
    const id = input.id.trim();
    if (!id) throw new Error('ID obrigatório');
    const refDoc = doc(db, COLLECTION, id);
    const payload = {
      ...input,
      id,
      enabled: input.enabled !== false,
      source: input.source || 'custom',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(refDoc, payload);
    return normalizeDef(id, payload as unknown as Record<string, unknown>);
  }

  async update(id: string, patch: Partial<AchievementDefInput>): Promise<void> {
    const { id: _omit, ...rest } = patch as Partial<AchievementDefInput> & { id?: string };
    await updateDoc(doc(db, COLLECTION, id), {
      ...rest,
      updatedAt: serverTimestamp(),
    });
  }

  async remove(id: string): Promise<void> {
    const existing = this.defs.find((d) => d.id === id);
    await deleteDoc(doc(db, COLLECTION, id));
    if (existing?.iconUrl?.includes(ICON_PREFIX)) {
      try {
        await deleteObject(ref(storage, `${ICON_PREFIX}/${id}`));
      } catch {
        // ícone pode não existir ou path diferente
      }
    }
  }

  /** Importa sugestões locais que ainda não existem no Firestore. */
  async importSuggestions(): Promise<{ imported: number; skipped: number }> {
    const existing = new Set((await this.list()).map((d) => d.id));
    let imported = 0;
    let skipped = 0;
    const batchSize = 400;
    let batch = writeBatch(db);
    let ops = 0;

    const commit = async () => {
      if (ops === 0) return;
      await batch.commit();
      batch = writeBatch(db);
      ops = 0;
    };

    for (const suggestion of SUGGESTED_ACHIEVEMENTS) {
      if (existing.has(suggestion.id)) {
        skipped += 1;
        continue;
      }
      const refDoc = doc(db, COLLECTION, suggestion.id);
      batch.set(refDoc, {
        ...suggestion,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      ops += 1;
      imported += 1;
      if (ops >= batchSize) await commit();
    }
    await commit();
    return { imported, skipped };
  }

  async uploadIcon(
    achievementId: string,
    file: File,
    onProgress?: (pct: number) => void,
  ): Promise<string> {
    if (!file.type.startsWith('image/')) {
      throw new Error('Envie uma imagem (png, jpg, webp…).');
    }
    if (file.size <= 0 || file.size > MAX_ICON_BYTES) {
      throw new Error('Imagem inválida ou maior que 5MB.');
    }
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const storagePath = `${ICON_PREFIX}/${achievementId}.${ext}`;
    const storageRef = ref(storage, storagePath);

    return new Promise((resolve, reject) => {
      const task = uploadBytesResumable(storageRef, file, { contentType: file.type });
      task.on(
        'state_changed',
        (snap) => {
          onProgress?.((snap.bytesTransferred / snap.totalBytes) * 100);
        },
        reject,
        async () => {
          try {
            resolve(await getDownloadURL(task.snapshot.ref));
          } catch (err) {
            reject(err);
          }
        },
      );
    });
  }
}

export const achievementCatalogService = AchievementCatalogService.getInstance();
