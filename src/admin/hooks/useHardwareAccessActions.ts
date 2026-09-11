import { useCallback, useState } from 'react';
import { setMacStateForUsers, setTerminalStateForUsers } from '../../store/firestore';
import { activityLogger } from '../../services/ActivityLogger';

export type HardwareKind = 'dos' | 'mac';

type BusyKey = string;

function busyKey(kind: HardwareKind, action: 'push' | 'revoke' | 'grant', uid?: string): BusyKey {
  return `${action}:${kind}:${uid ?? 'bulk'}`;
}

/**
 * Ações de hardware DOS/Mac por conta (UID).
 * Push = one-shot force + grant; grant = acesso sem empurrar; revoke = tira acesso e limpa force.
 */
export function useHardwareAccessActions() {
  const [busy, setBusy] = useState<Set<BusyKey>>(new Set());

  const withBusy = useCallback(async (key: BusyKey, fn: () => Promise<void>) => {
    setBusy((prev) => new Set(prev).add(key));
    try {
      await fn();
    } finally {
      setBusy((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }, []);

  const isBusy = useCallback(
    (kind: HardwareKind, action: 'push' | 'revoke' | 'grant', uid?: string) =>
      busy.has(busyKey(kind, action, uid)),
    [busy]
  );

  const pushDos = useCallback(
    async (uids: string[], label: string) => {
      if (uids.length === 0) return;
      const key = busyKey('dos', 'push', uids.length === 1 ? uids[0] : undefined);
      await withBusy(key, async () => {
        activityLogger.logTrace('force_terminal_step', `Empurrando DOS para ${uids.length} conta(s)...`);
        await setTerminalStateForUsers(uids, true, true);
        activityLogger.logAdmin('gm.mpg', 'force_terminal', `Empurrou DOS para: ${label}`, { uids });
      });
    },
    [withBusy]
  );

  const pushMac = useCallback(
    async (uids: string[], label: string) => {
      if (uids.length === 0) return;
      const key = busyKey('mac', 'push', uids.length === 1 ? uids[0] : undefined);
      await withBusy(key, async () => {
        activityLogger.logTrace('force_mac_step', `Empurrando Mac para ${uids.length} conta(s)...`);
        await setMacStateForUsers(uids, true, true);
        activityLogger.logAdmin('gm.mpg', 'force_mac', `Empurrou Mac para: ${label}`, { uids });
      });
    },
    [withBusy]
  );

  const grantDos = useCallback(
    async (uids: string[], grant: boolean, label: string) => {
      if (uids.length === 0) return;
      const action = grant ? 'grant' : 'revoke';
      const key = busyKey('dos', action, uids.length === 1 ? uids[0] : undefined);
      await withBusy(key, async () => {
        await setTerminalStateForUsers(uids, false, grant);
        activityLogger.logAdmin(
          'gm.mpg',
          grant ? 'grant_terminal' : 'revoke_terminal',
          `${grant ? 'Liberou' : 'Revogou'} acesso DOS: ${label}`,
          { uids }
        );
      });
    },
    [withBusy]
  );

  const grantMac = useCallback(
    async (uids: string[], grant: boolean, label: string) => {
      if (uids.length === 0) return;
      const action = grant ? 'grant' : 'revoke';
      const key = busyKey('mac', action, uids.length === 1 ? uids[0] : undefined);
      await withBusy(key, async () => {
        await setMacStateForUsers(uids, false, grant);
        activityLogger.logAdmin(
          'gm.mpg',
          grant ? 'grant_mac' : 'revoke_mac',
          `${grant ? 'Liberou' : 'Revogou'} acesso Mac: ${label}`,
          { uids }
        );
      });
    },
    [withBusy]
  );

  return { pushDos, pushMac, grantDos, grantMac, isBusy };
}

export const ONLINE_WINDOW_MS = 15 * 60 * 1000;
