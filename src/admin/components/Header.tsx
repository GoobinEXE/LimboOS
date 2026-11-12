import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { User } from 'firebase/auth';
import { Info, LogOut, Search } from 'lucide-react';
import AboutDialog from '../../components/AboutDialog';
import LanguageSelector from '../../components/LanguageSelector';
import { modKeyLabel } from '../lib/platform';
import type { AdminCrumb } from '../lib/adminBreadcrumb';

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
  onSpotlight?: () => void;
  /** Trilha destino › seção › entidade; o último nível é a página atual. */
  breadcrumb: AdminCrumb[];
  /** Badge da sessão ativa (esquadrão · missão). */
  sessionLabel?: string | null;
  onOpenLive?: () => void;
  /** Link para o app do jogador em modo jogo (`/?mode=play`). */
  playAsAgentHref?: string;
  onPlayAsAgent?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  /** Abre a navegação em gaveta (abaixo de `lg`, onde a barra lateral some). */
  onOpenMenu?: () => void;
}

function operatorInitials(email?: string | null): string {
  const handle = email?.split('@')[0] ?? '';
  const parts = handle.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (handle.slice(0, 2) || 'GM').toUpperCase();
}

export default function Header({
  user,
  onLogout,
  onSpotlight,
  breadcrumb,
  sessionLabel,
  onOpenLive,
  playAsAgentHref,
  onPlayAsAgent,
  onOpenMenu,
}: HeaderProps) {
  const { t } = useTranslation('admin');
  const { t: tCommon } = useTranslation('common');
  const [aboutOpen, setAboutOpen] = useState(false);
  const mod = modKeyLabel();

  return (
    <header className="w-full z-50 flex justify-between items-center gap-3 sm:gap-6 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-6 pt-[env(safe-area-inset-top)] h-[calc(3.5rem+env(safe-area-inset-top))] bg-surface-container-low border-b border-seam shrink-0">
      <div className="flex flex-1 items-center gap-3 min-w-0">
        {onOpenMenu && (
          // Contêiner com lg:hidden: o display de .lmb-btn venceria a utilidade no próprio botão
          <div className="lg:hidden -ml-2 shrink-0">
            <button
              type="button"
              onClick={onOpenMenu}
              aria-label={t('header.openMenu')}
              className="lmb-btn lmb-btn-ghost lmb-btn-icon material-symbols-outlined text-[22px] tracking-normal normal-case"
            >
              menu
            </button>
          </div>
        )}

        <nav aria-label={t('breadcrumb.navLabel')} className="min-w-0 flex-1 max-w-[32rem]">
          <ol className="flex items-center gap-1.5 min-w-0 text-[10px] font-display uppercase font-bold tracking-[0.2em] leading-4">
            {breadcrumb.map((crumb, i) => {
              const last = i === breadcrumb.length - 1;
              return (
                <li
                  key={`${i}-${crumb.label}`}
                  className={`flex items-center gap-1.5 min-w-0 ${last ? '' : 'hidden md:flex shrink-0'}`}
                >
                  {crumb.to ? (
                    <Link to={crumb.to} className="text-ash-500 hover:text-bone transition-colors truncate max-w-[12rem]">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span aria-current="page" className="text-bone/80 truncate">
                      {crumb.label}
                    </span>
                  )}
                  {!last && (
                    <span className="text-ash-700" aria-hidden>
                      ›
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        {sessionLabel ? (
          <button
            type="button"
            onClick={onOpenLive}
            className="hidden md:flex items-center gap-2 max-w-xs h-7 bg-phosphor-500/5 px-2.5 rounded-inset hover:bg-phosphor-500/10 transition-colors truncate"
            title={t('header.sessionGoLive')}
          >
            <span className="lmb-led text-phosphor-400 animate-led" aria-hidden />
            <span className="font-display uppercase font-bold tracking-[0.15em] text-[10px] text-phosphor-300 truncate">
              {t('header.sessionPrefix')} {sessionLabel}
            </span>
          </button>
        ) : (
          <span className="text-[10px] font-display uppercase font-bold tracking-[0.24em] text-ash-600 hidden 2xl:inline truncate">
            {t('header.noSession')}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {onSpotlight && (
          <button
            type="button"
            onClick={onSpotlight}
            className="group flex items-center gap-2.5 h-8 pl-2.5 pr-1.5 lg:w-56 bg-surface-sunken rounded-inset shadow-pressed transition-colors"
            title={t('header.searchTitle')}
            aria-label={t('header.searchTitle')}
          >
            <Search size={14} className="text-ash-500 group-hover:text-primary transition-colors shrink-0" />
            <span className="flex-1 text-left text-[11px] text-ash-500 group-hover:text-ash-300 hidden lg:inline transition-colors">
              {t('header.search')}
            </span>
            <kbd className="lmb-kbd hidden lg:inline-flex">
              {mod}K
            </kbd>
          </button>
        )}

        <LanguageSelector variant="admin" className="hidden sm:flex" />

        <div className="flex items-center gap-3 pl-3 border-l border-border-subtle">
          <div className="text-right hidden lg:block">
            <p className="text-xs font-display font-bold text-bone tracking-widest uppercase leading-none">
              {user?.email?.split('@')[0] || 'GM.MPG'}
            </p>
          </div>
          <div
            className="w-8 h-8 bg-accent-05 flex items-center justify-center text-primary font-display font-bold text-[10px] tracking-wider rounded-inset"
            aria-hidden
          >
            {operatorInitials(user?.email)}
          </div>
        </div>

        {playAsAgentHref && (
          <a
            href={playAsAgentHref}
            onClick={onPlayAsAgent}
            className="lmb-btn h-8 min-h-0 px-3"
            title={t('header.playAsAgentTitle')}
            aria-label={t('header.playAsAgent')}
          >
            <span className="material-symbols-outlined text-base tracking-normal normal-case" aria-hidden>
              sports_esports
            </span>
            <span className="hidden xl:inline">{t('header.playAsAgent')}</span>
          </a>
        )}

        <button
          type="button"
          onClick={() => setAboutOpen(true)}
          className="lmb-btn lmb-btn-ghost lmb-btn-icon h-8 min-h-0"
          title={tCommon('about.title')}
          aria-label={tCommon('about.openAria')}
        >
          <Info size={15} />
        </button>

        {user && (
          <button
            type="button"
            onClick={onLogout}
            className="lmb-btn lmb-btn-danger h-8 min-h-0 px-3"
            title={t('header.logoutTitle')}
          >
            <span className="hidden lg:inline">{t('header.logout')}</span>
            <LogOut size={14} />
          </button>
        )}
      </div>
      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </header>
  );
}
