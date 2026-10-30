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

const CONTACTS_COL = 'npcContacts';
const DIALOGUES_COL = 'npcDialogues';
const AVATAR_PREFIX = 'npcAvatars';
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export type NpcSmsCatalogSnapshot = {
  contacts: NpcContact[];
  dialogues: NpcDialogue[];
  isRemote: boolean;
};

function normalizeContact(id: string, raw: Record<string, unknown>): NpcContact {
  const campaignIds = raw.campaignIds;
  return {
    id,
    name: String(raw.name ?? id),
    number: String(raw.number ?? ''),
    avatarUrl: raw.avatarUrl ? String(raw.avatarUrl) : undefined,
    campaignIds:
      campaignIds === 'global' || campaignIds == null
        ? 'global'
        : Array.isArray(campaignIds)
          ? (campaignIds as string[])
          : 'global',
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

    if (!this.unsubContacts) {
      this.unsubContacts = onSnapshot(
        collection(db, CONTACTS_COL),
        (snap) => {
          this.contacts = snap.docs.map((d) =>
            normalizeContact(d.id, d.data() as Record<string, unknown>),
          );
          this.notify();
        },
        (err) => {
          console.warn('[NpcSmsCatalogService] contacts subscribe error:', err);
          this.notify();
        },
      );
    }

    if (!this.unsubDialogues) {
      this.unsubDialogues = onSnapshot(
        collection(db, DIALOGUES_COL),
        (snap) => {
          this.dialogues = snap.docs.map((d) =>
            normalizeDialogue(d.id, d.data() as Record<string, unknown>),
          );
          this.notify();
        },
        (err) => {
          console.warn('[NpcSmsCatalogService] dialogues subscribe error:', err);
          this.notify();
        },
      );
    }

    return () => {
      this.startCount = Math.max(0, this.startCount - 1);
      if (this.startCount === 0) this.stop();
    };
  }

  stop() {
    this.unsubContacts?.();
    this.unsubDialogues?.();
    this.unsubContacts = null;
    this.unsubDialogues = null;
    this.startCount = 0;
  }

  isUsingRemote(): boolean {
    return this.contacts.length > 0 || this.dialogues.length > 0;
  }

  getSnapshot(): NpcSmsCatalogSnapshot {
    return {
      contacts: this.contacts.length > 0 ? this.contacts : SUGGESTED_NPC_CONTACTS,
      dialogues: this.dialogues.length > 0 ? this.dialogues : SUGGESTED_NPC_DIALOGUES,
      isRemote: this.isUsingRemote(),
    };
  }

  hasRemoteContacts(): boolean {
    return this.contacts.length > 0;
  }

  hasRemoteDialogues(): boolean {
    return this.dialogues.length > 0;
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
      ...input,
      id,
      enabled: input.enabled !== false,
      source: input.source || 'custom',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(doc(db, CONTACTS_COL, id), payload);
    return normalizeContact(id, payload as unknown as Record<string, unknown>);
  }

  async updateContact(id: string, patch: Partial<NpcContactInput>): Promise<void> {
    const { id: _omit, ...rest } = patch as Partial<NpcContactInput> & { id?: string };
    await updateDoc(doc(db, CONTACTS_COL, id), {
      ...rest,
      updatedAt: serverTimestamp(),
    });
  }

  async removeContact(id: string): Promise<void> {
    const existing = this.contacts.find((c) => c.id === id);
    await deleteDoc(doc(db, CONTACTS_COL, id));
    if (existing?.avatarUrl?.includes(AVATAR_PREFIX)) {
      try {
        await deleteObject(ref(storage, `${AVATAR_PREFIX}/${id}`));
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
      id,
      enabled: input.enabled !== false,
      source: input.source || 'custom',
      messages: input.messages || [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(doc(db, DIALOGUES_COL, id), payload);
    return normalizeDialogue(id, payload as unknown as Record<string, unknown>);
  }

  async updateDialogue(id: string, patch: Partial<NpcDialogueInput>): Promise<void> {
    const { id: _omit, ...rest } = patch as Partial<NpcDialogueInput> & { id?: string };
    await updateDoc(doc(db, DIALOGUES_COL, id), {
      ...rest,
      updatedAt: serverTimestamp(),
    });
  }

  async removeDialogue(id: string): Promise<void> {
    await deleteDoc(doc(db, DIALOGUES_COL, id));
  }

  async importSuggestions(): Promise<{
    contactsImported: number;
    contactsSkipped: number;
    dialoguesImported: number;
    dialoguesSkipped: number;
  }> {
    const [contactSnap, dialogueSnap] = await Promise.all([
      getDocs(collection(db, CONTACTS_COL)),
      getDocs(collection(db, DIALOGUES_COL)),
    ]);
    const existingContacts = new Set(contactSnap.docs.map((d) => d.id));
    const existingDialogues = new Set(dialogueSnap.docs.map((d) => d.id));

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
      batch.set(doc(db, CONTACTS_COL, c.id), {
        ...c,
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
      batch.set(doc(db, DIALOGUES_COL, d.id), {
        ...d,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      ops += 1;
      dialoguesImported += 1;
      if (ops >= batchSize) await commit();
    }

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
    const storagePath = `${AVATAR_PREFIX}/${contactId}.${ext}`;
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
