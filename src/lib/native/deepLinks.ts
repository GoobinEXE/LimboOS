const APP_LINK_HOST = 'terminalhubrpg.web.app';

/**
 * Links universais: o convite aberto no celular cai no app em vez do navegador.
 * Recarregar a rota é o caminho mais simples, porque o convite roda fora do Player.
 */
export async function initDeepLinks(): Promise<void> {
  const { App } = await import('@capacitor/app');
  await App.addListener('appUrlOpen', ({ url }) => {
    try {
      const parsed = new URL(url);
      if (parsed.hostname !== APP_LINK_HOST || !parsed.pathname.startsWith('/convite/')) return;
      if (window.location.pathname !== parsed.pathname) window.location.assign(parsed.pathname);
    } catch (err) {
      console.warn('[Native] link inválido:', err);
    }
  });
}
