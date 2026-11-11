import { getPlatform, isNative } from './native/platform';

/** Primeiro ano de copyright (ver LICENSE na raiz). */
export const COPYRIGHT_START_YEAR = 2026;
export const COPYRIGHT_HOLDER = 'Marcelo Pessoa / LimboOS';
export const STUDIO_NAME = 'Dark Room';
export const APP_NAME = 'LimboOS';
export const WEBSITE_URL = 'https://terminalhubrpg.web.app';
export const SOURCE_URL = 'https://github.com/xXinous/LimboOS';

export interface AppInfo {
  /** Versão do app (nativo: CFBundleShortVersionString / versionName; web: package.json). */
  version: string;
  /** Número do build nativo (CFBundleVersion / versionCode); null na web. */
  build: string | null;
  /** Commit curto do código web empacotado. */
  commit: string | null;
  builtAt: string | null;
  platform: 'ios' | 'android' | 'web';
}

export interface LicenseEntry {
  name: string;
  version: string | null;
  license: string | null;
  url: string | null;
}

interface BuildInfoFile {
  version?: string;
  commit?: string | null;
  builtAt?: string | null;
}

let cached: Promise<AppInfo> | null = null;

async function readBuildInfo(): Promise<BuildInfoFile> {
  try {
    const res = await fetch('/build-info.json', { cache: 'no-store' });
    if (!res.ok) return {};
    return (await res.json()) as BuildInfoFile;
  } catch {
    return {};
  }
}

export function getAppInfo(): Promise<AppInfo> {
  cached ??= (async () => {
    const file = await readBuildInfo();
    const info: AppInfo = {
      version: file.version ?? '—',
      build: null,
      commit: file.commit ?? null,
      builtAt: file.builtAt ?? null,
      platform: getPlatform(),
    };
    if (isNative()) {
      try {
        const { App } = await import('@capacitor/app');
        const native = await App.getInfo();
        info.version = native.version;
        info.build = native.build;
      } catch {
        // sem plugin: fica a versão do bundle web
      }
    }
    return info;
  })();
  return cached;
}

export async function getLicenses(): Promise<LicenseEntry[]> {
  try {
    const res = await fetch('/licenses.json');
    if (!res.ok) return [];
    return (await res.json()) as LicenseEntry[];
  } catch {
    return [];
  }
}

/** "1.0.0 (3)" no app nativo, "1.0.0" na web. */
export function formatVersion(info: AppInfo): string {
  return info.build ? `${info.version} (${info.build})` : info.version;
}

export function copyrightYears(now = new Date()): string {
  const year = now.getFullYear();
  return year > COPYRIGHT_START_YEAR ? `${COPYRIGHT_START_YEAR}–${year}` : String(COPYRIGHT_START_YEAR);
}
