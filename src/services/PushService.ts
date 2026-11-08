import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import type { Notification } from '@capacitor-firebase/messaging';
import { auth, db } from '../lib/firebase';
import { getPlatform, isNative } from '../lib/native/platform';
import type { NotificationPrefs } from '../types/player';

export type PushPermission = 'granted' | 'denied' | 'prompt' | 'unsupported';

export interface PushTapData {
  characterId?: string;
  wsId?: string;
  screen?: string;
  category?: string;
}

type TapListener = (data: PushTapData) => void;
type ForegroundListener = (notification: { title: string; body: string }) => void;
type MessagingModule = typeof import('@capacitor-firebase/messaging');

const ASK_LATER_KEY = 'limboos.push.askAfter';
const ASK_LATER_MS = 7 * 86_400_000;
const DETACH_TIMEOUT_MS = 1500;
/** Mesmo id de backend/functions/push.js. */
const ANDROID_CHANNEL_ID = 'limboos_transmissoes';

/**
 * Push no app nativo. No navegador todo método é inerte e o plugin nem é baixado.
 * O aparelho fica em users/{uid}/devices/{deviceId}. As regras exigem badge 0 em toda
 * escrita do cliente, então registrar o aparelho também zera o contador.
 */
class PushService {
  private static instance: PushService;
  private uid: string | null = null;
  private deviceId: string | null = null;
  private activeCharacterId: string | null = null;
  private listenersReady = false;
  private tapListener: TapListener | null = null;
  private foregroundListener: ForegroundListener | null = null;
  private pendingTap: PushTapData | null = null;

  public static getInstance(): PushService {
    if (!PushService.instance) PushService.instance = new PushService();
    return PushService.instance;
  }

  private messaging(): Promise<MessagingModule> {
    return import('@capacitor-firebase/messaging');
  }

  private async resolveDeviceId(): Promise<string> {
    if (!this.deviceId) {
      const { Device } = await import('@capacitor/device');
      this.deviceId = (await Device.getId()).identifier;
    }
    return this.deviceId;
  }

  private async deviceRef() {
    if (!this.uid) return null;
    return doc(db, 'users', this.uid, 'devices', await this.resolveDeviceId());
  }

  private async saveToken(token: string): Promise<void> {
    const ref = await this.deviceRef();
    if (!ref) return;
    const { App } = await import('@capacitor/app');
    const [info, existing] = await Promise.all([App.getInfo(), getDoc(ref)]);
    await setDoc(ref, {
      token,
      platform: getPlatform(),
      appVersion: info.version,
      locale: navigator.language,
      activeCharacterId: this.activeCharacterId,
      enabled: true,
      badge: 0,
      updatedAt: serverTimestamp(),
      ...(existing.exists() ? {} : { createdAt: serverTimestamp() }),
    }, { merge: true });
  }

  private async setupListeners(): Promise<void> {
    if (this.listenersReady) return;
    this.listenersReady = true;
    const { FirebaseMessaging, Importance } = await this.messaging();

    if (getPlatform() === 'android') {
      await FirebaseMessaging.createChannel({
        id: ANDROID_CHANNEL_ID,
        name: 'Transmissões',
        description: 'Entregas e mensagens do mestre',
        importance: Importance.High,
      }).catch((err) => console.warn('[Push] canal Android:', err));
    }

    await FirebaseMessaging.addListener('tokenReceived', ({ token }) => {
      void this.saveToken(token).catch((err) => console.warn('[Push] token:', err));
    });
    await FirebaseMessaging.addListener('notificationReceived', ({ notification }) => {
      this.emitForeground(notification);
    });
    await FirebaseMessaging.addListener('notificationActionPerformed', ({ notification }) => {
      this.emitTap((notification.data ?? {}) as PushTapData);
    });

    const { App } = await import('@capacitor/app');
    await App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) void this.clearBadge();
    });
  }

  private emitForeground(notification: Notification): void {
    if (!notification.title && !notification.body) return;
    this.foregroundListener?.({ title: notification.title ?? '', body: notification.body ?? '' });
  }

  private emitTap(data: PushTapData): void {
    if (this.tapListener) this.tapListener(data);
    else this.pendingTap = data;
  }

  /** Toque que abriu o app chega antes da interface: fica guardado até haver quem trate. */
  public onTap(listener: TapListener): () => void {
    this.tapListener = listener;
    if (this.pendingTap) {
      const pending = this.pendingTap;
      this.pendingTap = null;
      listener(pending);
    }
    return () => {
      if (this.tapListener === listener) this.tapListener = null;
    };
  }

  public onForeground(listener: ForegroundListener): () => void {
    this.foregroundListener = listener;
    return () => {
      if (this.foregroundListener === listener) this.foregroundListener = null;
    };
  }

  public async getPermission(): Promise<PushPermission> {
    if (!isNative()) return 'unsupported';
    const { FirebaseMessaging } = await this.messaging();
    const { receive } = await FirebaseMessaging.checkPermissions();
    if (receive === 'granted' || receive === 'denied') return receive;
    return 'prompt';
  }

  /** Conta entrou: registra o aparelho só se o sistema já autorizou. */
  public async attach(uid: string): Promise<void> {
    if (!isNative()) return;
    this.uid = uid;
    await this.setupListeners();
    if ((await this.getPermission()) === 'granted') await this.registerToken();
  }

  private async registerToken(): Promise<void> {
    const { FirebaseMessaging } = await this.messaging();
    const { token } = await FirebaseMessaging.getToken();
    await this.saveToken(token);
    await FirebaseMessaging.removeAllDeliveredNotifications().catch(() => undefined);
  }

  /** Abre o pedido do sistema. O iOS só mostra uma vez, por isso vem depois da nossa tela. */
  public async requestPermission(): Promise<PushPermission> {
    if (!isNative()) return 'unsupported';
    const { FirebaseMessaging } = await this.messaging();
    await FirebaseMessaging.requestPermissions();
    const permission = await this.getPermission();
    if (permission === 'granted') await this.registerToken();
    return permission;
  }

  public async setActiveCharacter(characterId: string | null): Promise<void> {
    this.activeCharacterId = characterId;
    if (!isNative() || !this.uid) return;
    const ref = await this.deviceRef();
    if (!ref || !(await getDoc(ref)).exists()) return;
    await updateDoc(ref, { activeCharacterId: characterId, badge: 0, updatedAt: serverTimestamp() });
  }

  private async clearBadge(): Promise<void> {
    try {
      const { FirebaseMessaging } = await this.messaging();
      await FirebaseMessaging.removeAllDeliveredNotifications();
      const ref = await this.deviceRef();
      if (ref && (await getDoc(ref)).exists()) {
        await updateDoc(ref, { badge: 0, updatedAt: serverTimestamp() });
      }
    } catch (err) {
      console.warn('[Push] badge:', err);
    }
  }

  /** Antes do signOut, enquanto a conta ainda pode escrever. Sem rede, desiste rápido. */
  public async detach(): Promise<void> {
    if (!isNative() || !this.uid) return;
    const disable = (async () => {
      const ref = await this.deviceRef();
      if (ref && (await getDoc(ref)).exists()) {
        await updateDoc(ref, { enabled: false, badge: 0, updatedAt: serverTimestamp() });
      }
    })().catch((err) => console.warn('[Push] detach:', err));
    await Promise.race([disable, new Promise((resolve) => setTimeout(resolve, DETACH_TIMEOUT_MS))]);
    this.uid = null;
    this.activeCharacterId = null;
  }

  public shouldAsk(): boolean {
    try {
      return Date.now() >= Number(localStorage.getItem(ASK_LATER_KEY) || 0);
    } catch {
      return true;
    }
  }

  public askLater(): void {
    try {
      localStorage.setItem(ASK_LATER_KEY, String(Date.now() + ASK_LATER_MS));
    } catch {
      // Armazenamento bloqueado: o aviso volta na próxima abertura.
    }
  }

  public async loadPrefs(): Promise<NotificationPrefs> {
    const uid = auth.currentUser?.uid;
    if (!uid) return {};
    const snap = await getDoc(doc(db, 'users', uid));
    return (snap.data()?.notificationPrefs ?? {}) as NotificationPrefs;
  }

  public async savePrefs(prefs: NotificationPrefs): Promise<void> {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    await updateDoc(doc(db, 'users', uid), { notificationPrefs: prefs });
  }
}

export const pushService = PushService.getInstance();
