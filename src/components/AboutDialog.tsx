import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, Copy, ExternalLink, X } from 'lucide-react';
import DarkRoomLogo from './brand/DarkRoomLogo';
import {
  APP_NAME,
  COPYRIGHT_HOLDER,
  SOURCE_URL,
  WEBSITE_URL,
  copyrightYears,
  formatVersion,
  getAppInfo,
  getLicenses,
  type AppInfo,
  type LicenseEntry,
} from '../lib/appInfo';
import { EASE_OUT } from '../lib/motion';

interface AboutDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Tela "Sobre" no padrão dos apps grandes: identidade e versão no topo, dados do build,
 * cópia das informações para suporte, links, licenças de terceiros e a linha de copyright.
 * Serve ao jogador (perfil e login) e ao admin (cabeçalho).
 */
export default function AboutDialog({ open, onClose }: AboutDialogProps) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>{open && <AboutPanel onClose={onClose} />}</AnimatePresence>,
    document.body,
  );
}

function AboutPanel({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation('common');
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [licenses, setLicenses] = useState<LicenseEntry[] | null>(null);
  const [showLicenses, setShowLicenses] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'done' | 'error'>('idle');
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let alive = true;
    void getAppInfo().then((value) => alive && setInfo(value));
    void getLicenses().then((value) => alive && setLicenses(value));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      previousFocus.current?.focus?.();
    };
  }, [onClose]);

  const language = i18n.resolvedLanguage ?? i18n.language;
  const builtAt = info?.builtAt
    ? new Date(info.builtAt).toLocaleString(language, { dateStyle: 'medium', timeStyle: 'short' })
    : null;

  const rows: Array<[string, string]> = info
    ? [
        [t('about.row.version'), info.version],
        ...(info.build ? [[t('about.row.build'), info.build] as [string, string]] : []),
        ...(info.commit ? [[t('about.row.commit'), info.commit] as [string, string]] : []),
        ...(builtAt ? [[t('about.row.builtAt'), builtAt] as [string, string]] : []),
        [t('about.row.platform'), t(`about.platform.${info.platform}`)],
        [t('about.row.language'), language],
      ]
    : [];

  const copyInfo = async () => {
    if (!info) return;
    const text = [
      `${APP_NAME} ${formatVersion(info)}`,
      info.commit ? `commit ${info.commit}` : null,
      info.builtAt ? `build ${info.builtAt}` : null,
      `${info.platform} · ${language}`,
      navigator.userAgent,
    ]
      .filter(Boolean)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopyState('done');
    } catch {
      setCopyState('error');
    }
    window.setTimeout(() => setCopyState('idle'), 2200);
  };

  return (
    <motion.div
      className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <button
        type="button"
        aria-label={t('about.close')}
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-black/70 cursor-default"
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ duration: 0.26, ease: EASE_OUT }}
        className="relative w-full sm:max-w-md max-h-[92dvh] sm:max-h-[86dvh] flex flex-col bg-surface rounded-t-card sm:rounded-card shadow-panel overflow-hidden pb-[env(safe-area-inset-bottom)]"
      >
        <header className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border-subtle shrink-0">
          <h2 id="about-title" className="text-protocol text-ash-400">
            {t('about.title')}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={t('about.close')}
            className="w-9 h-9 rounded-control bg-surface-panel flex items-center justify-center text-ash-400 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
          {/* Identidade */}
          <section className="flex flex-col items-center text-center px-6 pt-7 pb-6">
            <img
              src="/icons/icon-192.png"
              alt=""
              width={88}
              height={88}
              className="w-[88px] h-[88px] rounded-[22%] shadow-panel"
            />
            <h3 className="mt-4 text-display text-2xl text-white tracking-wide">{APP_NAME}</h3>
            <p className="mt-1 text-mono-ui text-[11px] text-ash-500 tabular-nums">
              {info ? t('about.versionLine', { version: formatVersion(info) }) : ' '}
            </p>
          </section>

          {/* Informações do build */}
          <section className="px-5 pb-4">
            <h4 className="text-protocol text-[10px] text-ash-500 mb-2">{t('about.section.info')}</h4>
            <dl className="rounded-card bg-surface-raised divide-y divide-border-subtle">
              {rows.map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-4 px-4 py-2.5">
                  <dt className="text-xs text-ash-500">{label}</dt>
                  <dd className="text-mono-ui text-[11px] text-ash-200 text-right break-all tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
            <button
              type="button"
              onClick={copyInfo}
              disabled={!info}
              aria-live="polite"
              className="mt-2 w-full flex items-center justify-center gap-2 h-10 rounded-control bg-surface-panel text-xs text-ash-300 hover:text-white disabled:opacity-50 transition-colors"
            >
              {copyState === 'done' ? <Check size={14} className="text-phosphor-400" /> : <Copy size={14} />}
              {copyState === 'done' ? t('about.copied') : copyState === 'error' ? t('about.copyFailed') : t('about.copyInfo')}
            </button>
          </section>

          {/* Links */}
          <section className="px-5 pb-4">
            <h4 className="text-protocol text-[10px] text-ash-500 mb-2">{t('about.section.links')}</h4>
            <div className="rounded-card bg-surface-raised divide-y divide-border-subtle overflow-hidden">
              <LinkRow href={WEBSITE_URL} label={t('about.website')} hint={WEBSITE_URL.replace('https://', '')} />
              <LinkRow href={`${SOURCE_URL}/blob/main/LICENSE`} label={t('about.source')} hint="GitHub" />
              <button
                type="button"
                onClick={() => setShowLicenses((value) => !value)}
                aria-expanded={showLicenses}
                aria-controls="about-licenses"
                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors"
              >
                <span className="min-w-0">
                  <span className="block text-sm text-ash-200">{t('about.licenses')}</span>
                  {licenses && licenses.length > 0 && (
                    <span className="block text-[11px] text-ash-500 mt-0.5">
                      {t('about.licensesSub', { count: licenses.length })}
                    </span>
                  )}
                </span>
                <ChevronDown
                  size={16}
                  className={`shrink-0 text-ash-500 transition-transform duration-200 ${showLicenses ? 'rotate-180' : ''}`}
                />
              </button>
              {showLicenses && (
                <div id="about-licenses" className="px-4 py-3 bg-surface-sunken">
                  {licenses && licenses.length > 0 ? (
                    <ul className="space-y-1.5">
                      {licenses.map((lib) => (
                        <li key={lib.name} className="flex items-baseline justify-between gap-3 text-[11px]">
                          {lib.url ? (
                            <a
                              href={lib.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-mono-ui text-ash-300 hover:text-white truncate"
                            >
                              {lib.name}
                            </a>
                          ) : (
                            <span className="text-mono-ui text-ash-300 truncate">{lib.name}</span>
                          )}
                          <span className="shrink-0 text-ash-500 tabular-nums">
                            {lib.version ? `${lib.version} · ` : ''}
                            {lib.license ?? t('about.licenseUnknown')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[11px] text-ash-500">{t('about.licensesEmpty')}</p>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Estúdio e legal: logo da Dark Room só sobre Preto Fita Magnética */}
          <section className="mt-2 px-6 pt-7 pb-8 bg-[#090A0C] border-t border-border-subtle flex flex-col items-center text-center">
            <span className="text-mono-ui text-[10px] tracking-[0.12em] uppercase text-[#8F9397]">
              {t('about.developedBy')}
            </span>
            <DarkRoomLogo className="mt-4 w-36 h-auto" />
            <p className="mt-6 text-[11px] text-[#8F9397] leading-relaxed">
              {t('about.copyright', { years: copyrightYears(), holder: COPYRIGHT_HOLDER })}
            </p>
            <p className="mt-2 text-[10px] text-[#6B6F75] leading-relaxed max-w-[36ch] text-pretty">
              {t('about.licenseNote')}
            </p>
          </section>
        </div>
      </motion.div>
    </motion.div>
  );
}

function LinkRow({ href, label, hint }: { href: string; label: string; hint: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors"
    >
      <span className="min-w-0">
        <span className="block text-sm text-ash-200">{label}</span>
        <span className="block text-[11px] text-ash-500 mt-0.5 truncate">{hint}</span>
      </span>
      <ExternalLink size={14} className="shrink-0 text-ash-500" />
    </a>
  );
}
