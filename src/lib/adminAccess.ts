import type { User } from 'firebase/auth';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import type { MasterAccount } from '../types/player';

/**
 * Legado: o papel `role` da conta não concede mais nada. Mantido para os filtros
 * antigos de listas, sempre falso.
 */
export function isAdminAccount(
  _account: Pick<MasterAccount, 'role' | 'uid'> | null | undefined,
): boolean {
  return false;
}

/**
 * A conta mestra alguma mesa? Dono de pasta (workspaces/{uid}) ou co-mestre
 * convidado (users/{uid}/memberships com cogmCampaignIds). Decide as pontes
 * entre o modo jogador e o painel; o acesso real ao conteúdo é das regras.
 */
export async function resolveAdminAccess(
  user: User,
  _account?: Pick<MasterAccount, 'role'> | null,
): Promise<boolean> {
  try {
    const own = await getDoc(doc(db, 'workspaces', user.uid));
    if (own.exists()) return true;
  } catch {
    // sem permissão ou offline: segue para os convites
  }
  try {
    const memberships = await getDocs(collection(db, 'users', user.uid, 'memberships'));
    return memberships.docs.some((d) => {
      const ids = d.data().cogmCampaignIds;
      return Array.isArray(ids) && ids.length > 0;
    });
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
