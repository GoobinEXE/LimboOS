
import { initializeApp, getApps, getApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, initializeAuth, indexedDBLocalPersistence, type Auth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { connectStorageEmulator, getStorage } from 'firebase/storage';
import { getAnalytics, isSupported } from 'firebase/analytics';
import type { Analytics } from 'firebase/analytics';
import { isWebKitLite } from './webkitLite';
import { isNative } from './native/platform';
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
// No app nativo (WKWebView / Android WebView) o getAuth padrão carrega o resolvedor de
// popup/redirect, que depende de iframe no authDomain e trava o onAuthStateChanged no iOS.
// Ali a sessão fica só no IndexedDB; login Google/Apple usa credencial do plugin nativo.
function createAuth(): Auth {
  if (!isNative()) return getAuth(app);
  try {
    return initializeAuth(app, { persistence: indexedDBLocalPersistence });
  } catch {
    return getAuth(app);
  }
}
export const auth = createAuth();

// App Check (opcional): defina VITE_FIREBASE_APPCHECK_SITE_KEY no .env
// e registre o provedor no Firebase Console → App Check.
const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY as string | undefined;
// ReCaptchaV3 não roda na origem capacitor://; o nativo usa src/lib/native/appCheck.ts.
if (appCheckSiteKey && typeof window !== 'undefined' && !isNative()) {
  void import('firebase/app-check').then(({ initializeAppCheck, ReCaptchaV3Provider }) => {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  }).catch((err) => {
    console.warn('[firebase] App Check não inicializado:', err);
  });
}

if (isNative() && import.meta.env.VITE_NATIVE_APP_CHECK === 'true') {
  void import('./native/appCheck')
    .then(({ initNativeAppCheck }) => initNativeAppCheck(app))
    .catch((err) => console.warn('[firebase] App Check nativo não inicializado:', err));
}

// Em dev (incl. browser embutido do Cursor), HTTP/2 do WebChannel costuma falhar.
// No Safari/WebKit o transporte fetch/stream do Listen/Write também falha com
// "Fetch API cannot load ... due to access control checks" — long polling estabiliza.
const useLongPolling = import.meta.env.DEV || isWebKitLite();
const firestoreSettings = useLongPolling
  ? {
      localCache: memoryLocalCache(),
      experimentalForceLongPolling: true,
    }
  : {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    };

export const db = initializeFirestore(app, firestoreSettings);
export const storage = getStorage(app);

/**
 * Emuladores locais (Auth, Firestore, Storage e Functions) para teste ponta a ponta.
 * Só liga com VITE_USE_EMULATORS=true; as portas seguem backend/firebase.json.
 */
export const useEmulators = import.meta.env.VITE_USE_EMULATORS === 'true';
export const emulatorHost = (import.meta.env.VITE_EMULATOR_HOST as string | undefined) || '127.0.0.1';
function emulatorPort(name: string, fallback: number): number {
  const raw = import.meta.env[`VITE_EMULATOR_${name}_PORT`] as string | undefined;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}
export const emulatorPorts = {
  auth: emulatorPort('AUTH', 9099),
  firestore: emulatorPort('FIRESTORE', 8085),
  storage: emulatorPort('STORAGE', 9199),
  functions: emulatorPort('FUNCTIONS', 5001),
};
if (useEmulators) {
  connectAuthEmulator(auth, `http://${emulatorHost}:${emulatorPorts.auth}`, { disableWarnings: true });
  connectFirestoreEmulator(db, emulatorHost, emulatorPorts.firestore);
  connectStorageEmulator(storage, emulatorHost, emulatorPorts.storage);
}

// Firebase Analytics (GA4) — initialized lazily since it requires browser support check
let _analytics: Analytics | null = null;
export async function getFirebaseAnalytics(): Promise<Analytics | null> {
  if (_analytics) return _analytics;
  try {
    const supported = await isSupported();
    if (supported) {
      _analytics = getAnalytics(app);
    }
  } catch {
    // Analytics not supported in this environment (e.g., SSR, privacy blockers)
  }
  return _analytics;
}

import { activityLogger } from '../services/ActivityLogger';
import { getTenantScope } from './tenantScope';
let _isLogging = false; 
function argsToString(args: unknown[]): string {
  return args.map(a => {
    if (a instanceof Error) return `${a.message}`;
    if (typeof a === 'object') try { return JSON.stringify(a); } catch { return String(a); }
    return String(a);
  }).join(' ');
}
const FIRESTORE_NOISE_PATTERNS = [
  '[ActivityLogger]',
  'Missing or insufficient permissions',
  'permission-denied',
  'access control checks',
  'INTERNAL ASSERTION FAILED',
  'Content blocker prevented',
  'BloomFilter',
  'ERR_HTTP2_PING_FAILED',
  'WebChannelConnection',
  'Script error',
  'browser.storage',
  "Cannot access 'db' before initialization",
];

function isFirestoreNoise(message: string): boolean {
  return FIRESTORE_NOISE_PATTERNS.some((pattern) => message.includes(pattern));
}

function logGlobalBrowserError(tag: string, fullMessage: string, stack?: string, code?: string, extraArgs?: any) {
  if (isFirestoreNoise(fullMessage)) return;

  const user = auth?.currentUser;
  const lines = fullMessage.split('\n');
  let summary = lines[0] || 'Unknown Error';
  
  if (summary.length > 150) summary = summary.slice(0, 147) + '...';
  const finalMessage = `[${tag}] ${summary}`;
  const metadata: Record<string, unknown> = { fullMessage };
  if (stack !== undefined) metadata.stack = stack;
  if (code !== undefined) metadata.code = code;
  if (extraArgs !== undefined) metadata.extraArgs = extraArgs;
  if (!user) return;
  const name = user.displayName || user.email || 'unknown_player';
  // Erros vão para o log da pasta ativa (sem pasta, não há onde registrar).
  const scope = getTenantScope();
  if (!scope) return;
  if (scope.role !== 'player') {
    activityLogger.logAdmin(name, tag.toLowerCase(), finalMessage, metadata);
  } else {
    activityLogger.logError('runtime', finalMessage, metadata);
  }
}

function getErrorDigest(error: unknown): { message: string; stack?: string; code?: string } {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack, code: (error as any).code };
  }
  return { message: String(error) };
}
window.addEventListener('error', (event) => {
  const { message, stack, code } = getErrorDigest(event.error ?? event.message);
  if (isFirestoreNoise(message)) return;
  if (_isLogging) return;
  _isLogging = true;
  try {
    logGlobalBrowserError('GLOBAL_ERROR', message, stack, code, {
      filename: event.filename, lineno: event.lineno, colno: event.colno
    });
  } finally { _isLogging = false; }
});
window.addEventListener('unhandledrejection', (event) => {
  const { message, stack, code } = getErrorDigest(event.reason);
  if (isFirestoreNoise(message)) return;
  if (_isLogging) return;
  _isLogging = true;
  try {
    logGlobalBrowserError('PROMISE_ERROR', message, stack, code);
  } finally { _isLogging = false; }
});
