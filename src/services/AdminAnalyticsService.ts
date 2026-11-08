import { db } from "../lib/firebase";
import {
  collection,
  onSnapshot,
  getDocs,
  getDoc,
  collectionGroup,
  writeBatch,
  doc,
  query,
  where,
} from "firebase/firestore";
import { getScopedDocs, getTenantScope, isOwnerScope, subscribeScoped, wsDoc } from "../lib/tenantScope";
import { userService } from "./UserService";
import { getAllAchievements } from "../data/achievements";

export interface PlayEvent {
  uid: string;
  tapeId: string;
  playedAt: any;
  completed?: boolean;
}

export interface AudioMetadata {
  id: string;
  size: number;
  title?: string;
  originalName?: string;
}

export interface UserAchievement {
  achievementId: string;
}

import type { PlayerStats } from '../types/player';

export interface UserData {
  uid: string;
  displayName?: string;
  username?: string;
  email?: string;
  masterName?: string;
  createdAt?: any;
  lastLogin?: any;
}

export class AdminAnalyticsService {
  private static instance: AdminAnalyticsService;
  private constructor() {}

  public static getInstance(): AdminAnalyticsService {
    if (!AdminAnalyticsService.instance) {
      AdminAnalyticsService.instance = new AdminAnalyticsService();
    }
    return AdminAnalyticsService.instance;
  }

  /** Agregados da pasta (escritos pela Function aggregatePlayEvent). Só o dono lê. */
  public subscribeToAggregatedAnalytics(callback: (data: any) => void): () => void {
    if (!isOwnerScope()) {
      callback(null);
      return () => {};
    }
    return onSnapshot(wsDoc("stats", "analytics"), (snap) => {
      callback(snap.exists() ? snap.data() : null);
    }, (err) => console.warn('[AdminAnalyticsService] aggregated analytics listener error:', err));
  }

  /** stats/main de cada agente da mesa (co-mestre: das campanhas dele). */
  private async fetchCharacterStats(): Promise<{ uid: string; characterId: string; stats: PlayerStats }[]> {
    const characters = await new Promise<{ uid: string; char: { id: string } }[]>((resolve) => {
      const stop = userService.subscribeToAllCharacters((list) => {
        resolve(list);
        queueMicrotask(stop);
      });
    });
    const snaps = await Promise.all(
      characters.slice(0, 300).map(({ uid, char }) =>
        getDoc(doc(db, "users", uid, "characters", char.id, "stats", "main"))
          .then((snap) => ({ uid, characterId: char.id, snap }))
          .catch(() => null),
      ),
    );
    return snaps
      .filter((x): x is NonNullable<typeof x> => !!x && x.snap.exists())
      .map(({ uid, characterId, snap }) => ({ uid, characterId, stats: snap.data() as PlayerStats }));
  }

  /** Conquistas concedidas na pasta (collectionGroup com workspaceId; só o dono). */
  private async fetchWorkspaceAchievements(): Promise<UserAchievement[]> {
    const scope = getTenantScope();
    if (!scope || !isOwnerScope(scope)) return [];
    const snap = await getDocs(query(collectionGroup(db, "achievements"), where("workspaceId", "==", scope.wsId)));
    return snap.docs.map((d) => d.data() as UserAchievement);
  }

  /** Engajamento da mesa, calculado sob demanda a partir dos agentes. */
  public async fetchEngagementSnapshot(): Promise<{
    totalAchievements: number;
    totalScrews: number;
    totalFidgets: number;
    totalEjects: number;
  }> {
    try {
      const [achievements, stats] = await Promise.all([
        this.fetchWorkspaceAchievements(),
        this.fetchCharacterStats(),
      ]);
      return {
        totalAchievements: achievements.length,
        totalScrews: stats.reduce((acc, x) => acc + (x.stats.screwClicks || 0), 0),
        totalFidgets: stats.reduce((acc, x) => acc + (x.stats.fidgetClicks || 0), 0),
        totalEjects: stats.reduce((acc, x) => acc + (x.stats.ejectWithoutPlay || 0), 0),
      };
    } catch (err) {
      console.warn('[AdminAnalyticsService] fetchEngagementSnapshot:', err);
      return { totalAchievements: 0, totalScrews: 0, totalFidgets: 0, totalEjects: 0 };
    }
  }

  /** Dados brutos para o BI, todos da pasta ativa. */
  public subscribeToRawData(callback: (data: {
    playEvents: PlayEvent[];
    users: UserData[];
    audios: AudioMetadata[];
    unlockedAchievements: UserAchievement[];
    stats: PlayerStats[];
  }) => void): () => void {
    let users: UserData[] = [];
    let audios: AudioMetadata[] = [];
    let unlockedAchievements: UserAchievement[] = [];
    let stats: PlayerStats[] = [];
    let active = true;

    const notify = () => {
      if (active) callback({ playEvents: [], users, audios, unlockedAchievements, stats });
    };

    const stopUsers = userService.subscribeToUsers((list) => {
      users = list.map((u) => ({
        uid: u.uid,
        displayName: u.displayName,
        masterName: u.masterName,
        createdAt: u.createdAt,
        lastLogin: u.lastLogin,
      }));
      notify();
    });
    const stopAudios = subscribeScoped("mediaAssets", "single", [where("type", "==", "audio")], (docs) => {
      audios = docs.slice(0, 200).map((d) => {
        const data = d.data() as { size?: number; originalName?: string; metadata?: { title?: string } };
        return { id: d.id, size: data.size ?? 0, originalName: data.originalName, title: data.metadata?.title };
      });
      notify();
    }, (err) => console.warn('[AdminAnalyticsService] mediaAssets listener error:', err));

    void Promise.all([this.fetchWorkspaceAchievements(), this.fetchCharacterStats()])
      .then(([ach, st]) => {
        unlockedAchievements = ach;
        stats = st.map((x) => x.stats);
        notify();
      })
      .catch((err) => console.warn('[AdminAnalyticsService] raw data fetch error:', err));

    return () => {
      active = false;
      stopUsers();
      stopAudios();
    };
  }

  /** Zera o BI da pasta (dono): apaga playEvents e reinicia os stats dos agentes. */
  public async resetAnalytics(): Promise<void> {
    if (!isOwnerScope()) throw new Error('Só o dono da pasta zera as estatísticas.');
    const [events, stats] = await Promise.all([
      getScopedDocs('playEvents', 'single'),
      this.fetchCharacterStats(),
    ]);

    const empty: PlayerStats = {
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

    const ops: Array<(b: ReturnType<typeof writeBatch>) => void> = [];
    events.forEach((d) => ops.push((b) => b.delete(d.ref)));
    stats.forEach(({ uid, characterId }) =>
      ops.push((b) => b.set(doc(db, 'users', uid, 'characters', characterId, 'stats', 'main'), empty, { merge: true })));
    for (let i = 0; i < ops.length; i += 400) {
      const batch = writeBatch(db);
      ops.slice(i, i + 400).forEach((op) => op(batch));
      await batch.commit();
    }
  }

  public computeAnalytics(
    playEvents: PlayEvent[],
    users: UserData[],
    audios: AudioMetadata[],
    unlockedAchievements: UserAchievement[],
    stats: PlayerStats[]
  ) {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const activeUsers = users.filter((u) => {
      if (!u.lastLogin?.toDate) return false;
      return u.lastLogin.toDate() >= sevenDaysAgo;
    }).length;

    const tapePlayMap = new Map<string, number>();
    const userPlayMap = new Map<string, number>();
    const dailyPlays = new Map<string, number>();
    const hourMap = new Map<number, number>();
    const userTapePlays = new Map<string, number>();
    let completedPlays = 0;
    let maxObsessionCount = 0;

    // Initialize daily plays for the last 30 days
    for (let i = 0; i < 30; i++) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      dailyPlays.set(key, 0);
    }

    // Initialize hour map
    for (let i = 0; i < 24; i++) hourMap.set(i, 0);

    // Single pass over playEvents for multiple metrics
    playEvents.forEach((e) => {
      tapePlayMap.set(e.tapeId, (tapePlayMap.get(e.tapeId) ?? 0) + 1);
      userPlayMap.set(e.uid, (userPlayMap.get(e.uid) ?? 0) + 1);
      
      if (e.completed) completedPlays++;

      const obsessionKey = `${e.uid}_${e.tapeId}`;
      const obsCount = (userTapePlays.get(obsessionKey) ?? 0) + 1;
      userTapePlays.set(obsessionKey, obsCount);
      if (obsCount > maxObsessionCount) {
        maxObsessionCount = obsCount;
      }

      if (e.playedAt?.toDate) {
        const date = e.playedAt.toDate();
        const dateKey = date.toISOString().slice(0, 10);
        if (dailyPlays.has(dateKey)) {
          dailyPlays.set(dateKey, (dailyPlays.get(dateKey) ?? 0) + 1);
        }
        hourMap.set(date.getHours(), (hourMap.get(date.getHours()) ?? 0) + 1);
      }
    });

    const mostPlayed = Array.from(tapePlayMap.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);

    const mostActiveUsers = Array.from(userPlayMap.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([uid, count]) => {
        const user = users.find((u) => u.uid === uid);
        return { uid, name: user?.masterName || user?.email || user?.displayName || user?.username || 'Jogador desconhecido', count };
      });

    const dailyPlaysSorted = Array.from(dailyPlays.entries()).sort(([a], [b]) => a.localeCompare(b));
    const maxDailyPlays = Math.max(...dailyPlays.values(), 1);
    
    const peakHours = Array.from(hourMap.entries()).map(([h, count]) => ({ hour: h, count }));
    const maxHourCount = Math.max(...hourMap.values(), 1);

    const weeklyGrowth = new Map<string, number>();
    users.forEach((u) => {
      if (u.createdAt?.toDate) {
        const d = u.createdAt.toDate();
        const weekStart = new Date(d);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const key = weekStart.toISOString().slice(0, 10);
        weeklyGrowth.set(key, (weeklyGrowth.get(key) ?? 0) + 1);
      }
    });

    const achCountMap = new Map<string, number>();
    unlockedAchievements.forEach(a => {
      achCountMap.set(a.achievementId, (achCountMap.get(a.achievementId) ?? 0) + 1);
    });

    const rarityList = getAllAchievements().map(a => ({
      ...a,
      count: achCountMap.get(a.id) ?? 0,
      percentage: users.length > 0 ? ((achCountMap.get(a.id) ?? 0) / users.length) * 100 : 0
    })).sort((a, b) => a.count - b.count);

    const totalStorageSize = audios.reduce((acc, a) => acc + (a.size || 0), 0);
    const storagePercentage = (totalStorageSize / (5 * 1024 * 1024 * 1024)) * 100;

    const statsTotals = stats.reduce((acc, s) => ({
      totalListenTime: acc.totalListenTime + (s.totalListenTime || 0),
      screwClicks: acc.screwClicks + (s.screwClicks || 0),
      fidgetClicks: acc.fidgetClicks + (s.fidgetClicks || 0),
      ejectWithoutPlay: acc.ejectWithoutPlay + (s.ejectWithoutPlay || 0),
      maxVolumeTime: acc.maxVolumeTime + (s.maxVolumeTime || 0),
      zeroVolumeTime: acc.zeroVolumeTime + (s.zeroVolumeTime || 0),
      biosOpened: acc.biosOpened + (s.biosOpened || 0),
      win95Opened: acc.win95Opened + (s.win95Opened || 0),
      macosOpened: acc.macosOpened + (s.macosOpened || 0),
      fullTapeListens: acc.fullTapeListens + (s.fullTapeListens || 0),
      threadsReadCount: acc.threadsReadCount + (s.threadsReadCount || 0),
      archiveOpened: acc.archiveOpened + (s.archiveOpened || 0),
      modeSwitches: acc.modeSwitches + (s.modeSwitches || 0),
    }), {
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
    });

    return { 
      activeUsers, 
      mostPlayed, 
      mostActiveUsers, 
      dailyPlaysSorted, 
      maxDailyPlays, 
      weeklyGrowth,
      rarityList,
      peakHours,
      maxHourCount,
      completionRate: playEvents.length > 0 ? (completedPlays / playEvents.length) * 100 : 0,
      totalStorageSize,
      storagePercentage,
      totalListenSecs: statsTotals.totalListenTime,
      avgListenSecs: users.length > 0 ? statsTotals.totalListenTime / users.length : 0,
      totalScrews: statsTotals.screwClicks,
      totalFidgets: statsTotals.fidgetClicks,
      totalEjects: statsTotals.ejectWithoutPlay,
      totalMacVolSecs: statsTotals.maxVolumeTime,
      totalZeroVolSecs: statsTotals.zeroVolumeTime,
      maxObsessionCount,
      abandonRate: playEvents.length > 0 ? ((playEvents.length - completedPlays) / playEvents.length) * 100 : 0,
      totalAchievements: unlockedAchievements.length,
      totalPlays: playEvents.length,
      completedPlays,
    };
  }
}

export const adminAnalyticsService = AdminAnalyticsService.getInstance();
