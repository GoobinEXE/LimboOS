import { firestoreUnlockIntel } from '../store/firestore';
import { analyticsTracker } from './AnalyticsTracker';
import { activityLogger } from './ActivityLogger';

export type RepairPhase = 'idle' | 'reading' | 'corrupted' | 'repairing' | 'success' | 'fail';



/**
 * Reparo de disco. A liberação vem do estado da campanha ativa
 * (workspaces/{ws}/campaigns/{c}/state/live.diskRepairAllowed), lido pelo
 * PlayerSyncService junto com o estado do Limbo.
 */
class DiskRepairService {
  private diskRepairAllowed = false;

  constructor() {}

  /** Mantido para os chamadores antigos; o estado chega por setAllowed. */
  public init() {}

  public stop() {}

  public setAllowed(allowed: boolean) {
    this.diskRepairAllowed = allowed;
  }

  public async startAnalysis(uid: string, characterId: string, onProgress: (p: number) => void): Promise<void> {
    activityLogger.logAction('diskrepair', 'Iniciou análise de disquete');
    analyticsTracker.grantAchievement('ACH-REPAIR-APP');

    return new Promise((resolve) => {
      let p = 0;
      const interval = setInterval(() => {
        p += 15 + Math.random() * 20;
        if (p >= 100) {
          clearInterval(interval);
          analyticsTracker.grantAchievement('ACH-REPAIR-FAIL');
          firestoreUnlockIntel(uid, characterId, 'evidence-disk-01-corrupted').catch(console.error);
          resolve();
        } else {
          onProgress(p);
        }
      }, 400);
    });
  }

  public async startRepair(uid: string, characterId: string, onProgress: (p: number) => void): Promise<boolean> {
    activityLogger.logAction('diskrepair', 'Iniciou processo de reparo/desmagnetização');

    return new Promise((resolve) => {
      let p = 0;
      const interval = setInterval(() => {
        p += 5 + Math.random() * 10;
        if (p >= 100) {
          clearInterval(interval);
          const success = this.diskRepairAllowed;
          if (success) {
            analyticsTracker.grantAchievement('ACH-REPAIR-SUCCESS');
            firestoreUnlockIntel(uid, characterId, 'evidence-disk-01').catch(console.error);
          }
          resolve(success);
        } else {
          onProgress(p);
        }
      }, 300);
    });
  }


}

export const diskRepairService = new DiskRepairService();
