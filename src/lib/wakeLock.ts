/**
 * Tela acesa durante a escuta (J16). Sem suporte ou com falha (bateria baixa, iframe),
 * tudo vira no-op silencioso.
 */
declare global {
  interface Window {
    /** Só em dev: true enquanto há um wake lock ativo. */
    __wakeLockActive?: boolean;
  }
}

function flag(active: boolean): void {
  if (import.meta.env.DEV && typeof window !== 'undefined') window.__wakeLockActive = active;
}

/** Pede o lock de tela e devolve a função que o libera. */
export async function acquireWakeLock(): Promise<() => void> {
  try {
    const lock = await navigator.wakeLock?.request('screen');
    if (!lock) return () => undefined;
    flag(true);
    return () => {
      flag(false);
      void lock.release().catch(() => undefined);
    };
  } catch {
    return () => undefined;
  }
}

/**
 * Mantém o lock enquanto durar a chamada até o release devolvido, readquirindo-o
 * quando a aba volta a ficar visível (o sistema o solta ao ocultar).
 */
export function holdWakeLock(): () => void {
  let release: (() => void) | null = null;
  let disposed = false;

  const acquire = async () => {
    if (disposed || release || document.visibilityState !== 'visible') return;
    const rel = await acquireWakeLock();
    if (disposed || release) {
      rel();
      return;
    }
    release = rel;
  };
  const onVisibility = () => {
    if (document.visibilityState === 'visible') void acquire();
    else {
      release?.();
      release = null;
    }
  };

  document.addEventListener('visibilitychange', onVisibility);
  void acquire();
  return () => {
    disposed = true;
    document.removeEventListener('visibilitychange', onVisibility);
    release?.();
    release = null;
  };
}
