import { collection, doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { isNetworkError } from '../lib/connectivity';
import { checkMacClosed, checkTerminalClosed } from '../store/firestore';
import { getTenantScope, setTenantScope } from '../lib/tenantScope';
import { activityLogger } from './ActivityLogger';
import { diskRepairService } from './DiskRepairService';
import type { PlayerData, LimboGlobalState, CharacterData } from '../types/player';
import type { AppScreen } from '../types/player';

const DOS_RELATED_SCREENS: ReadonlySet<AppScreen> = new Set(['bios', 'limbo', 'diskRepair', 'windows95']);

/** Evita ack duplicado quando listeners de conta e personagem disparam no mesmo tick. */
const pendingForceAcks = new Set<string>();

/**
 * Force flags are one-shot: open the screen once, then clear the flag so the
 * player can dismiss the app freely without being re-pushed while the GM panel
 * still shows a transient "pending" state.
 */
function applyOneShotForce(
  uid: string,
  characterId: string,
  kind: 'dos' | 'mac',
  onScreenChange: (screenSetter: (prev: AppScreen) => AppScreen) => void
) {
  onScreenChange((prev) => {
    if (kind === 'dos') {
      if (DOS_RELATED_SCREENS.has(prev)) return prev;
      activityLogger.logSystem('sync', 'Terminal forçado pelo servidor', {
        triggeredBy: 'forceTerminalOpen',
        characterId,
      });
      return 'bios';
    }
    if (prev === 'macos') return prev;
    activityLogger.logSystem('sync', 'MacOS forçado pelo servidor', {
      triggeredBy: 'forceMacOpen',
      characterId,
    });
    return 'macos';
  });

  const ackKey = `${uid}:${kind}`;
  if (pendingForceAcks.has(ackKey)) return;
  pendingForceAcks.add(ackKey);

  const ack =
    kind === 'dos' ? checkTerminalClosed(uid, characterId) : checkMacClosed(uid, characterId);
  void ack
    .catch((err) => {
      console.warn(`[PlayerSyncService] Falha ao confirmar force ${kind}:`, err);
    })
    .finally(() => {
      pendingForceAcks.delete(ackKey);
    });
}

/** Origem do listener que falhou. */
export type PlayerSyncSource = 'intel' | 'roster' | 'campaignState' | 'character' | 'achievements';

export interface PlayerSyncError {
  source: PlayerSyncSource;
  /** Código do Firestore (ex.: `unavailable`), quando existir. */
  code: string | null;
  /** Queda de rede ou serviço fora do ar (`isNetworkError`), em vez de recusa do servidor. */
  network: boolean;
  at: number;
}

export interface PlayerSyncCallbacks {
  /** Um listener encerrou com erro; o Firestore não o reabre sozinho. */
  onError?: (error: PlayerSyncError) => void;
  /** Um snapshot chegou com sucesso; limpa o aviso de erro. */
  onHealthy?: () => void;
}

export class PlayerSyncService {
  private static instance: PlayerSyncService;
  private unsubs: (() => void)[] = [];
  /** Muda a cada assinatura e a cada `stopAll`; callbacks de gerações antigas são descartados. */
  private generation = 0;
  private constructor() {}

  public static getInstance(): PlayerSyncService {
    if (!PlayerSyncService.instance) {
      PlayerSyncService.instance = new PlayerSyncService();
    }
    return PlayerSyncService.instance;
  }

  public subscribeToPlayerData(
    uid: string | undefined,
    characterId: string | undefined,
    onPlayerDataUpdate: (data: Partial<PlayerData>) => void,
    onScreenChange: (screenSetter: (prev: AppScreen) => AppScreen) => void,
    onLimboUpdate: (limboStatus: LimboGlobalState) => void,
    callbacks: PlayerSyncCallbacks = {}
  ) {
    this.stopAll();
    if (!uid || !characterId) return;

    const gen = this.generation;
    // Listener que falhou não volta sozinho: só uma nova assinatura limpa o erro, e o
    // snapshot de outro listener (intel, agente) não pode escondê-lo.
    let failed = false;
    const reportError = (source: PlayerSyncSource, error: unknown) => {
      console.warn(`[PlayerSyncService] ${source} error:`, error);
      // Listener de uma assinatura já cancelada (logout ou troca de agente).
      if (gen !== this.generation) return;
      const code = typeof (error as { code?: unknown })?.code === 'string' ? (error as { code: string }).code : null;
      // Sair da conta derruba o token antes do cancelamento: permission-denied não é falha de sinal.
      if (code === 'permission-denied' && !auth.currentUser) return;
      failed = true;
      callbacks.onError?.({ source, code, network: isNetworkError(error), at: Date.now() });
    };
    const reportHealthy = () => {
      if (gen === this.generation && !failed) callbacks.onHealthy?.();
    };

    // 1. Intel Listener — reads the unified 'intel' subcollection.

    let latestIntelIds: string[] = [];

    const emitIntelUpdate = () => {
      onPlayerDataUpdate({
        unlockedIntelIds: latestIntelIds,
      });
    };

    const unsubIntel = onSnapshot(collection(db, 'users', uid, 'characters', characterId, 'intel'),
      (snapshot) => {
        reportHealthy();
        latestIntelIds = snapshot.docs.map((d) => d.id).sort();
        emitIntelUpdate();
      },
      (error) => reportError('intel', error)
    );

    // 2. Agente: flags de hardware (vivem no agente), mesa e campanha ativa.
    //    A mesa (workspaceId) e o roster definem a pasta ativa do jogador.
    let currentWsId: string | null = null;
    let currentCampaignId: string | null = null;
    let rosterCampaigns: string[] = [];
    let unsubRoster: (() => void) | null = null;
    let unsubState: (() => void) | null = null;

    const applyScope = () => {
      if (!currentWsId) {
        if (getTenantScope()?.role === 'player') setTenantScope(null);
        return;
      }
      const campaignIds = Array.from(new Set([
        ...rosterCampaigns,
        ...(currentCampaignId ? [currentCampaignId] : []),
      ]));
      setTenantScope({
        wsId: currentWsId,
        role: 'player',
        campaignIds,
        characterId,
        activeCampaignId: currentCampaignId ?? undefined,
        actorUid: uid,
      });
      activityLogger.setCampaign(currentCampaignId);
    };

    const watchRoster = (wsId: string | null) => {
      unsubRoster?.();
      unsubRoster = null;
      rosterCampaigns = [];
      if (!wsId) return;
      unsubRoster = onSnapshot(doc(db, 'workspaces', wsId, 'players', uid),
        (snap) => {
          rosterCampaigns = snap.exists() && Array.isArray(snap.data().campaignIds) ? snap.data().campaignIds : [];
          applyScope();
        },
        (error) => reportError('roster', error)
      );
    };

    // 4. Estado da campanha ativa (Limbo e reparo de disco são por campanha).
    const watchCampaignState = (wsId: string | null, campaignId: string | null) => {
      unsubState?.();
      unsubState = null;
      if (!wsId || !campaignId) {
        onLimboUpdate({ seized: false });
        diskRepairService.setAllowed(false);
        return;
      }
      unsubState = onSnapshot(doc(db, 'workspaces', wsId, 'campaigns', campaignId, 'state', 'live'),
        (snap) => {
          const data = snap.exists() ? snap.data() : {};
          onLimboUpdate({ ...(data as LimboGlobalState), seized: !!data.seized });
          diskRepairService.setAllowed(!!data.diskRepairAllowed);
        },
        (error) => reportError('campaignState', error)
      );
    };

    const unsubChar = onSnapshot(doc(db, 'users', uid, 'characters', characterId),
      (snap) => {
        reportHealthy();
        if (snap.exists()) {
          const data = snap.data() as CharacterData;

          if (data.forceTerminalOpen) {
            applyOneShotForce(uid, characterId, 'dos', onScreenChange);
          } else if (data.forceMacOpen) {
            applyOneShotForce(uid, characterId, 'mac', onScreenChange);
          }

          const wsId = data.workspaceId || null;
          const campaignId = data.campaignId || null;
          if (wsId !== currentWsId) {
            currentWsId = wsId;
            currentCampaignId = campaignId;
            watchRoster(wsId);
            watchCampaignState(wsId, campaignId);
          } else if (campaignId !== currentCampaignId) {
            currentCampaignId = campaignId;
            watchCampaignState(wsId, campaignId);
          }
          applyScope();

          onPlayerDataUpdate({
            character: { ...data, id: characterId },
            hasTerminalAccess: !!data.hasTerminalAccess,
            hasMacAccess: !!data.hasMacAccess,
          });
        }
      },
      (error) => reportError('character', error)
    );

    // 5. Achievements — grants admin/remotos refletem sem reload
    const unsubAchievements = onSnapshot(
      collection(db, 'users', uid, 'characters', characterId, 'achievements'),
      (snapshot) => {
        onPlayerDataUpdate({
          achievementIds: snapshot.docs.map((d) => d.id),
        });
      },
      (error) => reportError('achievements', error)
    );

    this.unsubs.push(
      unsubIntel,
      unsubChar,
      () => unsubRoster?.(),
      () => unsubState?.(),
      unsubAchievements,
    );
  }

  public stopAll() {
    this.generation += 1;
    this.unsubs.forEach((unsub) => unsub());
    this.unsubs = [];
    if (getTenantScope()?.role === 'player') setTenantScope(null);
  }
}

export const playerSyncService = PlayerSyncService.getInstance();
