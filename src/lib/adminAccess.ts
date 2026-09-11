import type { User } from 'firebase/auth';
import { loadMasterAccount } from '../store/firestore';
import type { MasterAccount } from '../types/player';

export function isAdminAccount(
  account: Pick<MasterAccount, 'role' | 'uid'> | null | undefined,
): boolean {
  return account?.role === 'admin';
}

export async function resolveAdminAccess(user: User): Promise<boolean> {
  try {
    const token = await user.getIdTokenResult();
    if (token.claims.admin === true) return true;
  } catch {
    // Token indisponível — segue para checagem no Firestore.
  }

  try {
    const account = await loadMasterAccount(user.uid);
    return account.role === 'admin';
  } catch {
    return false;
  }
}

/**
 * Admin permanece no Player apenas com `?mode=play` na URL.
 * A History API do player preserva esse param nas navegações internas;
 * não usamos sessionStorage sticky — ele fazia login normal cair em
 * seleção/criação de agentes em vez de redirecionar para /admin.
 */
export function wantsPlayAsPlayerMode(): boolean {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'play') return true;
    // Limpa residual de sessões antigas (flag sticky pré-fix).
    sessionStorage.removeItem('limbo_play_as_player');
    return false;
  } catch {
    return false;
  }
}

export function clearPlayAsPlayerMode(): void {
  try {
    sessionStorage.removeItem('limbo_play_as_player');
  } catch {
    // ignore
  }
}

export function redirectToAdminPanel(): void {
  if (wantsPlayAsPlayerMode()) return;
  clearPlayAsPlayerMode();
  window.location.href = '/admin';
}
