import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOnlineStatus } from '../../lib/connectivity';
import { firebaseAnalytics } from '../../services/FirebaseAnalyticsService';
import { analyticsTracker } from '../../services/AnalyticsTracker';
import { playerSyncService, type PlayerSyncError } from '../../services/PlayerSyncService';
import type { AppScreen } from '../../types/player';
import type { Toast } from '../../components/ToastNotification';
import type { PlayerAuthState } from './usePlayerAuth';

export function usePlayerScreenAnalytics(screen: AppScreen) {
  const previousScreenRef = useRef<AppScreen | null>(null);

  useEffect(() => {
    firebaseAnalytics.logScreenView(screen, previousScreenRef.current || undefined);
    previousScreenRef.current = screen;
  }, [screen]);
}

export function usePlayerServicesSync(
  auth: Pick<
    PlayerAuthState,
    'playerData' | 'localStats' | 'setPlayerData' | 'setLocalStats' | 'setScreen' | 'setLimboStatus'
  >,
  addToast: (toast: Omit<Toast, 'id'>) => void
) {
  const { t } = useTranslation('player');
  const { playerData, localStats, setPlayerData, setLocalStats, setScreen, setLimboStatus } = auth;
  const [syncError, setSyncError] = useState<PlayerSyncError | null>(null);
  const [syncRetrying, setSyncRetrying] = useState(false);
  const resubscribeRef = useRef<(() => void) | null>(null);
  const online = useOnlineStatus();
  const prevOnlineRef = useRef(online);

  // Toasts de queda e retorno da rede (a faixa global omite "restabelecido" no player).
  useEffect(() => {
    const was = prevOnlineRef.current;
    prevOnlineRef.current = online;
    if (was === online) return;
    if (!online) {
      addToast({ type: 'error', title: t('offline.lost', { defaultValue: 'SEM SINAL' }), icon: '[X]' });
    } else {
      addToast({ type: 'tape', title: t('offline.restored', { defaultValue: 'SINAL RESTABELECIDO' }), icon: '[OK]' });
    }
  }, [online, addToast, t]);

  const retrySync = useCallback(() => {
    if (!resubscribeRef.current) return;
    setSyncRetrying(true);
    // subscribeToPlayerData cancela os listeners antigos antes de assinar de novo.
    resubscribeRef.current();
  }, []);

  // A rede voltou com um erro de rede pendente: reassina sem esperar o toque. Só na
  // transição de `online`: depender do erro faria um erro que volta a cada assinatura
  // (snapshot saudável limpa, listener falha de novo) reassinar em laço.
  const syncErrorRef = useRef(syncError);
  syncErrorRef.current = syncError;
  useEffect(() => {
    if (online && syncErrorRef.current?.network) retrySync();
  }, [online, retrySync]);

  useEffect(() => {
    if (!playerData || !localStats) return;

    analyticsTracker.init(
      playerData,
      localStats,
      (stats, data) => {
        setLocalStats(stats);
        setPlayerData(data);
      },
      (toast) => addToast(toast)
    );

    const subscribe = () => {
      playerSyncService.subscribeToPlayerData(
        playerData.uid,
        playerData.activeCharacterId,
        (updatedData) => {
          setPlayerData((prev) => (prev ? { ...prev, ...updatedData } : prev));
        },
        setScreen,
        setLimboStatus,
        {
          onError: (error) => {
            setSyncError(error);
            setSyncRetrying(false);
          },
          onHealthy: () => {
            setSyncError(null);
            setSyncRetrying(false);
          },
        }
      );
    };
    resubscribeRef.current = subscribe;
    setSyncError(null);
    setSyncRetrying(false);
    subscribe();

    return () => {
      resubscribeRef.current = null;
      analyticsTracker.stopAll(true);
      playerSyncService.stopAll();
    };
  }, [playerData?.activeCharacterId, addToast, setPlayerData, setLocalStats, setScreen, setLimboStatus]);

  // Mantém o tracker com o playerData mais recente (unlocks via QR, sync remoto, etc.)
  useEffect(() => {
    if (playerData) analyticsTracker.updatePlayerData(playerData);
  }, [playerData]);

  return { syncError, syncRetrying, retrySync };
}
