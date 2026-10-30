
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  type User,
} from 'firebase/auth';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import i18n from '../i18n';
import { updateLastLogin, waitForUserDoc } from './firestore';
import type { MasterAccount } from '../types/player';

function masterIdToEmail(masterId: string): string {
  const slug = masterId.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '_');
  return `${slug}@limboos.local`;
}

export type LoginResult =
  | { ok: true;  account: MasterAccount }
  | { ok: false; error: 'wrong_password' | 'network' | 'unknown'; message: string };

const PROFILE_NOT_FOUND_CODE = 'PROFILE_NOT_FOUND';
const PROFILE_TIMEOUT_CODE = 'PROFILE_TIMEOUT';

function isProfileProvisioningError(message: string): boolean {
  return message === PROFILE_NOT_FOUND_CODE
    || message === PROFILE_TIMEOUT_CODE
    || message.includes('Timeout aguardando criação do perfil')
    || message.includes('Perfil não encontrado')
    || message === 'Account not found';
}

async function callProvisionUserProfile(): Promise<void> {
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const { getApp } = await import('firebase/app');
  const functions = getFunctions(getApp(), 'southamerica-east1');
  const fn = httpsCallable(functions, 'provisionUserProfile');
  await fn();
}

/**
 * Monta MasterAccount a partir de um snapshot já carregado (evita 2º getDoc).
 */
function masterAccountFromData(uid: string, data: Record<string, unknown>): MasterAccount {
  return {
    uid,
    email: (data?.email as string) || '',
    masterName: (data?.masterName as string) || (data?.displayName as string) || 'Agente',
    role: (data?.role as MasterAccount['role']) || 'player',
    createdAt: data?.createdAt || null,
    ...data,
  } as MasterAccount;
}

let _ensureInflight: Promise<MasterAccount> | null = null;
let _ensureInflightUid: string | null = null;

/**
 * Garante users/{uid} para a sessão Auth atual.
 * 1. Fast path se o perfil já existe
 * 2. Aguarda onAuthUserCreated em contas novas
 * 3. Fallback via Cloud Function para contas Auth órfãs (login sem doc Firestore)
 */
async function ensureUserProfileOnce(user: User): Promise<MasterAccount> {
  // Token da sessão Auth já basta para Firestore — force-refresh só atrasa o login.
  await user.getIdToken();

  const userRef = doc(db, 'users', user.uid);
  let snap = await getDoc(userRef);
  if (snap.exists()) {
    // Persiste lastLogin em background; o objeto em memória reflete o acesso atual.
    void updateLastLogin(user.uid);
    return {
      ...masterAccountFromData(user.uid, snap.data() as Record<string, unknown>),
      lastLogin: Timestamp.now(),
    };
  }

  try {
    await waitForUserDoc(user.uid);
  } catch {
    try {
      await callProvisionUserProfile();
    } catch (provisionErr) {
      console.warn('[Auth] Falha ao provisionar perfil via callable:', provisionErr);
    }
  }

  snap = await getDoc(userRef);
  if (!snap.exists()) {
    throw new Error(PROFILE_NOT_FOUND_CODE);
  }

  void updateLastLogin(user.uid);
  return {
    ...masterAccountFromData(user.uid, snap.data() as Record<string, unknown>),
    lastLogin: Timestamp.now(),
  };
}

export async function ensureUserProfile(user: User): Promise<MasterAccount> {
  if (_ensureInflight && _ensureInflightUid === user.uid) {
    return _ensureInflight;
  }
  _ensureInflightUid = user.uid;
  _ensureInflight = ensureUserProfileOnce(user).finally(() => {
    _ensureInflight = null;
    _ensureInflightUid = null;
  });
  return _ensureInflight;
}

async function rollbackAuthOnProfileFailure(user: User | null): Promise<void> {
  if (user) {
    try {
      await firebaseSignOut(auth);
    } catch {
      // Ignora falha de signOut durante rollback.
    }
  }
}

function profileErrorMessage(err: unknown): string | null {
  const message = (err as Error).message ?? '';
  if (message === PROFILE_TIMEOUT_CODE || message.includes('Timeout aguardando criação do perfil')) {
    return i18n.t('auth.error.profileTimeout', { ns: 'common' });
  }
  if (
    message === PROFILE_NOT_FOUND_CODE
    || message.includes('Perfil não encontrado')
    || message === 'Account not found'
  ) {
    return i18n.t('auth.error.profileNotFound', { ns: 'common' });
  }
  return null;
}

export async function loginOrCreate(
  masterId: string,
  password: string,
): Promise<LoginResult> {
  const email = masterIdToEmail(masterId);
  
  try {
    const { user } = await signInWithEmailAndPassword(auth, email, password);
    const account = await ensureUserProfile(user);
    if (account.suspended && account.role !== 'admin') {
      await firebaseSignOut(auth);
      return { ok: false, error: 'unknown' as const, message: i18n.t('auth.error.suspended', { ns: 'common' }) };
    }
    return { ok: true, account };
  } catch (signInErr: unknown) {
    const code = (signInErr as { code?: string }).code ?? '';
    if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
      let user: User | null = null;
      try {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        user = credential.user;
        const account = await ensureUserProfile(user);
        return { ok: true, account };
      } catch (createErr: unknown) {
        await rollbackAuthOnProfileFailure(user ?? auth.currentUser);
        const createCode = (createErr as { code?: string }).code ?? '';
        const createMessage = (createErr as Error).message ?? '';
        if (createCode === 'auth/weak-password') {
          return { ok: false, error: 'wrong_password', message: i18n.t('auth.error.weakPassword', { ns: 'common' }) };
        }
        if (createCode === 'auth/email-already-in-use') {
          return { ok: false, error: 'wrong_password', message: i18n.t('auth.error.wrongPassword', { ns: 'common' }) };
        }
        const profileMsg = profileErrorMessage(createErr);
        if (profileMsg) {
          return { ok: false, error: 'unknown', message: profileMsg };
        }
        return { ok: false, error: 'unknown', message: i18n.t('auth.error.createProfile', { ns: 'common' }) };
      }
    }
    if (code === 'auth/wrong-password') {
      return { ok: false, error: 'wrong_password', message: i18n.t('auth.error.invalidCredentials', { ns: 'common' }) };
    }
    if (code.startsWith('auth/network')) {
      return { ok: false, error: 'network', message: i18n.t('auth.error.noConnection', { ns: 'common' }) };
    }
    const profileMsg = profileErrorMessage(signInErr);
    if (profileMsg) {
      await rollbackAuthOnProfileFailure(auth.currentUser);
      return { ok: false, error: 'unknown', message: profileMsg };
    }
    return { ok: false, error: 'unknown', message: i18n.t('auth.error.unexpected', { ns: 'common', code }) };
  }
}

export async function loginWithProvider(providerName: 'google' | 'apple'): Promise<LoginResult> {
  try {
    let provider;
    if (providerName === 'google') {
      provider = new GoogleAuthProvider();
    } else {
      provider = new OAuthProvider('apple.com');
    }

    const { user } = await signInWithPopup(auth, provider);
    const account = await ensureUserProfile(user);

    if (account.suspended && account.role !== 'admin') {
      await firebaseSignOut(auth);
      return { ok: false, error: 'unknown' as const, message: i18n.t('auth.error.suspended', { ns: 'common' }) };
    }

    return { ok: true, account };
  } catch (err: unknown) {
    await rollbackAuthOnProfileFailure(auth.currentUser);
    const code = (err as { code?: string }).code ?? '';
    const message = (err as Error).message ?? '';
    
    if (code === 'auth/popup-closed-by-user') {
      return { ok: false, error: 'unknown', message: i18n.t('auth.error.cancelled', { ns: 'common' }) };
    }
    if (code.startsWith('auth/network')) {
      return { ok: false, error: 'network', message: i18n.t('auth.error.noConnection', { ns: 'common' }) };
    }
    if (code === 'auth/account-exists-with-different-credential') {
      return { ok: false, error: 'unknown', message: i18n.t('auth.error.emailInUse', { ns: 'common' }) };
    }
    const profileMsg = profileErrorMessage(err);
    if (profileMsg) {
      return { ok: false, error: 'unknown', message: profileMsg };
    }
    
    return { ok: false, error: 'unknown', message: i18n.t('auth.error.provider', { ns: 'common', code }) };
  }
}

export async function logout(): Promise<void> {
  await firebaseSignOut(auth);
}

export function onAuthStateChanged(
  callback: (user: User | null) => void,
): () => void {
  return firebaseOnAuthStateChanged(auth, callback);
}

export function getCurrentFirebaseUser(): User | null {
  return auth.currentUser;
}
