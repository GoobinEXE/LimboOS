import {
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
import {
  getScopedDocs,
  getTenantScope,
  listScopeFromFirestore,
  listScopeToFirestore,
  onTenantScopeChange,
  requireWsId,
  subscribeScoped,
  wsDoc,
} from '../lib/tenantScope';
import type { AchievementDef, AchievementDefInput } from '../types/achievement';
import { achievementManager } from './AchievementManager';
import { SUGGESTED_ACHIEVEMENTS } from '../data/achievements';
import { catalogStateService } from './CatalogStateService';

const COLLECTION = 'achievementDefs';
const ICON_PREFIX = 'achievementIcons';
const MAX_ICON_BYTES = 5 * 1024 * 1024;

/** Converte o escopo do cliente ('global' | lista) para os campos do Firestore. */
function toFirestorePatch<T extends { campaignIds?: string[] | 'global' }>(input: T): Record<string, unknown> {
  const { campaignIds, ...rest } = input;
  return campaignIds === undefined ? rest : { ...rest, ...listScopeToFirestore(campaignIds) };
}

function normalizeDef(id: string, raw: Record<string, unknown>): AchievementDef {
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
    campaignIds: listScopeFromFirestore(raw),
    isSecret: raw.isSecret !== false,
    unlockCondition: String(raw.unlockCondition ?? ''),
    rule: (raw.rule as AchievementDef['rule']) || { type: 'manual' },
    enabled: raw.enabled !== false,
    source: raw.source === 'suggestion' ? 'suggestion' : 'custom',
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

class AchievementCatalogService {
  private static instance: AchievementCatalogService;
  private defs: AchievementDef[] = [];
  private listeners = new Set<(defs: AchievementDef[]) => void>();
  private unsubFirestore: (() => void) | null = null;
  private unsubState: (() => void) | null = null;
  private unsubScope: (() => void) | null = null;
  private startCount = 0;

  private constructor() {}

  public static getInstance(): AchievementCatalogService {
    if (!AchievementCatalogService.instance) {
      AchievementCatalogService.instance = new AchievementCatalogService();
    }
    return AchievementCatalogService.instance;
  }

  /** Repassa o catálogo efetivo ao AchievementManager e aos ouvintes. */
  private publish() {
    achievementManager.replaceCatalog(this.getEffectiveDefs());
    this.notify();
  }

  /** Inicia listener Firestore (refcount). Sugestões em memória até o catálogo ser inicializado. */
  start(): () => void {
    this.startCount += 1;

    if (!this.unsubFirestore) {
      if (this.defs.length === 0 && achievementManager.getAll().length === 0) {
        achievementManager.replaceCatalog(this.getEffectiveDefs());
      }

      this.unsubState = catalogStateService.subscribe(() => this.publish());
      this.subscribeRemote();
      // Troca de pasta (ou de agente em outra mesa): recomeça o listener.
      this.unsubScope = onTenantScopeChange(() => {
        this.unsubFirestore?.();
        this.defs = [];
        this.publish();
        this.subscribeRemote();
      });
    }

    return () => {
      this.startCount = Math.max(0, this.startCount - 1);
      if (this.startCount === 0) this.stop();
    };
  }

  /** Conquistas visíveis na pasta ativa (co-mestre/jogador: das campanhas deles e globais). */
  private subscribeRemote() {
    if (!getTenantScope()) {
      this.unsubFirestore = () => {};
      return;
    }
    this.unsubFirestore = subscribeScoped(
      COLLECTION,
      'list',
      [],
      (docs) => {
        this.defs = docs.map((d) => normalizeDef(d.id, d.data() as Record<string, unknown>));
        this.publish();
      },
      (err) => {
        console.warn('[AchievementCatalogService] subscribe error:', err);
        if (this.defs.length === 0) this.publish();
      },
    );
  }

  stop() {
    this.unsubScope?.();
    this.unsubScope = null;
    this.unsubFirestore?.();
    this.unsubFirestore = null;
    this.unsubState?.();
    this.unsubState = null;
    this.startCount = 0;
  }

  getDefs(): AchievementDef[] {
    return this.defs;
  }

  /** Catálogo efetivo: o Firestore depois de inicializado (mesmo vazio), senão as sugestões. */
  getEffectiveDefs(): AchievementDef[] {
    return this.isUsingRemote() ? this.defs : SUGGESTED_ACHIEVEMENTS;
  }

  /** Coleção com documentos conta como inicializada (instalações anteriores à marca). */
  isUsingRemote(): boolean {
    return this.defs.length > 0 || catalogStateService.isInitialized('achievements');
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
    const docs = await getScopedDocs(COLLECTION, 'list');
    return docs.map((d) => normalizeDef(d.id, d.data() as Record<string, unknown>));
  }

  async create(input: AchievementDefInput): Promise<AchievementDef> {
    const id = input.id.trim();
    if (!id) throw new Error('ID obrigatório');
    const refDoc = wsDoc(COLLECTION, id);
    const payload = {
      ...toFirestorePatch(input),
      id,
      enabled: input.enabled !== false,
      source: input.source || 'custom',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    const batch = writeBatch(db);
    batch.set(refDoc, payload);
    catalogStateService.markInBatch(batch, 'achievements');
    await batch.commit();
    return normalizeDef(id, payload as unknown as Record<string, unknown>);
  }

  async update(id: string, patch: Partial<AchievementDefInput>): Promise<void> {
    const { id: _omit, ...rest } = patch as Partial<AchievementDefInput> & { id?: string };
    const batch = writeBatch(db);
    batch.update(wsDoc(COLLECTION, id), {
      ...toFirestorePatch(rest),
      updatedAt: serverTimestamp(),
    });
    catalogStateService.markInBatch(batch, 'achievements');
    await batch.commit();
  }

  /** Apagar marca o catálogo: apagar a última conquista não traz as sugestões de volta. */
  async remove(id: string): Promise<void> {
    const existing = this.defs.find((d) => d.id === id);
    const batch = writeBatch(db);
    batch.delete(wsDoc(COLLECTION, id));
    catalogStateService.markInBatch(batch, 'achievements');
    await batch.commit();
    if (existing?.iconUrl?.includes(ICON_PREFIX)) {
      try {
        await deleteObject(ref(storage, `workspaces/${requireWsId()}/${ICON_PREFIX}/${id}`));
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
      const refDoc = wsDoc(COLLECTION, suggestion.id);
      batch.set(refDoc, {
        ...toFirestorePatch(suggestion),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      ops += 1;
      imported += 1;
      if (ops >= batchSize) await commit();
    }
    catalogStateService.markInBatch(batch, 'achievements');
    ops += 1;
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
    const storagePath = `workspaces/${requireWsId()}/${ICON_PREFIX}/${achievementId}.${ext}`;
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
