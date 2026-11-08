import {
  GoogleAuthProvider,
  OAuthProvider,
  signInWithCredential,
  type User,
} from 'firebase/auth';
import { auth } from '../firebase';

/**
 * Login Google/Apple dentro do app nativo.
 *
 * signInWithPopup não funciona no WebView. O plugin abre a folha nativa do provedor
 * (com skipNativeAuth no capacitor.config.ts), devolve o idToken, e a sessão é criada
 * no SDK web com signInWithCredential. Assim onAuthStateChanged continua sendo a
 * fonte única da sessão (usePlayerAuth).
 */
export type NativeProvider = 'google' | 'apple';

/** Erro com `code` no formato do SDK web, para reaproveitar o mapeamento de profile.ts. */
function authError(code: string, message: string): Error & { code: string } {
  return Object.assign(new Error(message), { code });
}

function isCancellation(err: unknown): boolean {
  const message = (err as Error)?.message ?? '';
  const code = String((err as { code?: unknown })?.code ?? '');
  return /cancel/i.test(message) || /cancel/i.test(code) || code === '1001' || code === '12501';
}

export async function signInWithNativeProvider(provider: NativeProvider): Promise<User> {
  const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');

  try {
    if (provider === 'google') {
      const result = await FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true });
      const idToken = result.credential?.idToken;
      const accessToken = result.credential?.accessToken;
      if (!idToken && !accessToken) {
        throw authError('auth/missing-credential', 'Google não retornou credencial.');
      }
      const credential = GoogleAuthProvider.credential(idToken ?? null, accessToken ?? null);
      return (await signInWithCredential(auth, credential)).user;
    }

    const result = await FirebaseAuthentication.signInWithApple({ skipNativeAuth: true });
    const idToken = result.credential?.idToken;
    if (!idToken) {
      throw authError('auth/missing-credential', 'Apple não retornou credencial.');
    }
    const credential = new OAuthProvider('apple.com').credential({
      idToken,
      rawNonce: result.credential?.nonce,
    });
    return (await signInWithCredential(auth, credential)).user;
  } catch (err) {
    if (isCancellation(err)) {
      throw authError('auth/popup-closed-by-user', 'Login cancelado.');
    }
    throw err;
  }
}

/** Limpa a conta Google/Apple lembrada pelo SDK nativo. Falha silenciosa. */
export async function signOutNativeProviders(): Promise<void> {
  try {
    const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
    await FirebaseAuthentication.signOut();
  } catch {
    // Sem sessão nativa ativa (login por email/senha).
  }
}
