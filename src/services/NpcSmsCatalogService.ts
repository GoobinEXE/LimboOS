import {
  updateDoc,
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
import type {
  NpcContact,
  NpcContactInput,
  NpcDialogue,
  NpcDialogueInput,
} from '../types/npcSms';
import {
  SUGGESTED_NPC_CONTACTS,
  SUGGESTED_NPC_DIALOGUES,
} from '../data/npcMessages';
import { catalogStateService } from './CatalogStateService';

const CONTACTS_COL = 'npcContacts';
const DIALOGUES_COL = 'npcDialogues';
const AVATAR_PREFIX = 'npcAvatars';
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export type NpcSmsCatalogSnapshot = {
  contacts: NpcContact[];
  dialogues: NpcDialogue[];
  isRemote: boolean;
};

function toFirestorePatch<T extends { campaignIds?: string[] | 'global' }>(input: T): Record<string, unknown> {
  const { campaignIds, ...rest } = input;
  return campaignIds === undefined ? rest : { ...rest, ...listScopeToFirestore(campaignIds) };
}

function normalizeContact(id: string, raw: Record<string, unknown>): NpcContact {
  return {
    id,
    name: String(raw.name ?? id),
    number: String(raw.number ?? ''),
    avatarUrl: raw.avatarUrl ? String(raw.avatarUrl) : undefined,
    campaignIds: listScopeFromFirestore(raw),
    enabled: raw.enabled !== false,
    source: raw.source === 'suggestion' ? 'suggestion' : 'custom',
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

function normalizeDialogue(id: string, raw: Record<string, unknown>): NpcDialogue {
  const messages = Array.isArray(raw.messages)
    ? (raw.messages as NpcDialogue['messages']).map((m) => ({
        speaker: m?.speaker === 'player' ? ('player' as const) : ('npc' as const),
        text: String(m?.text ?? ''),
      }))
    : [];
  return {
    id,
    npcId: String(raw.npcId ?? ''),
    title: String(raw.title ?? id),
    messages,
    enabled: raw.enabled !== false,
    source: raw.source === 'suggestion' ? 'suggestion' : 'custom',
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

class NpcSmsCatalogService {
  private static instance: NpcSmsCatalogService;
  private contacts: NpcContact[] = [];
  private dialogues: NpcDialogue[] = [];
  private listeners = new Set<(snap: NpcSmsCatalogSnapshot) => void>();
  private unsubContacts: (() => void) | null = null;
  private unsubDialogues: (() => void) | null = null;
  private unsubState: (() => void) | null = null;
  private unsubScope: (() => void) | null = null;
  private startCount = 0;

  private constructor() {}

  public static getInstance(): NpcSmsCatalogService {
    if (!NpcSmsCatalogService.instance) {
      NpcSmsCatalogService.instance = new NpcSmsCatalogService();
    }
    return NpcSmsCatalogService.instance;
  }

  start(): () => void {
    this.startCount += 1;

    if (!this.unsubState) {
      // Catálogo inicializado vazio deixa de cair nas sugestões
      this.unsubState = catalogStateService.subscribe(() => this.notify());
    }

    if (!this.unsubContacts) {
      this.subscribeRemote();
      this.unsubScope = onTenantScopeChange(() => {
        this.unsubContacts?.();
        this.unsubDialogues?.();
        this.contacts = [];
        this.dialogues = [];
        this.notify();
        this.subscribeRemote();
      });
    }

    return () => {
      this.startCount = Math.max(0, this.startCount - 1);
      if (this.startCount === 0) this.stop();
    };
  }

  /** Contatos e diálogos visíveis na pasta ativa (co-mestre: campanhas dele e globais). */
  private subscribeRemote() {
    if (!getTenantScope()) {
      this.unsubContacts = () => {};
      this.unsubDialogues = () => {};
      return;
    }
    this.unsubContacts = subscribeScoped(
      CONTACTS_COL,
      'list',
      [],
      (docs) => {
        this.contacts = docs.map((d) => normalizeContact(d.id, d.data() as Record<string, unknown>));
        this.notify();
      },
      (err) => {
        console.warn('[NpcSmsCatalogService] contacts subscribe error:', err);
        this.notify();
      },
    );
    this.unsubDialogues = subscribeScoped(
      DIALOGUES_COL,
      'list',
      [],
      (docs) => {
        this.dialogues = docs.map((d) => normalizeDialogue(d.id, d.data() as Record<string, unknown>));
        this.notify();
      },
      (err) => {
        console.warn('[NpcSmsCatalogService] dialogues subscribe error:', err);
        this.notify();
      },
    );
  }

  /** Diálogos herdam o escopo do contato (as regras de co-mestre leem dele). */
  private dialogueScope(npcId: string): { campaignIds: string[]; global: boolean } {
    const contact = this.contacts.find((c) => c.id === npcId);
    return listScopeToFirestore(contact?.campaignIds ?? 'global');
  }

  stop() {
    this.unsubScope?.();
    this.unsubScope = null;
    this.unsubContacts?.();
    this.unsubDialogues?.();
    this.unsubContacts = null;
    this.unsubDialogues = null;
    this.unsubState?.();
    this.unsubState = null;
    this.startCount = 0;
  }

  private initialized(): boolean {
    return catalogStateService.isInitialized('npcSms');
  }

  isUsingRemote(): boolean {
    return this.initialized() || this.contacts.length > 0 || this.dialogues.length > 0;
  }

  /**
   * Inicializado: só o Firestore, mesmo vazio. Antes da marca, cada coleção
   * vazia cai nas sugestões (comportamento das instalações antigas).
   */
  getSnapshot(): NpcSmsCatalogSnapshot {
    return {
      contacts: this.hasRemoteContacts() ? this.contacts : SUGGESTED_NPC_CONTACTS,
      dialogues: this.hasRemoteDialogues() ? this.dialogues : SUGGESTED_NPC_DIALOGUES,
      isRemote: this.isUsingRemote(),
    };
  }

  hasRemoteContacts(): boolean {
    return this.initialized() || this.contacts.length > 0;
  }

  hasRemoteDialogues(): boolean {
    return this.initialized() || this.dialogues.length > 0;
  }

  /** Contatos ativos (enabled) do catálogo efetivo. */
  getEnabledContacts(): NpcContact[] {
    return this.getSnapshot().contacts.filter((c) => c.enabled !== false);
  }

  getEnabledDialogues(npcId?: string): NpcDialogue[] {
    return this.getSnapshot()
      .dialogues.filter((d) => d.enabled !== false)
      .filter((d) => !npcId || d.npcId === npcId);
  }

  getContact(id: string): NpcContact | undefined {
    return this.getSnapshot().contacts.find((c) => c.id === id);
  }

  getDialogue(id: string): NpcDialogue | undefined {
    return this.getSnapshot().dialogues.find((d) => d.id === id);
  }

  subscribe(listener: (snap: NpcSmsCatalogSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    const stop = this.start();
    return () => {
      this.listeners.delete(listener);
      stop();
    };
  }

  private notify() {
    const payload = this.getSnapshot();
    this.listeners.forEach((fn) => {
      try {
        fn(payload);
      } catch (err) {
        console.warn('[NpcSmsCatalogService] listener error:', err);
      }
    });
  }

  async createContact(input: NpcContactInput): Promise<NpcContact> {
    const id = input.id.trim();
    if (!id) throw new Error('ID obrigatório');
    const payload = {
      ...toFirestorePatch(input),
      id,
      enabled: input.enabled !== false,
      source: input.source || 'custom',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    const batch = writeBatch(db);
    batch.set(wsDoc(CONTACTS_COL, id), payload);
    catalogStateService.markInBatch(batch, 'npcSms');
    await batch.commit();
    return normalizeContact(id, payload as unknown as Record<string, unknown>);
  }

  async updateContact(id: string, patch: Partial<NpcContactInput>): Promise<void> {
    const { id: _omit, ...rest } = patch as Partial<NpcContactInput> & { id?: string };
    const batch = writeBatch(db);
    batch.update(wsDoc(CONTACTS_COL, id), {
      ...toFirestorePatch(rest),
      updatedAt: serverTimestamp(),
    });
    // Escopo do contato mudou: os diálogos dele acompanham.
    if (rest.campaignIds !== undefined) {
      const scope = listScopeToFirestore(rest.campaignIds);
      this.dialogues
        .filter((d) => d.npcId === id)
        .forEach((d) => batch.update(wsDoc(DIALOGUES_COL, d.id), scope));
    }
    await batch.commit();
  }

  async removeContact(id: string): Promise<void> {
    const existing = this.contacts.find((c) => c.id === id);
    // Apagar marca o catálogo: apagar o último NPC não traz as sugestões de volta
    const batch = writeBatch(db);
    batch.delete(wsDoc(CONTACTS_COL, id));
    catalogStateService.markInBatch(batch, 'npcSms');
    await batch.commit();
    if (existing?.avatarUrl?.includes(AVATAR_PREFIX)) {
      try {
        await deleteObject(ref(storage, `workspaces/${requireWsId()}/${AVATAR_PREFIX}/${id}`));
      } catch {
        // ignore
      }
    }
  }

  async createDialogue(input: NpcDialogueInput): Promise<NpcDialogue> {
    const id = input.id.trim();
    if (!id) throw new Error('ID obrigatório');
    if (!input.npcId) throw new Error('npcId obrigatório');
    const payload = {
      ...input,
      ...this.dialogueScope(input.npcId),
      id,
      enabled: input.enabled !== false,
      source: input.source || 'custom',
      messages: input.messages || [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    const batch = writeBatch(db);
    batch.set(wsDoc(DIALOGUES_COL, id), payload);
    catalogStateService.markInBatch(batch, 'npcSms');
    await batch.commit();
    return normalizeDialogue(id, payload as unknown as Record<string, unknown>);
  }

  async updateDialogue(id: string, patch: Partial<NpcDialogueInput>): Promise<void> {
    const { id: _omit, ...rest } = patch as Partial<NpcDialogueInput> & { id?: string };
    await updateDoc(wsDoc(DIALOGUES_COL, id), {
      ...rest,
      ...(rest.npcId ? this.dialogueScope(rest.npcId) : {}),
      updatedAt: serverTimestamp(),
    });
  }

  async removeDialogue(id: string): Promise<void> {
    const batch = writeBatch(db);
    batch.delete(wsDoc(DIALOGUES_COL, id));
    catalogStateService.markInBatch(batch, 'npcSms');
    await batch.commit();
  }

  async importSuggestions(): Promise<{
    contactsImported: number;
    contactsSkipped: number;
    dialoguesImported: number;
    dialoguesSkipped: number;
  }> {
    const [contactDocs, dialogueDocs] = await Promise.all([
      getScopedDocs(CONTACTS_COL, 'list'),
      getScopedDocs(DIALOGUES_COL, 'list'),
    ]);
    const existingContacts = new Set(contactDocs.map((d) => d.id));
    const existingDialogues = new Set(dialogueDocs.map((d) => d.id));
    const contactScope = new Map(
      SUGGESTED_NPC_CONTACTS.map((c) => [c.id, listScopeToFirestore(c.campaignIds)]),
    );

    let contactsImported = 0;
    let contactsSkipped = 0;
    let dialoguesImported = 0;
    let dialoguesSkipped = 0;

    const batchSize = 400;
    let batch = writeBatch(db);
    let ops = 0;

    const commit = async () => {
      if (ops === 0) return;
      await batch.commit();
      batch = writeBatch(db);
      ops = 0;
    };

    for (const c of SUGGESTED_NPC_CONTACTS) {
      if (existingContacts.has(c.id)) {
        contactsSkipped += 1;
        continue;
      }
      batch.set(wsDoc(CONTACTS_COL, c.id), {
        ...toFirestorePatch(c),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      ops += 1;
      contactsImported += 1;
      if (ops >= batchSize) await commit();
    }

    for (const d of SUGGESTED_NPC_DIALOGUES) {
      if (existingDialogues.has(d.id)) {
        dialoguesSkipped += 1;
        continue;
      }
      batch.set(wsDoc(DIALOGUES_COL, d.id), {
        ...d,
        ...(contactScope.get(d.npcId) ?? listScopeToFirestore('global')),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      ops += 1;
      dialoguesImported += 1;
      if (ops >= batchSize) await commit();
    }

    catalogStateService.markInBatch(batch, 'npcSms');
    ops += 1;
    await commit();
    return { contactsImported, contactsSkipped, dialoguesImported, dialoguesSkipped };
  }

  async uploadAvatar(
    contactId: string,
    file: File,
    onProgress?: (pct: number) => void,
  ): Promise<string> {
    if (!file.type.startsWith('image/')) {
      throw new Error('Envie uma imagem (png, jpg, webp…).');
    }
    if (file.size <= 0 || file.size > MAX_AVATAR_BYTES) {
      throw new Error('Imagem inválida ou maior que 5MB.');
    }
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const storagePath = `workspaces/${requireWsId()}/${AVATAR_PREFIX}/${contactId}.${ext}`;
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

export const npcSmsCatalogService = NpcSmsCatalogService.getInstance();
