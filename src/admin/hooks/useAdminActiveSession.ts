import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'limboos.admin.activeSession';

export interface AdminActiveSession {
  groupId: string;
  campaignId: string;
}

function readStorage(): AdminActiveSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AdminActiveSession>;
    if (!parsed.groupId) return null;
    return {
      groupId: parsed.groupId,
      campaignId: parsed.campaignId || '',
    };
  } catch {
    return null;
  }
}

function writeStorage(session: AdminActiveSession | null): void {
  try {
    if (!session) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // ignore quota / private mode
  }
}

/**
 * Sessão ativa do operador (esquadrão + missão), persistida só no browser.
 */
export function useAdminActiveSession() {
  const [session, setSessionState] = useState<AdminActiveSession | null>(() => readStorage());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setSessionState(readStorage());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setSession = useCallback((next: AdminActiveSession | null) => {
    writeStorage(next);
    setSessionState(next);
  }, []);

  const clearSession = useCallback(() => {
    writeStorage(null);
    setSessionState(null);
  }, []);

  const patchSession = useCallback((patch: Partial<AdminActiveSession>) => {
    setSessionState((prev) => {
      if (!prev && !patch.groupId) return prev;
      const next: AdminActiveSession = {
        groupId: patch.groupId ?? prev?.groupId ?? '',
        campaignId: patch.campaignId ?? prev?.campaignId ?? '',
      };
      if (!next.groupId) {
        writeStorage(null);
        return null;
      }
      writeStorage(next);
      return next;
    });
  }, []);

  return { session, setSession, clearSession, patchSession };
}
