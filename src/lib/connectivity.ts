import { useSyncExternalStore } from 'react';

/**
 * Estado da rede para todo o app (F2).
 *
 * `navigator.onLine === false` é confiável (o aparelho está sem rede); `true` só diz
 * que existe uma interface ativa. Por isso a UI usa este estado para avisar a queda
 * e `isNetworkError` para classificar falhas reais de requisição.
 */

function readOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

/** Leitura pontual, fora do React. */
export function getOnlineStatus(): boolean {
  return readOnline();
}

/** Assina as transições online/offline. Devolve a função que cancela. */
export function subscribeOnlineStatus(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('online', listener);
  window.addEventListener('offline', listener);
  return () => {
    window.removeEventListener('online', listener);
    window.removeEventListener('offline', listener);
  };
}

/** `true` com rede, `false` quando o navegador avisa que caiu. Re-renderiza nas transições. */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribeOnlineStatus, readOnline, () => true);
}

/** Códigos do Firebase que indicam falta de rede ou servidor inalcançável. */
const NETWORK_CODES = new Set([
  'unavailable',
  'deadline-exceeded',
  'auth/network-request-failed',
  'auth/timeout',
  'firestore/unavailable',
  'firestore/deadline-exceeded',
  'functions/unavailable',
  'functions/deadline-exceeded',
  'storage/retry-limit-exceeded',
]);

/** Mensagens de `fetch` quebrado em cada motor (Chrome, Firefox, Safari, React Native/WebView). */
const NETWORK_MESSAGE = /failed to fetch|networkerror when attempting|load failed|network request failed|network ?error|err_internet_disconnected|err_network_changed/i;

function readCode(err: object): string | null {
  const code = (err as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

function readMessage(err: unknown): string {
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const message = (err as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return '';
}

/**
 * Verdadeiro quando o erro veio da rede, não do servidor nem de permissão.
 * Reconhece os códigos do Firebase (`unavailable`, `auth/network-request-failed`...),
 * `TypeError: Failed to fetch` e equivalentes, e a Function chamada sem rede
 * (o SDK devolve `functions/internal` quando o fetch nem sai do aparelho).
 */
export function isNetworkError(err: unknown): boolean {
  return matchNetworkError(err, 0);
}

function matchNetworkError(err: unknown, depth: number): boolean {
  if (!err) return false;
  if (typeof err === 'object') {
    const code = readCode(err);
    if (code) {
      if (NETWORK_CODES.has(code)) return true;
      if ((code === 'functions/internal' || code === 'internal') && !readOnline()) return true;
    }
    // Erros embrulhados (`new Error(msg, { cause })`): olha a causa, com limite contra ciclo.
    const cause = (err as { cause?: unknown }).cause;
    if (depth < 3 && cause && cause !== err && matchNetworkError(cause, depth + 1)) return true;
  }
  return NETWORK_MESSAGE.test(readMessage(err));
}
