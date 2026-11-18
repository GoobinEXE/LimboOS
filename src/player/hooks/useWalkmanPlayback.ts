import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { clearMediaSession, updateMediaSession } from '../../lib/native/mediaSession';
import type { Dispatch, SetStateAction } from 'react';
import { audioEngine } from '../../services/AudioEngine';
import { analyticsTracker } from '../../services/AnalyticsTracker';
import { activityLogger } from '../../services/ActivityLogger';
import { firebaseAnalytics } from '../../services/FirebaseAnalyticsService';
import { intelService } from '../../services/IntelService';
import {
  IntelBase,
  AudioIntel,
  VisualIntel,
  TextIntel,
  MetaIntel,
  VideoIntel,
  IntelFactory,
} from '../../services/IntelEngine';
import { clearPendingVideoPlay } from '../../store/firestore';
import type { PlayerData, PlayerStats, WalkmanStatus, DisplayMode, AppScreen } from '../../types/player';
import type { Toast } from '../../components/ToastNotification';
import type { DeviceCapabilities } from './useActiveCampaign';
import i18n from '../../i18n';
import { pushService } from '../../services/PushService';
import { holdWakeLock } from '../../lib/wakeLock';
import {
  clearTapeId,
  clearTapePosition,
  readTapeId,
  readTapePosition,
  writeTapeId,
  writeTapePosition,
  type AgentRef,
} from '../lib/agentPersistence';
import { normalizeQrPayload } from '../../lib/qrCode';
export interface UseWalkmanPlaybackOptions {
  playerData: PlayerData | null;
  localStats: PlayerStats | null;
  playerDataRef: React.RefObject<PlayerData | null>;
  setPlayerData: Dispatch<SetStateAction<PlayerData | null>>;
  setScreen: Dispatch<SetStateAction<AppScreen>>;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  deviceCapabilities: DeviceCapabilities;
}

export function useWalkmanPlayback(options: UseWalkmanPlaybackOptions) {
  const { playerData, localStats, playerDataRef, setPlayerData, setScreen, addToast, deviceCapabilities } = options;

  const [walkmanStatus, setWalkmanStatus] = useState<WalkmanStatus>('IDLE');
  const [currentIntel, setCurrentIntel] = useState<IntelBase | null>(null);
  const [volume, setVolume] = useState(80);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('default');
  const [scanTimes, setScanTimes] = useState<number[]>([]);
  const [activeEvidence, setActiveEvidence] = useState<IntelBase | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [preMuteVolume, setPreMuteVolume] = useState(80);
  const [nokiaBackVisible, setNokiaBackVisible] = useState(true);

  const [isBuffering, setIsBuffering] = useState(false);
  const [audioError, setAudioError] = useState<{ code: number | null; at: number } | null>(null);

  const hasPlayedCurrentTape = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const nokiaBackHandlerRef = useRef<(() => boolean) | null>(null);
  const lastVideoRequestRef = useRef<string | null>(null);

  // Ref para os callbacks estáveis consultarem as capacidades atuais do dispositivo
  const capabilitiesRef = useRef(deviceCapabilities);
  capabilitiesRef.current = deviceCapabilities;
  const addToastRef = useRef(addToast);
  addToastRef.current = addToast;
  const activeEvidenceRef = useRef<IntelBase | null>(null);
  activeEvidenceRef.current = activeEvidence;

  const isPlaying = walkmanStatus === 'PLAYING';

  // Agente atual (F5): chave de persistência por uid + characterId
  const agentUid = playerData?.uid;
  const agentCharId = playerData?.activeCharacterId;
  const agent = useMemo<AgentRef | null>(
    () => (agentUid && agentCharId ? { uid: agentUid, characterId: agentCharId } : null),
    [agentUid, agentCharId]
  );
  const agentRef = useRef(agent);
  agentRef.current = agent;
  const currentIntelRef = useRef<IntelBase | null>(null);
  const walkmanStatusRef = useRef<WalkmanStatus>('IDLE');
  walkmanStatusRef.current = walkmanStatus;
  const restoredForRef = useRef<string | null>(null);
  const lastErrorToastAtRef = useRef(0);
  const handleQrDetectedRef = useRef<(code: string) => Promise<void>>(async () => undefined);

  const clearPendingTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
  }, []);

  const scheduleTimer = useCallback(
    (fn: () => void, delay: number) => {
      clearPendingTimer();
      timerRef.current = setTimeout(fn, delay);
    },
    [clearPendingTimer]
  );

  useEffect(() => clearPendingTimer, [clearPendingTimer]);

  useEffect(() => {
    audioEngine.setVolume(volume);
    analyticsTracker.setVolume(volume);
  }, [volume]);

  useEffect(() => {
    audioEngine.setOnEnded(() => {
      clearTapePosition(agentRef.current);
      setWalkmanStatus('LOADED');
      analyticsTracker.endPlayback();
    });
  }, []);

  // Buffering (J03): mostra só após 300 ms para não piscar em rede normal
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    audioEngine.setOnBuffering((buffering) => {
      if (timer) clearTimeout(timer);
      if (buffering) timer = setTimeout(() => setIsBuffering(true), 300);
      else setIsBuffering(false);
    });
    return () => {
      if (timer) clearTimeout(timer);
      audioEngine.setOnBuffering(null);
    };
  }, []);

  // Erro do <audio> (J01): propagado até aqui; toast e retry entram na onda 2
  useEffect(() => {
    audioEngine.setOnError((code) => {
      setIsBuffering(false);
      setAudioError({ code, at: Date.now() });
      setWalkmanStatus((s) => (s === 'PLAYING' ? 'LOADED' : s));
    });
    return () => audioEngine.setOnError(null);
  }, []);

  // Toast de fita ilegível (J01), com ação que recarrega a fita; deduplica em 1 s com o toast do play()
  useEffect(() => {
    if (!audioError) return;
    if (audioError.at - lastErrorToastAtRef.current < 1000) return;
    lastErrorToastAtRef.current = audioError.at;
    const intel = currentIntelRef.current;
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    addToastRef.current({
      type: 'error',
      title: i18n.t('toast.tapeLoadFail', { ns: 'player' }),
      subtitle: i18n.t(offline ? 'toast.tapeLoadFailOffline' : 'toast.tapeLoadFailSub', { ns: 'player' }),
      icon: '[!]',
      action:
        intel instanceof AudioIntel && intel.mediaUrl
          ? {
              label: i18n.t('toast.action.retry', { ns: 'common' }),
              onClick: () => {
                audioEngine.loadTrack(intel.mediaUrl);
                setWalkmanStatus('PLAYING');
              },
            }
          : undefined,
    });
  }, [audioError]);

  // Retomar de onde parou (J12): ao carregar metadados, volta à posição guardada desta fita
  useEffect(() => {
    audioEngine.setOnLoadedMetadata((duration) => {
      const intel = currentIntelRef.current;
      const saved = readTapePosition(agentRef.current);
      if (!intel || !saved || saved.intelId !== intel.id || duration <= 0) return;
      if (saved.t < 5 || saved.t > duration - 5) return;
      audioEngine.seekTo(saved.t);
      addToastRef.current({
        type: 'tape',
        title: i18n.t('toast.resumeTape', { ns: 'player' }),
        subtitle: i18n.t('toast.resumeTapeSub', { ns: 'player' }),
        icon: '[>>]',
        action: {
          label: i18n.t('toast.action.fromStart', { ns: 'player' }),
          onClick: () => {
            audioEngine.seekTo(0);
            clearTapePosition(agentRef.current);
          },
        },
      });
    });
    return () => audioEngine.setOnLoadedMetadata(null);
  }, []);

  // Salva a posição a cada 5 s tocando, ao pausar (cleanup) e ao fechar a página
  useEffect(() => {
    if (walkmanStatus !== 'PLAYING' || !(currentIntel instanceof AudioIntel)) return;
    const id = currentIntel.id;
    const save = () => {
      // Eject, troca de fita ou rewind já cuidaram do registro
      if (currentIntelRef.current?.id !== id || walkmanStatusRef.current === 'REWINDING') return;
      const t = audioEngine.getCurrentTime();
      const d = audioEngine.getDuration();
      if (d > 0 && t > d - 5) clearTapePosition(agentRef.current);
      else if (t > 0) writeTapePosition(agentRef.current, id, t);
    };
    window.addEventListener('pagehide', save);
    const interval = setInterval(save, 5000);
    return () => {
      window.removeEventListener('pagehide', save);
      clearInterval(interval);
      save();
    };
  }, [currentIntel, walkmanStatus]);

  // Tela acesa enquanto toca áudio (J16)
  useEffect(() => {
    if (walkmanStatus !== 'PLAYING' || !(currentIntel instanceof AudioIntel)) return;
    return holdWakeLock();
  }, [walkmanStatus, currentIntel]);

  useEffect(() => {
    if (walkmanStatus !== 'PLAYING') setIsBuffering(false);
  }, [walkmanStatus]);

  // Guarda qual fita está dentro (J14)
  currentIntelRef.current = currentIntel;
  useEffect(() => {
    if (currentIntel) writeTapeId(agentRef.current, currentIntel.id);
  }, [currentIntel]);

  // Restaura a fita do agente em LOADED, sem tocar (J14)
  useEffect(() => {
    if (!agent || !playerData) return;
    const key = `${agent.uid}:${agent.characterId}`;
    if (restoredForRef.current === key) return;
    restoredForRef.current = key;
    if (currentIntelRef.current || activeEvidenceRef.current) return;
    const id = readTapeId(agent);
    if (!id || !playerData.unlockedIntelIds.includes(id)) {
      if (id) clearTapeId(agent);
      return;
    }
    void intelService
      .resolve(id)
      .then((raw) => {
        if (agentRef.current?.uid !== agent.uid || agentRef.current?.characterId !== agent.characterId) return;
        if (!raw || currentIntelRef.current || walkmanStatusRef.current !== 'IDLE') return;
        const intel = IntelFactory.getInstance().create(raw);
        // Só áudio volta sozinho; vídeo depende do shell e da capacidade do aparelho
        if (!(intel instanceof AudioIntel)) return;
        setCurrentIntel(intel);
        setWalkmanStatus('LOADED');
      })
      .catch(() => undefined);
  }, [agent, playerData]);

  useEffect(() => {
    if (currentIntel instanceof AudioIntel && currentIntel.mediaUrl) {
      audioEngine.loadTrack(currentIntel.mediaUrl);
      // Fita nova inserida: descarta o playEvent da anterior (não foi concluído)
      analyticsTracker.abandonPlayback();
    } else if (!currentIntel || currentIntel instanceof VideoIntel) {
      audioEngine.clearTrack();
      // Eject/troca apenas abandona a reprodução; o tracker da sessão
      // (stats, conquistas) continua vivo — stopAll fica para logout/troca de agente.
      analyticsTracker.abandonPlayback();
    }
    return () => audioEngine.clearTrack();
  }, [currentIntel?.id]);

  useEffect(() => {
    // Vídeo é reproduzido pelo surface do shell (ex: Nokia), mas a telemetria
    // segue o mesmo caminho do áudio para manter o motor universal.
    if (currentIntel instanceof VideoIntel) {
      if (walkmanStatus === 'PLAYING') {
        hasPlayedCurrentTape.current = true;
        analyticsTracker.startPlayback(currentIntel as Parameters<typeof analyticsTracker.startPlayback>[0]);
      } else {
        analyticsTracker.pausePlayback();
      }
      return;
    }
    if (walkmanStatus === 'PLAYING') {
      hasPlayedCurrentTape.current = true;
      let cancelled = false;
      audioEngine
        .play()
        .then(() => {
          if (cancelled || !currentIntel) return;
          analyticsTracker.startPlayback(currentIntel as Parameters<typeof analyticsTracker.startPlayback>[0]);
        })
        .catch(() => {
          if (cancelled) return;
          // Autoplay bloqueado ou mídia indisponível: não deixa a UI presa em PLAYING
          setWalkmanStatus('LOADED');
          lastErrorToastAtRef.current = Date.now();
          addToast({
            type: 'error',
            title: i18n.t('toast.playbackFail', { ns: 'player' }),
            subtitle: i18n.t('toast.playbackFailSub', { ns: 'player' }),
            icon: '[!]',
            action: { label: i18n.t('toast.action.retry', { ns: 'common' }), onClick: () => setWalkmanStatus('PLAYING') },
          });
        });
      return () => {
        cancelled = true;
      };
    } else if (walkmanStatus === 'REWINDING') {
      audioEngine.stop();
      analyticsTracker.pausePlayback();
    } else {
      audioEngine.pause();
      analyticsTracker.pausePlayback();
    }
  }, [walkmanStatus, currentIntel?.id, addToast]);

  useEffect(() => {
    if (!(currentIntel instanceof AudioIntel)) {
      clearMediaSession();
      return;
    }
    updateMediaSession({
      title: currentIntel.title,
      playing: walkmanStatus === 'PLAYING',
      onPlay: () => setWalkmanStatus('PLAYING'),
      onPause: () => setWalkmanStatus('LOADED'),
      onSeekBackward: () => audioEngine.seekBy(-10),
      onSeekForward: () => audioEngine.seekBy(10),
    });
  }, [currentIntel, walkmanStatus]);

  const resetPlayback = useCallback(() => {
    clearPendingTimer();
    restoredForRef.current = null;
    setCurrentIntel(null);
    setWalkmanStatus('IDLE');
    setActiveEvidence(null);
    setVolume(80);
    setDisplayMode('default');
    setIsMuted(false);
    setPreMuteVolume(80);
    setScanTimes([]);
    hasPlayedCurrentTape.current = false;
    lastVideoRequestRef.current = null;
  }, [clearPendingTimer]);

  const handleQrDetected = useCallback(
    async (rawCode: string) => {
      const currentPD = playerDataRef.current;
      if (!currentPD || !localStats) {
        return addToast({ type: 'error', title: i18n.t('toast.wait', { ns: 'player' }), subtitle: i18n.t('toast.waitSub', { ns: 'player' }), icon: '[..]' });
      }
      setWalkmanStatus('IDLE');

      const code = normalizeQrPayload(rawCode);

      try {
        const rawIntel = await intelService.resolve(code);
        if (!rawIntel) {
          firebaseAnalytics.logQrScan('fail');
          return addToast({
            type: 'error',
            title: i18n.t('toast.unknownCode', { ns: 'player' }),
            subtitle: i18n.t('toast.unknownCodeSub', { ns: 'player', code }),
            icon: '[X]',
            action: { label: i18n.t('toast.action.scanAgain', { ns: 'common' }), onClick: () => setWalkmanStatus('SCANNING') },
          });
        }

        const intel = IntelFactory.getInstance().create(rawIntel);
        const { alreadyOwned, updatedIds } = await intelService.unlock(currentPD, intel.id, code);

        firebaseAnalytics.logQrScan(alreadyOwned ? 'duplicate' : 'success');
        pushService.markPushMoment();

        const now = Date.now();
        const recentScans = [...scanTimes.filter((t) => now - t < 300000), now];
        setScanTimes(recentScans);
        const updatedPD = { ...currentPD, unlockedIntelIds: updatedIds };
        setPlayerData(updatedPD);
        analyticsTracker.updatePlayerData(updatedPD);
        analyticsTracker.checkAchievements(recentScans);

        if (intel instanceof VideoIntel && !capabilitiesRef.current.supportsVideo) {
          // Walkman / desktop: reproduz vídeo via EvidenceReader (overlay)
          hasPlayedCurrentTape.current = false;
          setActiveEvidence(intel);
          addToast({
            type: 'tape',
            title: alreadyOwned ? i18n.t('toast.transmissionOpen', { ns: 'player' }) : i18n.t('toast.intelUnlocked', { ns: 'player' }),
            subtitle: intel.title,
            icon: '[▶]',
          });
          activityLogger.logAction(
            alreadyOwned ? 'video_select' : 'tape_unlock',
            `${alreadyOwned ? 'Abriu vídeo' : 'Desbloqueou vídeo'}: ${intel.title}`,
            { tapeId: intel.id }
          );
          return;
        }

        hasPlayedCurrentTape.current = false;
        setWalkmanStatus('LOADING');
        scheduleTimer(() => {
          setCurrentIntel(intel);
          setWalkmanStatus('LOADED');
          addToast({
            type: 'tape',
            title: alreadyOwned ? i18n.t('toast.intelInserted', { ns: 'player' }) : i18n.t('toast.intelUnlocked', { ns: 'player' }),
            subtitle: intel.title,
            icon: '[=]',
          });
        }, 400);
        activityLogger.logAction(
          alreadyOwned ? 'tape_insert' : 'tape_unlock',
          `${alreadyOwned ? 'Inseriu' : 'Desbloqueou'}: ${intel.title}`,
          { tapeId: intel.id }
        );
      } catch {
        addToast({
          type: 'error',
          title: i18n.t('toast.qrError', { ns: 'player' }),
          subtitle: i18n.t('toast.qrErrorSub', { ns: 'player' }),
          icon: '[!]',
          action: { label: i18n.t('toast.action.retry', { ns: 'common' }), onClick: () => void handleQrDetectedRef.current(rawCode) },
        });
      }
    },
    [localStats, scanTimes, addToast, playerDataRef, setPlayerData, scheduleTimer]
  );

  handleQrDetectedRef.current = handleQrDetected;

  const handleIntelSelect = useCallback(
    (intel: IntelBase) => {
      if (!playerDataRef.current) return;
      if (intel instanceof VisualIntel || intel instanceof TextIntel || intel instanceof MetaIntel) {
        setActiveEvidence(intel);
        activityLogger.logAction(
          intel.type === 'VISUAL' ? 'pista_open' : 'evidence_open',
          `Abriu: ${intel.title}`,
          { intelId: intel.id }
        );
        firebaseAnalytics.logEvidenceViewed(intel.id, intel.type);
      } else if (intel instanceof VideoIntel && !capabilitiesRef.current.supportsVideo) {
        setActiveEvidence(intel);
        activityLogger.logAction('video_select', `Abriu vídeo (overlay): ${intel.title}`, { intelId: intel.id });
        firebaseAnalytics.logEvidenceViewed(intel.id, intel.type);
      } else if (intel instanceof AudioIntel || intel instanceof VideoIntel) {
        if (intel.id === currentIntel?.id) return;
        if (!hasPlayedCurrentTape.current && currentIntel) {
          analyticsTracker.incrementStat('ejectWithoutPlay');
        }
        hasPlayedCurrentTape.current = false;
        setWalkmanStatus('LOADING');
        scheduleTimer(() => {
          setCurrentIntel(intel);
          setWalkmanStatus('LOADED');
        }, 400);
        activityLogger.logAction(
          intel instanceof VideoIntel ? 'video_select' : 'tape_select',
          `Selecionou: ${intel.title}`,
          { intelId: intel.id }
        );
      }
    },
    [currentIntel, playerDataRef, addToast, scheduleTimer]
  );

  const handleEject = useCallback(() => {
    if (!hasPlayedCurrentTape.current && currentIntel) {
      analyticsTracker.incrementStat('ejectWithoutPlay');
    }
    clearTapeId(agentRef.current);
    clearTapePosition(agentRef.current);
    setWalkmanStatus('IDLE');
    setCurrentIntel(null);
  }, [currentIntel]);

  const handleScanClick = useCallback(() => setWalkmanStatus('SCANNING'), []);
  const handleCancelScan = useCallback(() => setWalkmanStatus('IDLE'), []);
  const handleSetIsPlaying = useCallback((p: boolean) => setWalkmanStatus(p ? 'PLAYING' : 'LOADED'), []);

  // Fim de mídia reproduzida pelo shell (ex: vídeo no Nokia) segue o mesmo
  // caminho do fim de áudio: motor decide o estado e fecha a telemetria.
  const handleVideoEnded = useCallback(() => {
    setWalkmanStatus('LOADED');
    analyticsTracker.endPlayback();
  }, []);

  const handleRewind = useCallback(() => {
    clearTapePosition(agentRef.current);
    setWalkmanStatus('REWINDING');
    scheduleTimer(() => setWalkmanStatus('LOADED'), 1500);
  }, [scheduleTimer]);

  const handleModeChange = useCallback((dir: 'up' | 'down') => {
    setDisplayMode((prev) => {
      const modes: DisplayMode[] = ['default', 'title', 'chapter', 'type'];
      const currentIndex = modes.indexOf(prev);
      const nextIndex = (currentIndex + (dir === 'up' ? 1 : -1) + modes.length) % modes.length;
      return modes[nextIndex] ?? 'default';
    });
    analyticsTracker.incrementStat('modeSwitches');
    analyticsTracker.incrementStat('fidgetClicks');
  }, []);

  const handleProfileOpen = useCallback(() => setScreen('profile'), [setScreen]);
  const handleTerminalOpen = useCallback(() => setScreen('bios'), [setScreen]);
  const handleMacOpen = useCallback(() => setScreen('macos'), [setScreen]);

  const handleToggleMute = useCallback(() => {
    if (isMuted) {
      setVolume(preMuteVolume);
      setIsMuted(false);
    } else {
      setPreMuteVolume(volume);
      setVolume(0);
      setIsMuted(true);
    }
  }, [isMuted, volume, preMuteVolume]);

  const registerNokiaBackHandler = useCallback((handler: (() => boolean) | null) => {
    nokiaBackHandlerRef.current = handler;
  }, []);

  const handleNokiaBack = useCallback(
    (screen: AppScreen) => {
      // O NokiaPlayer segue montado (oculto) no perfil; o handler dele só vale com o player visível.
      if (screen !== 'player') {
        setScreen('player');
        return;
      }
      nokiaBackHandlerRef.current?.();
    },
    [setScreen]
  );

  const handleRemoteVideoPlay = useCallback(
    async (intelId: string, requestId: string) => {
      if (lastVideoRequestRef.current === requestId) return;
      lastVideoRequestRef.current = requestId;

      const currentPD = playerDataRef.current;
      if (!currentPD) return;

      try {
        const rawIntel = await intelService.resolve(intelId);
        if (!rawIntel) return;

        const intel = IntelFactory.getInstance().create(rawIntel);
        if (!(intel instanceof VideoIntel)) return;

        let updatedIds = currentPD.unlockedIntelIds;
        if (!updatedIds.includes(intelId)) {
          const unlockResult = await intelService.unlock(currentPD, intelId);
          updatedIds = unlockResult.updatedIds;
          pushService.markPushMoment();
          const updatedPD = { ...currentPD, unlockedIntelIds: updatedIds };
          setPlayerData(updatedPD);
          analyticsTracker.updatePlayerData(updatedPD);
        }

        if (!capabilitiesRef.current.supportsVideo) {
          await clearPendingVideoPlay(currentPD.uid, currentPD.activeCharacterId);
          setScreen('player');
          setActiveEvidence(intel);
          addToast({
            type: 'tape',
            title: i18n.t('toast.transmissionReceived', { ns: 'player' }),
            subtitle: intel.title,
            icon: '[▶]',
          });
          return;
        }

        setScreen('player');
        hasPlayedCurrentTape.current = false;
        setWalkmanStatus('LOADING');
        scheduleTimer(() => {
          setCurrentIntel(intel);
          setWalkmanStatus('PLAYING');
          addToast({
            type: 'tape',
            title: i18n.t('toast.transmissionReceived', { ns: 'player' }),
            subtitle: intel.title,
            icon: '[▶]',
          });
        }, 400);

        await clearPendingVideoPlay(currentPD.uid, currentPD.activeCharacterId);
        activityLogger.logSystem(
          currentPD.uid,
          currentPD.character.codinome,
          currentPD.activeCharacterId,
          'sync',
          `Vídeo transmitido pelo mestre: ${intel.title}`,
          { intelId, requestId }
        );
      } catch (err) {
        console.error('[WalkmanPlayback] Remote video play failed:', err);
      }
    },
    [playerDataRef, setPlayerData, setScreen, addToast, scheduleTimer]
  );

  return {
    walkmanStatus,
    setWalkmanStatus,
    /** Fita travada esperando dados, já com atraso de 300 ms (J03). */
    isBuffering,
    /** Último erro do <audio> com fita válida; null se nenhum (J01, a tratar na onda 2). */
    audioError,
    seekBy: audioEngine.seekBy.bind(audioEngine),
    currentIntel,
    setCurrentIntel,
    volume,
    setVolume,
    displayMode,
    isPlaying,
    activeEvidence,
    setActiveEvidence,
    isMuted,
    nokiaBackVisible,
    setNokiaBackVisible,
    resetPlayback,
    handleQrDetected,
    handleIntelSelect,
    handleEject,
    handleScanClick,
    handleCancelScan,
    handleSetIsPlaying,
    handleRewind,
    handleVideoEnded,
    handleModeChange,
    handleProfileOpen,
    handleTerminalOpen,
    handleMacOpen,
    handleToggleMute,
    registerNokiaBackHandler,
    handleNokiaBack,
    handleRemoteVideoPlay,
    playerDataRef,
  };
}

export type WalkmanPlaybackState = ReturnType<typeof useWalkmanPlayback>;
