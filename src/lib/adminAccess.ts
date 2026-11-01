import type { User } from 'firebase/auth';
import { loadMasterAccount } from '../store/firestore';
import type { MasterAccount } from '../types/player';

/**
 * Só papel no Firestore. Serve para listar outras contas (filtrar admins da
 * presença, de seletores etc.). Para decidir se o usuário logado é admin, use
 * `resolveAdminAccess`, que também aceita a custom claim.
 */
export function isAdminAccount(
  account: Pick<MasterAccount, 'role' | 'uid'> | null | undefined,
): boolean {
  return account?.role === 'admin';
}

/**
 * Admin = custom claim `admin` OU papel `admin` na conta.
 * Quem já carregou a conta passa `account` e evita uma leitura extra do Firestore.
 */
export async function resolveAdminAccess(
  user: User,
  account?: Pick<MasterAccount, 'role'> | null,
): Promise<boolean> {
  try {
    const token = await user.getIdTokenResult();
    if (token.claims.admin === true) return true;
  } catch {
    // Token indisponível — segue para checagem do papel.
  }

  if (account) return account.role === 'admin';

  try {
    const loaded = await loadMasterAccount(user.uid);
    return loaded.role === 'admin';
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

/** Sai do modo jogador: remove `mode` e `s` do URL sem perder `history.state`. */
export function clearPlayAsPlayerMode(): void {
  try {
    sessionStorage.removeItem('limbo_play_as_player');
  } catch {
    // ignore
  }

  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('mode') && !url.searchParams.has('s')) return;
    url.searchParams.delete('mode');
    url.searchParams.delete('s');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  } catch {
    // ignore
  }
}

export function redirectToAdminPanel(): void {
  if (wantsPlayAsPlayerMode()) return;
  clearPlayAsPlayerMode();
  window.location.href = '/admin';
}

/** Ponte do modo jogador de volta ao console (recarga completa: outro bundle e outros listeners). */
export function openAdminConsole(): void {
  window.location.assign('/admin');
}
