// limboos é o endereço atual; terminalhubrpg segue aceito para links já enviados.
const APP_LINK_HOSTS = new Set(['limboos.web.app', 'terminalhubrpg.web.app']);
const INVITE_PREFIX = '/convite/';
/** URL de abertura já tratado: uma recarga do WebView não volta ao convite. */
const LAUNCH_HANDLED_KEY = 'limboos.launchUrlHandled';

/** Caminho interno de um link universal aceito pelo app, ou null. Só convites. */
function invitePathFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!APP_LINK_HOSTS.has(parsed.hostname) || !parsed.pathname.startsWith(INVITE_PREFIX)) return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch (err) {
    console.warn('[Native] link inválido:', err);
    return null;
  }
}

/**
 * Navega pelo BrowserRouter sem recarregar a página: a sessão do Firebase e o estado
 * do app continuam, e a splash não volta. O router ouve `popstate` e lê a URL nova.
 * `replace` serve ao cold start, para o voltar não cair numa tela que não apareceu.
 */
export function openInternalPath(path: string, options?: { replace?: boolean }): void {
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (current === path) return;
  if (options?.replace) window.history.replaceState({}, '', path);
  else window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
}

/**
 * Links universais: o convite aberto no celular cai no app em vez do navegador.
 * App aberto: `appUrlOpen`. App fechado: `getLaunchUrl`, porque o evento do cold start
 * pode chegar antes deste ouvinte. Os dois caminhos podem trazer o mesmo URL; o
 * segundo vira no-op porque a rota já é a do convite.
 */
export async function initDeepLinks(): Promise<void> {
  const { App } = await import('@capacitor/app');
  await App.addListener('appUrlOpen', ({ url }) => {
    const path = invitePathFromUrl(url);
    if (path) openInternalPath(path);
  });

  const launch = await App.getLaunchUrl().catch(() => undefined);
  const launchUrl = launch?.url;
  if (!launchUrl || readHandledLaunch() === launchUrl) return;
  writeHandledLaunch(launchUrl);
  const launchPath = invitePathFromUrl(launchUrl);
  if (launchPath) openInternalPath(launchPath, { replace: true });
}

function readHandledLaunch(): string | null {
  try {
    return sessionStorage.getItem(LAUNCH_HANDLED_KEY);
  } catch {
    return null;
  }
}

function writeHandledLaunch(url: string): void {
  try {
    sessionStorage.setItem(LAUNCH_HANDLED_KEY, url);
  } catch {
    // sem storage: uma recarga pode reabrir o convite, sem outro efeito
  }
}
