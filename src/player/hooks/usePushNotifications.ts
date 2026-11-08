import { useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Toast } from '../../components/ToastNotification';
import { isNative } from '../../lib/native/platform';
import { pushService, type PushTapData } from '../../services/PushService';
import { fetchCharacters } from '../../store/firestore';
import type { AppScreen, CharacterData, MasterAccount, PlayerData } from '../../types/player';

interface UsePushNotificationsOptions {
  masterAccount: MasterAccount | null | undefined;
  playerData: PlayerData | null;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  setScreen: Dispatch<SetStateAction<AppScreen>>;
  handleCharacterSelect: (character: CharacterData) => Promise<void>;
  handleCharacterSwitch: () => void;
}

/** Liga o push à sessão do jogador. No navegador nada aqui roda. */
export function usePushNotifications(options: UsePushNotificationsOptions): void {
  const uid = options.masterAccount?.uid ?? null;
  const activeCharacterId = options.playerData?.activeCharacterId ?? null;
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const pendingTap = useRef<PushTapData | null>(null);

  useEffect(() => {
    if (!isNative() || !uid) return;
    void pushService.attach(uid).catch((err) => console.warn('[Push] attach:', err));
  }, [uid]);

  useEffect(() => {
    if (!isNative()) return;
    void pushService.setActiveCharacter(activeCharacterId).catch((err) => console.warn('[Push] agente:', err));
  }, [activeCharacterId]);

  useEffect(() => {
    if (!isNative()) return;
    return pushService.onForeground(({ title, body }) => {
      optionsRef.current.addToast({ type: 'tape', title, subtitle: body, icon: '📡' });
    });
  }, []);

  useEffect(() => {
    if (!isNative()) return;

    const openTap = async (data: PushTapData, accountUid: string) => {
      const current = optionsRef.current;
      const activeId = current.playerData?.activeCharacterId ?? null;
      if (data.characterId && data.characterId !== activeId) {
        const character = (await fetchCharacters(accountUid)).find((c) => c.id === data.characterId);
        if (!character) {
          if (activeId) current.handleCharacterSwitch();
          else current.setScreen('characterSelection');
          return;
        }
        if (activeId) current.handleCharacterSwitch();
        await current.handleCharacterSelect(character);
        return;
      }
      if (activeId) current.setScreen('player');
    };

    return pushService.onTap((data) => {
      const accountUid = optionsRef.current.masterAccount?.uid;
      if (accountUid) void openTap(data, accountUid).catch((err) => console.warn('[Push] toque:', err));
      else pendingTap.current = data;
    });
  }, []);

  // App aberto pelo toque: a conta só resolve depois do listener.
  useEffect(() => {
    if (!uid || !pendingTap.current) return;
    const data = pendingTap.current;
    pendingTap.current = null;
    void (async () => {
      const character = data.characterId
        ? (await fetchCharacters(uid)).find((c) => c.id === data.characterId)
        : undefined;
      if (character) await optionsRef.current.handleCharacterSelect(character);
    })().catch((err) => console.warn('[Push] toque inicial:', err));
  }, [uid]);
}
