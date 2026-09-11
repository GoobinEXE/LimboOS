import { useState, useEffect } from 'react';

const WEBKIT_LITE_CLASS = 'webkit-lite';

/**
 * Safari (macOS/iOS) e browsers iOS (Chrome/Firefox) — mesmo motor WebKit.
 * Inclui Safari no MacBook; Chrome/Firefox/Edge desktop não entram.
 */
export function isWebKitLite(): boolean {
  if (typeof navigator === 'undefined') return false;

  const ua = navigator.userAgent;

  // iPhone / iPod / iPad clássico
  if (/iP(hone|od|ad)/.test(ua)) return true;

  // iPadOS 13+ reporta Macintosh + touch
  if (/Macintosh/.test(ua) && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1) {
    return true;
  }

  // API proprietária do Safari (macOS e iOS)
  if (typeof window !== 'undefined' && 'safari' in window) return true;

  // Safari desktop: tem Safari, sem Chrome/Chromium/Android
  const isSafari =
    /Safari/i.test(ua) &&
    !/Chrome|Chromium|CriOS|Edg|OPR|Firefox|FxiOS|Android/i.test(ua);

  return isSafari;
}

export function applyWebKitLiteClass(): void {
  if (typeof document === 'undefined') return;
  if (isWebKitLite()) {
    document.documentElement.classList.add(WEBKIT_LITE_CLASS);
  }
}

/** SSR-safe: default false até hidratar / ler a classe no documento. */
export function useWebkitLite(): boolean {
  const [lite, setLite] = useState(() => {
    if (typeof document === 'undefined') return false;
    return document.documentElement.classList.contains(WEBKIT_LITE_CLASS) || isWebKitLite();
  });

  useEffect(() => {
    const active = isWebKitLite();
    if (active) {
      document.documentElement.classList.add(WEBKIT_LITE_CLASS);
    }
    setLite(active);
  }, []);

  return lite;
}
