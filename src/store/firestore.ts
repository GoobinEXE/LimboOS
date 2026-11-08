import {
  doc,
  getDoc,
  setDoc,
  addDoc,
  collection,
  getDocs,
  serverTimestamp,
  deleteDoc,
  writeBatch,
  runTransaction,
  query,
  orderBy,
  where,
  onSnapshot,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage, db } from '../lib/firebase';
import { callFunction } from '../lib/functions';
import {
  campaignStateDoc,
  functionScopeArgs,
  getScopedDocs,
  getTenantScope,
  requireTenantScope,
  subscribeScoped,
  wsCollection,
  wsDoc,
} from '../lib/tenantScope';
import { isValidSpotifyPlaylistInput } from '../lib/spotify';
import { 
  PlayerData, 
  PlayerStats, 
  MasterAccount,
  CharacterData,
  LimboGlobalState, 
  GalleryImage, 
  GalleryCategory,
  QrRedirect
} from '../types/player';
import type { IntelItem } from '../types/intel';

const PROFILE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const PROFILE_PHOTO_MIME = /^image\/(jpeg|jpg|png|webp|gif)$/i;

const DEFAULT_STATS: PlayerStats = {
  totalListenTime: 0,
  screwClicks: 0,
  fidgetClicks: 0,
  ejectWithoutPlay: 0,
  maxVolumeTime: 0,
  zeroVolumeTime: 0,
  biosOpened: 0,
  win95Opened: 0,
  macosOpened: 0,
  fullTapeListens: 0,
  threadsReadCount: 0,
  archiveOpened: 0,
  modeSwitches: 0,
};

// --- Admin Types ---
export interface PlayerMeta extends MasterAccount {
  username?: string;
  forceTerminalOpen?: boolean;
  forceMacOpen?: boolean;
}

// --- Account Management ---

export async function loadMasterAccount(uid: string): Promise<MasterAccount> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) {
    throw new Error('Account not found');
  }
  const data = snap.data();
  return {
    uid,
    email: data?.email || '',
    masterName: data?.masterName || data?.displayName || 'Agente',
    role: data?.role || 'player',
    createdAt: data?.createdAt || null,
    ...data
  } as MasterAccount;
}

const DEFAULT_WAIT_FOR_USER_DOC_MS = 8000;

/**
 * Aguarda o perfil users/{uid} ser criado pelo trigger server-side (onAuthUserCreated).
 */
export function waitForUserDoc(uid: string, timeoutMs = DEFAULT_WAIT_FOR_USER_DOC_MS): Promise<void> {
  return new Promise((resolve, reject) => {
    const ref = doc(db, 'users', uid);
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      unsub();
      reject(new Error('Timeout aguardando criação do perfil.'));
    }, timeoutMs);

    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (settled) return;
        if (snap.exists()) {
          settled = true;
          clearTimeout(timer);
          unsub();
          resolve();
        }
      },
      (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        unsub();
        reject(err);
      },
    );
  });
}

/** Nome de exibição da própria conta (o jogador é o único que altera a conta). */
export async function updateOwnDisplayName(uid: string, displayName: string): Promise<void> {
  await setDoc(doc(db, 'users', uid), { displayName }, { merge: true });
}

/** Mesas em que a conta joga (índice escrito pelas Functions de convite). */
export async function fetchPlayerMemberships(uid: string): Promise<{ wsId: string; workspaceName: string }[]> {
  const snap = await getDocs(collection(db, 'users', uid, 'memberships'));
  return snap.docs
    .filter((d) => d.data().isPlayer === true)
    .map((d) => ({ wsId: d.id, workspaceName: String(d.data().workspaceName || '') }));
}

export async function updateLastLogin(uid: string): Promise<void> {
  await setDoc(doc(db, 'users', uid), {
    lastLogin: serverTimestamp(),
  }, { merge: true });
}

// --- Character Management ---

export async function fetchCharacters(uid: string): Promise<CharacterData[]> {
  if (!uid) return [];
  const snap = await getDocs(query(collection(db, 'users', uid, 'characters'), orderBy('createdAt', 'desc')));
  return snap.docs
    .map(d => ({ ...d.data(), id: d.id } as CharacterData))
    .filter(c => !c.archived);
}

/**
 * Novo agente numa mesa onde a conta já joga (roster da pasta). O primeiro agente
 * de uma mesa nasce pelo convite (Function acceptInvite).
 */
export async function createCharacter(uid: string, codinome: string, workspaceId: string): Promise<CharacterData> {
  if (!uid) throw new Error('Cannot create character without UID');
  if (!workspaceId) throw new Error('Escolha a mesa do novo agente.');
  const charId = `${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
  const charData: Omit<CharacterData, 'id'> = {
    codinome,
    agentStatus: 'vivo',
    dangerLevel: 1,
    archived: false,
    workspaceId,
    createdAt: serverTimestamp() as any,
  };
  await setDoc(doc(db, 'users', uid, 'characters', charId), charData);
  return { id: charId, ...charData } as CharacterData;
}

export async function loadPlayerData(uid: string, characterId: string): Promise<PlayerData> {
  if (!uid || !characterId) throw new Error('LoadPlayerData failed: Missing identifiers');
  
  const [accountSnap, charSnap, statsSnap, achievementsSnap, intelSnap] = await Promise.all([
    getDoc(doc(db, 'users', uid)),
    getDoc(doc(db, 'users', uid, 'characters', characterId)),
    getDoc(doc(db, 'users', uid, 'characters', characterId, 'stats', 'main')),
    getDocs(collection(db, 'users', uid, 'characters', characterId, 'achievements')),
    getDocs(collection(db, 'users', uid, 'characters', characterId, 'intel'))
  ]);

  if (!accountSnap.exists() || !charSnap.exists()) {
    throw new Error('Data integrity failure: Account or Character missing');
  }

  const accountData = accountSnap.data();
  const account: MasterAccount = {
    uid,
    email: accountData?.email || '',
    masterName: accountData?.masterName || accountData?.displayName || 'Agente',
    role: accountData?.role || 'player',
    createdAt: accountData?.createdAt || null,
    ...accountData
  };
  const character = { ...charSnap.data(), id: characterId } as CharacterData;
  const stats = statsSnap.exists() ? { ...DEFAULT_STATS, ...(statsSnap.data() as Partial<PlayerStats>) } : DEFAULT_STATS;

  return {
    ...account,
    // Acesso de hardware é do agente (o mestre não altera a conta do jogador).
    hasTerminalAccess: !!character.hasTerminalAccess,
    hasMacAccess: !!character.hasMacAccess,
    activeCharacterId: characterId,
    character,
    achievementIds: achievementsSnap.docs.map((d) => d.id),
    stats,
    unlockedIntelIds: intelSnap.docs.map((d) => d.id).sort(),
  };
}

/**
 * Define a pasta ativa do jogador a partir da mesa do agente e do roster dela
 * (campanhas em que joga). O PlayerSyncService mantém isso atualizado depois.
 */
export async function establishPlayerScope(uid: string, character: CharacterData): Promise<void> {
  const { setTenantScope } = await import('../lib/tenantScope');
  const wsId = character.workspaceId;
  if (!wsId) {
    setTenantScope(null);
    return;
  }
  let rosterCampaigns: string[] = [];
  try {
    const roster = await getDoc(doc(db, 'workspaces', wsId, 'players', uid));
    rosterCampaigns = roster.exists() && Array.isArray(roster.data().campaignIds) ? roster.data().campaignIds : [];
  } catch (err) {
    console.warn('[firestore] roster read failed:', err);
  }
  setTenantScope({
    wsId,
    role: 'player',
    campaignIds: Array.from(new Set([...rosterCampaigns, ...(character.campaignId ? [character.campaignId] : [])])),
    characterId: character.id,
    activeCampaignId: character.campaignId,
    actorUid: uid,
  });
}

// --- Character Progress ---

export async function firestoreUnlockIntel(
  uid: string,
  characterId: string,
  intelId: string,
  campaignId?: string,
  sourceCode?: string,
): Promise<void> {
  await callFunction('unlockIntel', {
    characterId,
    intelId,
    campaignId: campaignId || null,
    targetUid: uid,
    ...(sourceCode ? { sourceCode } : {}),
  });
}

export async function firestoreGrantAchievements(
  uid: string,
  characterId: string,
  achievementIds: string[],
  options?: { campaignId?: string; platform?: string }
): Promise<void> {
  if (achievementIds.length === 0) return;
  await callFunction('grantAchievements', {
    characterId,
    achievementIds,
    targetUid: uid,
    campaignId: options?.campaignId || 'unscoped',
    platform: options?.platform || 'walkman',
  });
}

export async function firestoreUpdateStats(uid: string, characterId: string, statsDelta: Partial<PlayerStats>): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'characters', characterId, 'stats', 'main'), statsDelta, { merge: true });
}

export async function firestoreUpdateSpotifyPlaylist(uid: string, characterId: string, url: string): Promise<void> {
  const trimmed = url.trim();
  if (!isValidSpotifyPlaylistInput(trimmed)) {
    throw new Error('URL Spotify inválida');
  }
  await setDoc(doc(db, 'users', uid, 'characters', characterId), { spotifyPlaylistUrl: trimmed }, { merge: true });
}

export async function firestoreUpdatePhoneNumber(uid: string, characterId: string, phoneNumber: string): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'characters', characterId), { phoneNumber }, { merge: true });
}

export async function firestoreSetCampaign(uid: string, characterId: string, campaignId: string): Promise<void> {
  await callFunction('setCharacterCampaign', {
    characterId,
    campaignId,
    targetUid: uid,
  });
}

export async function updateAgentStatus(uid: string, characterId: string, status: 'vivo' | 'morto' | 'desaparecido'): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'characters', characterId), { agentStatus: status }, { merge: true });
}

export async function updateDangerLevel(uid: string, characterId: string, level: number): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'characters', characterId), { dangerLevel: Math.max(1, Math.min(5, level)) }, { merge: true });
}

export async function updateCodinome(uid: string, characterId: string, newCodinome: string): Promise<void> {
  const trimmed = newCodinome.trim();
  if (!trimmed) return;
  await setDoc(doc(db, 'users', uid, 'characters', characterId), { codinome: trimmed }, { merge: true });
}

// --- Profile Photos ---

export async function uploadProfilePhoto(uid: string, characterId: string, file: File): Promise<{ url: string }> {
  if (!PROFILE_PHOTO_MIME.test(file.type)) {
    throw new Error('Tipo de arquivo inválido. Use JPEG, PNG, WebP ou GIF.');
  }
  if (file.size > PROFILE_PHOTO_MAX_BYTES) {
    throw new Error('Imagem muito grande. Máximo 5MB.');
  }
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  const photoId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeName}`;
  const storageRef = ref(storage, `profilePhotos/${uid}/${characterId}/${photoId}`);
  await uploadBytes(storageRef, file, { contentType: file.type });
  const url = await getDownloadURL(storageRef);
  await setDoc(doc(db, 'users', uid, 'characters', characterId), { profilePhotoUrl: url }, { merge: true });
  return { url };
}

// --- Acesso de hardware e estado da campanha ---

/** Agente alvo de uma ação do mestre. */
export interface CharacterTarget {
  uid: string;
  characterId: string;
}

/** Libera/força o DOS nos agentes (antes era na conta; a conta é do jogador). */
export async function setTerminalStateForCharacters(targets: CharacterTarget[], force: boolean, grant: boolean): Promise<void> {
  const batch = writeBatch(db);
  targets.forEach(({ uid, characterId }) => {
    batch.set(doc(db, 'users', uid, 'characters', characterId), {
      forceTerminalOpen: force,
      hasTerminalAccess: grant,
    }, { merge: true });
  });
  await batch.commit();
}

export async function setMacStateForCharacters(targets: CharacterTarget[], force: boolean, grant: boolean): Promise<void> {
  const batch = writeBatch(db);
  targets.forEach(({ uid, characterId }) => {
    batch.set(doc(db, 'users', uid, 'characters', characterId), {
      forceMacOpen: force,
      hasMacAccess: grant,
    }, { merge: true });
  });
  await batch.commit();
}

export async function checkTerminalClosed(uid: string, characterId?: string): Promise<void> {
  if (characterId) {
    await setDoc(
      doc(db, 'users', uid, 'characters', characterId),
      { forceTerminalOpen: false },
      { merge: true }
    );
  }
}

export async function checkMacClosed(uid: string, characterId?: string): Promise<void> {
  if (characterId) {
    await setDoc(
      doc(db, 'users', uid, 'characters', characterId),
      { forceMacOpen: false },
      { merge: true }
    );
  }
}

/** Tomada militar do Limbo numa campanha (antes era global para todas as mesas). */
export async function setLimboMilitarySeizure(campaignId: string, seized: boolean): Promise<void> {
  const scope = requireTenantScope();
  await setDoc(campaignStateDoc(campaignId, 'live'), {
    seized,
    seizedAt: seized ? serverTimestamp() : null,
    seizedBy: seized ? (scope.actorName || scope.actorUid || null) : null,
  }, { merge: true });
}

export async function fetchLimboState(campaignId: string): Promise<LimboGlobalState> {
  const snap = await getDoc(campaignStateDoc(campaignId, 'live'));
  return snap.exists() ? (snap.data() as LimboGlobalState) : { seized: false };
}

/** Liberação do reparo de disco numa campanha (antes: system/gameEvents). */
export async function setDiskRepairAllowed(campaignId: string, allowed: boolean): Promise<void> {
  await setDoc(campaignStateDoc(campaignId, 'live'), { diskRepairAllowed: allowed }, { merge: true });
}

export async function firestoreMarkThreadRead(
  uid: string,
  characterId: string,
  threadId: string,
): Promise<void> {
  const charRef = doc(db, 'users', uid, 'characters', characterId);

  await runTransaction(db, async (transaction) => {
    const charSnap = await transaction.get(charRef);
    if (!charSnap.exists()) return;

    const charReadIds: string[] = charSnap.data().readThreadIds || [];
    if (!charReadIds.includes(threadId)) {
      transaction.set(charRef, { readThreadIds: [...charReadIds, threadId] }, { merge: true });
    }
  });
}

// --- Play Events & Media Utils ---

/** Registra a reprodução na pasta da mesa do agente (sem pasta ativa, não registra). */
export async function recordPlayEvent(
  uid: string,
  characterId: string,
  tapeId: string,
  campaignId?: string | null,
): Promise<string> {
  const scope = getTenantScope();
  if (!scope) return '';
  const docRef = await addDoc(wsCollection('playEvents'), {
    uid,
    characterId,
    tapeId,
    campaignId: campaignId || scope.activeCampaignId || null,
    playedAt: serverTimestamp(),
    completed: false,
  });
  return docRef.id;
}

export async function markPlayEventCompleted(eventId: string): Promise<void> {
  if (!eventId || !getTenantScope()) return;
  await setDoc(wsDoc('playEvents', eventId), { completed: true }, { merge: true });
}

export async function generateAgentId(uid: string, characterId: string): Promise<string> {
  const charRef = doc(db, 'users', uid, 'characters', characterId);
  const snap = await getDoc(charRef);
  if (snap.exists() && snap.data().agentId) return snap.data().agentId;
  const agentId = Array.from(crypto.getRandomValues(new Uint8Array(3))).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  await setDoc(charRef, { agentId }, { merge: true });
  return agentId;
}

export async function fetchAudioTapeById(
  audioId: string,
  options?: { characterId?: string; forUnlockResolve?: boolean },
) {
  if (options?.forUnlockResolve) {
    const result = await callFunction<Record<string, unknown>, {
      asset: Record<string, unknown> | null;
    }>('resolveIntelCode', { code: audioId, ...functionScopeArgs() });
    return result.asset ? { id: String(result.asset.id || audioId), ...result.asset } : null;
  }

  if (options?.characterId) {
    const result = await callFunction<
      { characterId: string; assetIds: string[] },
      { assets: Array<Record<string, unknown>> }
    >('getMediaAssetsByIds', {
      characterId: options.characterId,
      assetIds: [audioId],
    });
    const asset = result.assets?.[0];
    return asset ? { id: String(asset.id || audioId), ...asset } : null;
  }

  // Mestre: item da pasta ativa (co-mestre só lê o que é das campanhas dele).
  const snap = await getDoc(wsDoc('mediaAssets', audioId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function fetchAudioTapesByIds(
  audioIds: string[],
  options?: { characterId?: string },
) {
  if (audioIds.length === 0) return [];

  if (options?.characterId) {
    const audios: any[] = [];
    for (let i = 0; i < audioIds.length; i += 50) {
      const chunk = audioIds.slice(i, i + 50);
      const result = await callFunction<
        { characterId: string; assetIds: string[] },
        { assets: Array<Record<string, unknown>> }
      >('getMediaAssetsByIds', {
        characterId: options.characterId,
        assetIds: chunk,
      });
      (result.assets || []).forEach((asset) => {
        audios.push({ id: asset.id, ...asset });
      });
    }
    return audios;
  }

  // Mestre: a Function filtra pelo acesso (consulta por id não é provável nas regras do co-mestre).
  const audios: any[] = [];
  const scopeArgs = functionScopeArgs();
  for (let i = 0; i < audioIds.length; i += 50) {
    const chunk = audioIds.slice(i, i + 50);
    const result = await callFunction<Record<string, unknown>, { assets: Array<Record<string, unknown>> }>(
      'getMediaAssetsByIds',
      { ...scopeArgs, assetIds: chunk },
    );
    (result.assets || []).forEach((asset) => audios.push({ id: asset.id, ...asset }));
  }
  return audios;
}

export async function fetchAllMediaAssets() {
  const docs = await getScopedDocs('mediaAssets', 'single');
  return docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Persiste alterações de um IntelItem de volta para o Firebase.
 */
export async function updateRemoteIntel(item: IntelItem): Promise<void> {
  const docRef = wsDoc('mediaAssets', item.id);

  // setDoc merge substitui o mapa `metadata` inteiro — preservar tags de pastas da biblioteca
  const existingSnap = await getDoc(docRef);
  const existingTags = existingSnap.exists()
    ? (existingSnap.data()?.metadata?.tags as string[] | undefined)
    : undefined;

  let rawType = 'other';
  if (item.type === 'AUDIO') {
    rawType = 'audio';
  } else if (item.type === 'VIDEO') {
    rawType = 'video';
  } else if (item.type === 'VISUAL') {
    rawType = 'image';
  } else if (item.type === 'TEXT') {
    rawType = 'text';
  } else if (item.type === 'META') {
    rawType = 'meta';
  }

  const metadata: any = {
    level: item.level,
    title: item.title,
    description: item.description,
  };

  if (item.metadata) {
    if (item.metadata.npc !== undefined) metadata.npc = item.metadata.npc;
    if (item.metadata.artist !== undefined) metadata.artist = item.metadata.artist;
    if (item.metadata.chapter !== undefined) metadata.chapter = item.metadata.chapter;
    if (item.metadata.duration !== undefined) metadata.duration = item.metadata.duration;
    if (item.metadata.isSecret !== undefined) metadata.isSecret = item.metadata.isSecret;
    if (item.metadata.visualCategory !== undefined) metadata.category = item.metadata.visualCategory;
    if (item.metadata.imageUrl !== undefined) metadata.imageUrl = item.metadata.imageUrl;
    if (item.metadata.icon !== undefined) metadata.icon = item.metadata.icon;
    if (item.metadata.hint !== undefined) metadata.hint = item.metadata.hint;
    if (item.metadata.unlockCondition !== undefined) metadata.unlockCondition = item.metadata.unlockCondition;
    if (item.metadata.achievementRuleId !== undefined) metadata.achievementRuleId = item.metadata.achievementRuleId;
    if (item.metadata.videoFormat !== undefined) metadata.videoFormat = item.metadata.videoFormat;
    if (item.metadata.videoSource !== undefined) metadata.videoSource = item.metadata.videoSource;
    if (item.metadata.youtubeId !== undefined) metadata.youtubeId = item.metadata.youtubeId;
  }

  if (existingTags && existingTags.length > 0) {
    metadata.tags = existingTags;
  }

  const updateData: any = {
    type: rawType,
    campaignId: item.campaignId || null,
    metadata,
  };

  if (item.mediaUrl) {
    updateData.url = item.mediaUrl;
  }
  if (item.textContent) {
    updateData.textContent = item.textContent;
  }

  await setDoc(docRef, updateData, { merge: true });
}

export async function fetchQrRedirect(sourceId: string): Promise<string | null> {
  const result = await callFunction<Record<string, unknown>, { targetId: string | null }>(
    'fetchQrRedirect',
    { sourceId, ...functionScopeArgs() },
  );
  return result.targetId || null;
}

export async function fetchAllQrRedirects(): Promise<QrRedirect[]> {
  const docs = await getScopedDocs('qrRedirects', 'single');
  return docs.map(d => ({ sourceId: d.id, ...d.data() } as QrRedirect));
}

export function subscribeToQrRedirects(callback: (redirects: QrRedirect[]) => void): () => void {
  return subscribeScoped('qrRedirects', 'single', [], (docs) => {
    callback(docs.map(d => ({ sourceId: d.id, ...d.data() } as QrRedirect)));
  }, (err) => console.warn('[Firestore] subscribeToQrRedirects error:', err));
}

/**
 * Redirect de QR na pasta. A campanha decide quem enxerga: sem campanha, só o
 * dono; co-mestre grava sempre numa campanha dele.
 */
export async function saveQrRedirect(
  sourceId: string,
  targetId: string,
  reason?: string,
  campaignId?: string | null,
): Promise<void> {
  const scope = requireTenantScope();
  const resolved = campaignId
    ?? (scope.campaignIds === null ? null : scope.campaignIds[0] ?? null);
  await setDoc(wsDoc('qrRedirects', sourceId), {
    targetId,
    reason: reason || '',
    campaignId: resolved,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteQrRedirect(sourceId: string): Promise<void> {
  await deleteDoc(wsDoc('qrRedirects', sourceId));
}

// --- Remote Video Broadcast (Admin → Player) ---

export interface VideoBroadcastTarget {
  uid: string;
  characterId: string;
}

/**
 * Envia comando de reprodução de vídeo para personagens selecionados.
 * Opcionalmente desbloqueia o intel antes de transmitir.
 */
export async function broadcastVideoToCharacters(
  targets: VideoBroadcastTarget[],
  intelId: string,
  options?: { grantIntel?: boolean; campaignId?: string }
): Promise<string> {
  if (targets.length === 0) return '';
  const requestId = crypto.randomUUID();
  const batch = writeBatch(db);
  const workspaceId = getTenantScope()?.wsId ?? null;

  targets.forEach(({ uid, characterId }) => {
    if (options?.grantIntel) {
      const intelRef = doc(db, 'users', uid, 'characters', characterId, 'intel', intelId);
      batch.set(intelRef, {
        intelId,
        unlockedAt: serverTimestamp(),
        campaignId: options.campaignId || null,
        workspaceId,
      }, { merge: true });
    }
    batch.set(doc(db, 'users', uid, 'characters', characterId), {
      pendingVideoPlay: {
        intelId,
        requestId,
        triggeredAt: serverTimestamp(),
      },
    }, { merge: true });
  });

  await batch.commit();
  return requestId;
}

export async function clearPendingVideoPlay(uid: string, characterId: string): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'characters', characterId), {
    pendingVideoPlay: null,
  }, { merge: true });
}

// Re-export types used by admin panels
export type { GalleryImage, GalleryCategory, LimboGlobalState } from '../types/player';
