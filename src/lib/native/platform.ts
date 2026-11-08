import { Capacitor } from '@capacitor/core';

export type AppPlatform = 'ios' | 'android' | 'web';

/**
 * Verdadeiro dentro do app Capacitor (iOS/Android). No navegador é sempre falso,
 * e nenhum plugin nativo deve ser carregado.
 */
export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

export function getPlatform(): AppPlatform {
  const platform = Capacitor.getPlatform();
  return platform === 'ios' || platform === 'android' ? platform : 'web';
}

/** Plugin registrado no binário atual (evita chamar plugin ausente em builds antigos). */
export function hasNativePlugin(name: string): boolean {
  return isNative() && Capacitor.isPluginAvailable(name);
}
