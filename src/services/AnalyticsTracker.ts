import type { PlayerData, PlayerStats } from '../types/player';
import type { IntelItem } from '../types/intel';
import { recordPlayEvent, markPlayEventCompleted, firestoreUpdateStats, firestoreGrantAchievements } from '../store/firestore';
import { checkNewAchievements } from '../data/achievements';
import {
  achievementManager,
  achievementGrantDocId,
  isAchievementEarned,
  type Achievement,
  type PlayerPlatform,
} from './AchievementManager';
import { achievementSfx } from './AchievementSfx';
import { resolveCampaignPlatform } from '../data/campaigns';
import { intelRegistry } from '../data/intel_registry';
import type { Toast } from '../components/ToastNotification';
import { activityLogger } from './ActivityLogger';
import { auth } from '../lib/firebase';
import { firebaseAnalytics } from './FirebaseAnalyticsService';

export class AnalyticsTracker {
  private static instance: AnalyticsTracker;
  private listenTimer: number | null = null;
  private syncTimer: number | null = null;
  private activePlayEventId: string | null = null;
  private activeTapeId: string | null = null;
  private currentVolume: number = 80;
  
  private localStats: PlayerStats | null = null;
  private playerData: PlayerData | null = null;
  
  private onStatsSync: ((stats: PlayerStats, data: PlayerData) => void) | null = null;
  private onToast: ((toast: Omit<Toast, 'id'>) => void) | null = null;

  private constructor() {}

  public static getInstance(): AnalyticsTracker {
    if (!AnalyticsTracker.instance) {
      AnalyticsTracker.instance = new AnalyticsTracker();
    }
    return AnalyticsTracker.instance;
  }

  public init(
    playerData: PlayerData, 
    initialStats: PlayerStats, 
    onStatsSync: (stats: PlayerStats, data: PlayerData) => void,
    onToast: (toast: Omit<Toast, 'id'>) => void
  ) {
    this.playerData = playerData;
    this.localStats = initialStats;
    this.onStatsSync = onStatsSync;
    this.onToast = onToast;
    
    activityLogger.setUser(playerData.uid, playerData.character.codinome, playerData.activeCharacterId);
    
    firebaseAnalytics.init().then(() => {
      firebaseAnalytics.setUser(playerData.uid, playerData.activeCharacterId, playerData.character.codinome);
    });
    
    this.startBackgroundSync();
  }

  public setVolume(vol: number) {
    this.currentVolume = vol;
  }

  public updatePlayerData(data: PlayerData) {
    this.playerData = data;
    if (data.uid && data.character?.codinome) {
        activityLogger.setUser(data.uid, data.character.codinome, data.activeCharacterId);
    }
  }

  public incrementStat(key: keyof PlayerStats, amount = 1) {
    if (!this.localStats) return;
    this.localStats[key] = (this.localStats[key] as number) + amount;
    this.syncLocalChanges();
    this.checkAchievements();
    
    if (key === 'fidgetClicks' && typeof window !== 'undefined' && window.navigator?.vibrate) {
      try { window.navigator.vibrate(50); } catch(e) {}
    }
  }

  /** Seta flag one-shot (0→1) e reavalia conquistas. Idempotente. */
  public markFlag(key: keyof PlayerStats) {
    if (!this.localStats) return;
    if ((this.localStats[key] as number) >= 1) {
      this.checkAchievements();
      return;
    }
    this.localStats[key] = 1;
    this.syncLocalChanges();
    this.forceSyncToServer();
    this.checkAchievements();
  }

  /** Atualiza contador absoluto (ex.: threads lidas) e reavalia. */
  public setStat(key: keyof PlayerStats, value: number) {
    if (!this.localStats) return;
    if ((this.localStats[key] as number) === value) {
      this.checkAchievements();
      return;
    }
    this.localStats[key] = value;
    this.syncLocalChanges();
    this.forceSyncToServer();
    this.checkAchievements();
  }

  public startPlayback(intel: IntelItem) {
    if (!this.playerData) return;

    const isResume = this.activePlayEventId !== null && this.activeTapeId === intel.id;
    if (!isResume) {
      this.activeTapeId = intel.id;
      this.activePlayEventId = null;
      recordPlayEvent(this.playerData.uid, this.playerData.activeCharacterId, intel.id)
        .then(id => {
          if (this.activeTapeId === intel.id) this.activePlayEventId = id;
        })
        .catch(console.error);

      activityLogger.logAction('tape_play', `Iniciou reprodução: ${intel.title}`, { intelId: intel.id });

      firebaseAnalytics.logTapePlay(
        intel.id, 
        intel.type || 'AUDIO', 
        this.playerData.character?.campaignId
      );
    }
    
    if (this.listenTimer) clearInterval(this.listenTimer);
    this.listenTimer = window.setInterval(() => this.tick(), 5000);
  }

  public pausePlayback() {
    if (this.listenTimer) clearInterval(this.listenTimer);
  }

  /** Encerra a reprodução ativa sem completar o playEvent (eject/troca de fita). */
  public abandonPlayback() {
    this.pausePlayback();
    this.activePlayEventId = null;
    this.activeTapeId = null;
  }

  public endPlayback() {
    this.pausePlayback();
    const completedEventId = this.activePlayEventId;
    if (completedEventId) {
      markPlayEventCompleted(completedEventId).catch(console.error);
      this.activePlayEventId = null;
    }
    this.activeTapeId = null;
    activityLogger.logAction('tape_end', 'Reprodução finalizada');
    
    if (this.localStats) {
      this.localStats.fullTapeListens += 1;
      firebaseAnalytics.logTapeCompleted(
        completedEventId || 'unknown',
        this.localStats.totalListenTime
      );
      this.syncLocalChanges();
      this.forceSyncToServer();
      this.checkAchievements();
    }
  }

  private tickCount = 0;

  private tick() {
    if (!this.localStats || !this.playerData) return;
    this.localStats.totalListenTime += 5;
    if (this.currentVolume === 100) this.localStats.maxVolumeTime += 5;
    if (this.currentVolume === 0) this.localStats.zeroVolumeTime += 5;
    
    this.tickCount++;
    if (this.tickCount % 6 === 0) {
      this.syncLocalChanges();
      this.checkAchievements();
    }
  }

  private syncLocalChanges() {
    if (this.onStatsSync && this.localStats && this.playerData) {
      this.onStatsSync({ ...this.localStats }, { ...this.playerData });
    }
  }

  public forceSyncToServer() {
    if (this.playerData && this.localStats) {
      const currentUser = auth.currentUser;
      if (!currentUser || currentUser.uid !== this.playerData.uid) {
        return;
      }
      firestoreUpdateStats(this.playerData.uid, this.playerData.activeCharacterId, this.localStats).catch(console.error);
    }
  }

  private startBackgroundSync() {
    if (this.syncTimer) clearInterval(this.syncTimer);
    this.syncTimer = window.setInterval(() => this.forceSyncToServer(), 60000);
  }

  public stopAll(skipSync = false) {
    this.pausePlayback();
    if (this.syncTimer) clearInterval(this.syncTimer);
    if (!skipSync) this.forceSyncToServer();
    this.activePlayEventId = null;
    this.activeTapeId = null;
    this.playerData = null;
    this.localStats = null;
    this.onStatsSync = null;
    this.onToast = null;
    activityLogger.clearUser();
    firebaseAnalytics.clearUser();
  }

  private resolveOwnedIntelForAchievements(): IntelItem[] {
    if (!this.playerData) return [];
    const ids = this.playerData.unlockedIntelIds;
    return intelRegistry.resolve(ids);
  }

  private resolveGrantScope(): { campaignId: string; platform: PlayerPlatform } {
    const campaignId = this.playerData?.character?.campaignId || 'unscoped';
    const device = resolveCampaignPlatform(this.playerData?.character?.campaignId);
    return { campaignId, platform: device };
  }

  private announceUnlock(ach: Achievement) {
    achievementSfx.playUnlock(ach.tier);
    if (this.onToast) {
      this.onToast({
        type: 'achievement',
        title: ach.title,
        subtitle: ach.description,
        icon: ach.icon,
        tier: ach.tier,
        platform: ach.primaryPlatform,
      });
    }
    firebaseAnalytics.logAchievementUnlocked(ach.id);
    activityLogger.logAction('achievement', `Conquista desbloqueada: ${ach.title}`, { achievementId: ach.id });
  }

  public checkAchievements(scanTimes: number[] = []) {
    if (!this.playerData || !this.localStats) return;
    const { campaignId, platform } = this.resolveGrantScope();
    const profile = { ...this.playerData, stats: this.localStats };
    const intelItems = this.resolveOwnedIntelForAchievements();
    const newAchievements = checkNewAchievements(
      profile,
      intelItems,
      scanTimes.length,
      campaignId,
      platform
    );

    if (newAchievements.length > 0) {
      const grantIds = newAchievements.map((a) => achievementGrantDocId(a.id, campaignId));
      firestoreGrantAchievements(
        this.playerData.uid,
        this.playerData.activeCharacterId,
        newAchievements.map((a) => a.id),
        { campaignId, platform }
      ).catch((err) => console.warn('[AnalyticsTracker] Failed to grant achievements:', err));

      this.forceSyncToServer();
      newAchievements.forEach((ach) => this.announceUnlock(ach));
      this.playerData.achievementIds = [...this.playerData.achievementIds, ...grantIds];
      this.syncLocalChanges();
    }
  }

  public grantAchievement(id: string) {
    if (!this.playerData || !this.localStats) return;
    const { campaignId, platform } = this.resolveGrantScope();
    if (isAchievementEarned(this.playerData.achievementIds, id, campaignId)) return;

    const ach = achievementManager.getAchievement(id);
    const grantId = achievementGrantDocId(id, campaignId);

    firestoreGrantAchievements(this.playerData.uid, this.playerData.activeCharacterId, [id], {
      campaignId,
      platform: ach?.primaryPlatform || platform,
    }).catch((err) => console.warn('[AnalyticsTracker] Failed to grant achievement:', err));

    this.playerData.achievementIds = [...this.playerData.achievementIds, grantId];

    if (ach) {
      this.announceUnlock(ach);
    } else if (this.onToast) {
      achievementSfx.playUnlock('common');
      this.onToast({
        type: 'achievement',
        title: 'Nova Medalha',
        subtitle: id,
        icon: '/achievements/ACH-VETERAN.png',
        tier: 'common',
        platform: 'global',
      });
    }

    this.syncLocalChanges();
    this.forceSyncToServer();
  }
}

export const analyticsTracker = AnalyticsTracker.getInstance();
