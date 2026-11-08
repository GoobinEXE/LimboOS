import { db } from "../lib/firebase";
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type Query,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { callFunction } from "../lib/functions";
import {
  getScopedDocs,
  getTenantScope,
  requireTenantScope,
  subscribeScoped,
  wsDoc,
  type TenantScope,
} from "../lib/tenantScope";
import { achievementGrantDocId } from "./AchievementManager";
import { MasterAccount, CharacterData, PlayerStats } from "../types/player";
import type { WorkspacePlayer } from "../types/workspace";

export interface PlayCountData {
  tapeId: string;
  count: number;
}

/** Jogador da mesa no formato que o painel já usava para contas. */
export type RosterAccount = MasterAccount & {
  /** Rótulo que o mestre deu ao jogador (o nome da conta é do jogador). */
  gmLabel?: string;
  characterIds?: string[];
  rosterCampaignIds?: string[];
};

/** Campos de conta que agora vivem no agente (o mestre não altera a conta do jogador). */
const CHARACTER_LEVEL_FLAGS = ['hasTerminalAccess', 'hasMacAccess', 'forceTerminalOpen', 'forceMacOpen'] as const;
type CharacterLevelFlag = (typeof CHARACTER_LEVEL_FLAGS)[number];

const MAX_IN = 30;

function chunk<T>(values: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < values.length; i += size) out.push(values.slice(i, i + size));
  return out;
}

/**
 * Consultas de agentes da pasta: dono filtra por workspaceId; co-mestre soma o
 * filtro de campanha (as regras só liberam agentes das campanhas dele).
 */
function characterQueries(scope: TenantScope, extra: Array<ReturnType<typeof where>> = []): Query<DocumentData>[] {
  const base = collectionGroup(db, "characters");
  if (scope.campaignIds === null) {
    return [query(base, where("workspaceId", "==", scope.wsId), ...extra)];
  }
  return chunk(scope.campaignIds, MAX_IN).map((ids) =>
    query(base, where("workspaceId", "==", scope.wsId), where("campaignId", "in", ids), ...extra),
  );
}

function toCharacterEntry(d: QueryDocumentSnapshot<DocumentData>) {
  return {
    uid: d.ref.parent.parent?.id || "",
    char: { id: d.id, ...d.data() } as CharacterData,
  };
}

function rosterToAccount(uid: string, data: Partial<WorkspacePlayer> & Record<string, any>): RosterAccount {
  return {
    uid,
    email: "",
    masterName: data.gmLabel || data.masterName || data.displayName || "Agente",
    displayName: data.displayName,
    role: "player",
    createdAt: (data.joinedAt as MasterAccount["createdAt"]) ?? null,
    lastLogin: (data.lastLogin as MasterAccount["lastLogin"]) ?? null,
    suspended: data.suspended === true,
    notes: data.notes,
    gmLabel: data.gmLabel,
    characterIds: data.characterIds || [],
    rosterCampaignIds: data.campaignIds || [],
  };
}

/** Flags de hardware de cada conta = OU das flags dos agentes dela na mesa. */
function withCharacterFlags(accounts: RosterAccount[], characters: { uid: string; char: CharacterData }[]): RosterAccount[] {
  const byUid = new Map<string, CharacterData[]>();
  characters.forEach(({ uid, char }) => {
    if (char.archived) return;
    byUid.set(uid, [...(byUid.get(uid) || []), char]);
  });
  return accounts.map((acc) => {
    const chars = byUid.get(acc.uid) || [];
    const any = (flag: CharacterLevelFlag) => chars.some((c) => c[flag] === true);
    return {
      ...acc,
      hasTerminalAccess: any("hasTerminalAccess"),
      hasMacAccess: any("hasMacAccess"),
      forceTerminalOpen: any("forceTerminalOpen"),
      forceMacOpen: any("forceMacOpen"),
    };
  });
}

export class UserService {
  private static instance: UserService;
  private constructor() {}

  public static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService();
    }
    return UserService.instance;
  }

  /**
   * Jogadores da mesa (roster), no formato de conta, com as flags de hardware
   * agregadas dos agentes. Co-mestre recebe só os jogadores das campanhas dele.
   */
  public subscribeToUsers(callback: (users: MasterAccount[]) => void): () => void {
    let roster: RosterAccount[] | null = null;
    let characters: { uid: string; char: CharacterData }[] | null = null;
    const emit = () => {
      if (roster === null || characters === null) return;
      callback(withCharacterFlags(roster, characters));
    };
    const stopRoster = subscribeScoped(
      "players",
      "list",
      [],
      (docs) => {
        roster = docs.map((d) => rosterToAccount(d.id, d.data()));
        emit();
      },
      (err) => console.warn("[UserService] roster listener error:", err),
    );
    const stopChars = this.subscribeToAllCharacters((list) => {
      characters = list;
      emit();
    });
    return () => {
      stopRoster();
      stopChars();
    };
  }

  /** Página do roster, ordenada por entrada na mesa, com filtro no cliente. */
  public async fetchUsersPage(
    pageSize: number,
    lastDoc: any = null,
    searchField: string = "",
    searchQuery: string = "",
  ): Promise<{ users: MasterAccount[]; lastVisible: any }> {
    const docs = await getScopedDocs("players", "list");
    let users = docs
      .map((d) => rosterToAccount(d.id, d.data()))
      .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));

    if (searchQuery && searchField) {
      const q = searchQuery.toLowerCase();
      users = users.filter((user) => {
        const value = (user as unknown as Record<string, unknown>)[searchField];
        return String(value ?? "").toLowerCase().includes(q);
      });
    }
    if (lastDoc) {
      const lastUid = lastDoc.id ?? lastDoc.uid;
      const startIdx = users.findIndex((user) => user.uid === lastUid);
      users = startIdx >= 0 ? users.slice(startIdx + 1) : users;
    }
    const page = users.slice(0, pageSize);
    const last = page[page.length - 1];
    return { users: page, lastVisible: last ? { id: last.uid } : null };
  }

  /** Agentes da mesa (co-mestre: das campanhas dele). */
  public subscribeToAllCharacters(callback: (characters: { uid: string; char: CharacterData }[]) => void): () => void {
    const scope = getTenantScope();
    if (!scope || scope.role === "player") {
      callback([]);
      return () => {};
    }
    const queries = characterQueries(scope);
    if (queries.length === 0) {
      callback([]);
      return () => {};
    }
    const parts: QueryDocumentSnapshot<DocumentData>[][] = queries.map(() => []);
    const ready = queries.map(() => false);
    const emit = () => {
      if (!ready.every(Boolean)) return;
      const byPath = new Map<string, QueryDocumentSnapshot<DocumentData>>();
      parts.flat().forEach((d) => byPath.set(d.ref.path, d));
      callback(Array.from(byPath.values()).map(toCharacterEntry).filter((item) => item.uid !== ""));
    };
    const unsubs = queries.map((q, i) =>
      onSnapshot(
        q,
        (snap) => {
          parts[i] = snap.docs;
          ready[i] = true;
          emit();
        },
        (err) => {
          console.warn("[UserService] characters listener error:", err);
          parts[i] = [];
          ready[i] = true;
          emit();
        },
      ),
    );
    return () => unsubs.forEach((u) => u());
  }

  private async fetchScopedCharacters(): Promise<{ uid: string; char: CharacterData }[]> {
    const scope = requireTenantScope();
    const snaps = await Promise.all(characterQueries(scope).map((q) => getDocs(q)));
    const byPath = new Map<string, QueryDocumentSnapshot<DocumentData>>();
    snaps.forEach((s) => s.docs.forEach((d) => byPath.set(d.ref.path, d)));
    return Array.from(byPath.values()).map(toCharacterEntry);
  }

  /** Agentes de uma conta nesta mesa. */
  public async fetchCharactersForUser(uid: string): Promise<CharacterData[]> {
    if (!uid) return [];
    const all = await this.fetchScopedCharacters();
    return all.filter((c) => c.uid === uid).map((c) => c.char);
  }

  /** Busca agentes da mesa por prefixo de codinome (filtro no cliente). */
  public async searchCharactersByCodinome(queryStr: string, limitCount: number = 20): Promise<{ uid: string; char: CharacterData }[]> {
    const q = queryStr.trim().toLowerCase();
    if (!q) return [];
    const all = await this.fetchScopedCharacters();
    return all.filter(({ char }) => (char.codinome || "").toLowerCase().startsWith(q)).slice(0, limitCount);
  }

  /** Reproduções por conta, na mesa. */
  public subscribeToUserTotalPlays(callback: (counts: Record<string, number>) => void): () => void {
    return subscribeScoped(
      "playEvents",
      "single",
      [],
      (docs) => {
        const counts: Record<string, number> = {};
        docs.forEach((d) => {
          const data = d.data();
          if (data.uid) counts[data.uid] = (counts[data.uid] || 0) + 1;
        });
        callback(counts);
      },
      (err) => console.warn("[UserService] playEvents listener error:", err),
    );
  }

  public async loadUserDetails(uid: string, characterId: string): Promise<{
    intel: { id: string; unlockedAt: any }[];
    playCounts: PlayCountData[];
    stats: PlayerStats | null;
    achievements: string[];
  }> {
    try {
      const [intelSnap, events, statsSnap, achSnap] = await Promise.all([
        getDocs(collection(db, "users", uid, "characters", characterId, "intel")),
        getScopedDocs("playEvents", "single", [where("uid", "==", uid), where("characterId", "==", characterId)]),
        getDoc(doc(db, "users", uid, "characters", characterId, "stats", "main")),
        getDocs(collection(db, "users", uid, "characters", characterId, "achievements")),
      ]);

      const intel = intelSnap.docs.map((d) => ({ id: d.id, unlockedAt: d.data().unlockedAt }));
      const tapeCounts: Record<string, number> = {};
      events.forEach((d) => {
        const data = d.data();
        if (data.tapeId) tapeCounts[data.tapeId] = (tapeCounts[data.tapeId] || 0) + 1;
      });
      const playCounts: PlayCountData[] = Object.entries(tapeCounts).map(([tapeId, count]) => ({ tapeId, count }));
      const stats = statsSnap.exists() ? (statsSnap.data() as PlayerStats) : null;
      const achievements = achSnap.docs.map((d) => d.id);
      return { intel, playCounts, stats, achievements };
    } catch (error) {
      console.error("[UserService] Error loading user details:", error);
      return { intel: [], playCounts: [], stats: null, achievements: [] };
    }
  }

  /**
   * Tira o jogador da mesa (dono): sai do roster e dos esquadrões; os agentes
   * dele ficam arquivados. A conta pessoal não é apagada.
   */
  public async deleteUser(uid: string): Promise<void> {
    const scope = requireTenantScope();
    await callFunction("removePlayer", { wsId: scope.wsId, uid });
  }

  /**
   * Ajustes do mestre sobre um jogador. A conta pertence ao jogador, então cada
   * campo vai para onde o mestre pode gravar: rótulo e notas no roster, flags de
   * hardware nos agentes dele nesta mesa. Suspensão é do admin da plataforma.
   */
  public async updateMasterAccount(uid: string, data: Partial<MasterAccount>): Promise<void> {
    const rosterPatch: Record<string, unknown> = {};
    if (data.masterName !== undefined) rosterPatch.gmLabel = data.masterName;
    if (data.notes !== undefined) rosterPatch.notes = data.notes;
    if (Object.keys(rosterPatch).length > 0) {
      await updateDoc(wsDoc("players", uid), rosterPatch);
    }

    const flags: Partial<Record<CharacterLevelFlag, boolean>> = {};
    CHARACTER_LEVEL_FLAGS.forEach((flag) => {
      if (data[flag] !== undefined) flags[flag] = Boolean(data[flag]);
    });
    if (Object.keys(flags).length > 0) {
      const chars = (await this.fetchCharactersForUser(uid)).filter((c) => !c.archived);
      const batch = writeBatch(db);
      chars.forEach((c) => batch.update(doc(db, "users", uid, "characters", c.id), flags));
      if (chars.length > 0) await batch.commit();
    }

    if (data.suspended !== undefined) {
      await callFunction("setAccountSuspended", { targetUid: uid, suspended: data.suspended });
    }
  }

  public async updateCharacter(uid: string, characterId: string, data: Partial<CharacterData>): Promise<void> {
    await updateDoc(doc(db, "users", uid, "characters", characterId), data);
  }

  /** Apaga o agente e o progresso dele (só o dono da mesa). */
  public async deleteCharacter(uid: string, characterId: string): Promise<void> {
    const batch = writeBatch(db);
    const [intelSnap, achSnap] = await Promise.all([
      getDocs(collection(db, "users", uid, "characters", characterId, "intel")),
      getDocs(collection(db, "users", uid, "characters", characterId, "achievements")),
    ]);
    intelSnap.docs.forEach((d) => batch.delete(d.ref));
    achSnap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(doc(db, "users", uid, "characters", characterId));
    await batch.commit();
  }

  public async removeUserIntel(uid: string, characterId: string, intelId: string): Promise<void> {
    await deleteDoc(doc(db, "users", uid, "characters", characterId, "intel", intelId));
  }

  public async addUserIntel(uid: string, characterId: string, intelId: string, campaignId?: string | null): Promise<void> {
    await setDoc(doc(db, "users", uid, "characters", characterId, "intel", intelId), {
      intelId,
      unlockedAt: serverTimestamp(),
      campaignId: campaignId ?? null,
      workspaceId: getTenantScope()?.wsId ?? null,
      source: "admin",
    }, { merge: true });
  }

  public async grantUserAchievement(
    uid: string,
    characterId: string,
    achievementId: string,
    options?: { campaignId?: string; platform?: string },
  ): Promise<void> {
    const campaignId = options?.campaignId || "unscoped";
    const docId = achievementId.includes("__") ? achievementId : achievementGrantDocId(achievementId, campaignId);
    const baseId = achievementId.includes("__") ? achievementId.slice(0, achievementId.lastIndexOf("__")) : achievementId;
    await setDoc(doc(db, "users", uid, "characters", characterId, "achievements", docId), {
      achievementId: baseId,
      campaignId,
      workspaceId: getTenantScope()?.wsId ?? null,
      platform: options?.platform || "walkman",
      unlockedAt: serverTimestamp(),
      source: "admin",
    });
  }

  public async revokeUserAchievement(uid: string, characterId: string, achievementId: string): Promise<void> {
    await deleteDoc(doc(db, "users", uid, "characters", characterId, "achievements", achievementId)).catch(() => undefined);
  }

  /** Admin da plataforma: cria conta Master ID para quem não tem login próprio. */
  public async adminCreateUser(masterId: string, rawPassword: string): Promise<{ uid: string }> {
    const data = await callFunction<{ masterId: string; password: string }, { success?: boolean; uid?: string }>(
      "adminCreateUser",
      { masterId, password: rawPassword },
    );
    if (!data.success || !data.uid) throw new Error("Falha ao criar usuário.");
    return { uid: data.uid };
  }

  /** Admin da plataforma: troca a senha de uma conta. */
  public async resetUserPassword(targetUid: string, newPassword: string): Promise<void> {
    const data = await callFunction<{ targetUid: string; newPassword: string }, { success?: boolean }>(
      "adminResetPassword",
      { targetUid, newPassword },
    );
    if (!data.success) throw new Error("Falha ao alterar senha.");
  }

  /** Dono cria um agente extra para um jogador da mesa (Function gmCreateCharacter). */
  public async createCharacterForAccount(uid: string, codinome: string, campaignId?: string): Promise<string> {
    const scope = requireTenantScope();
    const data = await callFunction<Record<string, unknown>, { characterId: string }>("gmCreateCharacter", {
      wsId: scope.wsId,
      uid,
      codinome: codinome.trim(),
      ...(campaignId ? { campaignId } : {}),
    });
    return data.characterId;
  }

  /** Dono move um agente para outro jogador da mesma mesa (Function transferCharacter). */
  public async transferCharacter(fromUid: string, toUid: string, characterId: string): Promise<void> {
    const scope = requireTenantScope();
    await callFunction("transferCharacter", { wsId: scope.wsId, fromUid, toUid, characterId });
  }

  /** Soft-delete: archived=true em vez de apagar o agente. */
  public async archiveCharacter(uid: string, characterId: string, archived = true): Promise<void> {
    await updateDoc(doc(db, "users", uid, "characters", characterId), { archived });
  }

  /**
   * Agentes com a conta (roster) de cada um, para seleção por agente (esquadrões).
   */
  public async fetchAllCharactersWithAccounts(): Promise<{ account: MasterAccount; character: CharacterData }[]> {
    const [rosterDocs, characters] = await Promise.all([
      getScopedDocs("players", "list"),
      this.fetchScopedCharacters(),
    ]);
    const accounts = new Map(rosterDocs.map((d) => [d.id, rosterToAccount(d.id, d.data())]));
    return characters
      .filter(({ uid }) => accounts.has(uid))
      .map(({ uid, char }) => ({ account: accounts.get(uid)!, character: char }));
  }

  public async generateUserBackup(account: MasterAccount, character: CharacterData): Promise<string> {
    const details = await this.loadUserDetails(account.uid, character.id);
    const achSnap = await getDocs(collection(db, "users", account.uid, "characters", character.id, "achievements"));
    const achievements = achSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const backup = {
      exportedAt: new Date().toISOString(),
      account: {
        ...account,
        lastLogin: account.lastLogin?.toDate?.()?.toISOString?.() || null,
        createdAt: account.createdAt?.toDate?.()?.toISOString?.() || null,
      },
      character: {
        ...character,
        createdAt: character.createdAt?.toDate?.()?.toISOString?.() || null,
      },
      intel: details.intel,
      achievements,
      playEvents: details.playCounts,
      stats: details.stats,
    };
    return JSON.stringify(backup, null, 2);
  }
}

export const userService = UserService.getInstance();
