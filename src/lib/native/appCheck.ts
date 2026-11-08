import type { FirebaseApp } from 'firebase/app';

/**
 * App Check nativo (App Attest / Play Integrity), desligado até os provedores
 * serem registrados no console: VITE_NATIVE_APP_CHECK=true liga.
 */
export async function initNativeAppCheck(app: FirebaseApp): Promise<void> {
  const [{ FirebaseAppCheck }, { initializeAppCheck, CustomProvider }] = await Promise.all([
    import('@capacitor-firebase/app-check'),
    import('firebase/app-check'),
  ]);
  await FirebaseAppCheck.initialize({ isTokenAutoRefreshEnabled: true });
  initializeAppCheck(app, {
    isTokenAutoRefreshEnabled: true,
    provider: new CustomProvider({
      getToken: async () => {
        const { token, expireTimeMillis } = await FirebaseAppCheck.getToken();
        return { token, expireTimeMillis: expireTimeMillis ?? Date.now() + 3_600_000 };
      },
    }),
  });
}
