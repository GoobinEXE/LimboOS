import React from 'react';
import { useTranslation } from 'react-i18next';
import { User } from 'firebase/auth';
import { LogOut, Search } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import LanguageSelector from '../../components/LanguageSelector';
import { ADMIN_FADE } from '../lib/motion';
import { modKeyLabel } from '../lib/platform';

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
  onSpotlight?: () => void;
  contextLabel?: string;
  /** Badge da sessão ativa (esquadrão · missão). */
  sessionLabel?: string | null;
  onOpenLive?: () => void;
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
  contextLabel,
  sessionLabel,
  onOpenLive,
}: HeaderProps) {
  const { t } = useTranslation('admin');
  const label = contextLabel || t('header.defaultContext');
  const mod = modKeyLabel();

  return (
    <header className="w-full z-50 flex justify-between items-center gap-6 px-4 sm:px-6 h-14 bg-surface-container-low border-b border-seam shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2 pr-3 border-r border-border-subtle shrink-0">
          <span className="lmb-led text-accent animate-led" aria-hidden />
          <span className="font-display uppercase font-bold tracking-[0.2em] text-[9px] text-primary hidden sm:inline">
            {t('header.statusConnected')}
          </span>
        </div>

        <span className="relative hidden lg:block min-w-[10rem] h-4">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={label}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.08 } }}
              transition={ADMIN_FADE}
              className="absolute inset-0 text-[10px] font-display uppercase font-bold tracking-[0.24em] text-bone/70 truncate leading-4"
            >
              {label}
            </motion.span>
          </AnimatePresence>
        </span>

        {sessionLabel ? (
          <button
            type="button"
            onClick={onOpenLive}
            className="hidden md:flex items-center gap-2 max-w-xs h-7 bg-phosphor-500/5 border border-phosphor-500/25 px-2.5 rounded-inset hover:bg-phosphor-500/10 hover:border-phosphor-500/40 transition-colors truncate"
            title={t('header.sessionGoLive')}
          >
            <span className="lmb-led text-phosphor-400 animate-led" aria-hidden />
            <span className="font-display uppercase font-bold tracking-[0.15em] text-[9px] text-phosphor-300 truncate">
              {t('header.sessionPrefix')} {sessionLabel}
            </span>
          </button>
        ) : (
          <span className="text-[9px] font-display uppercase font-bold tracking-[0.24em] text-ash-600 hidden xl:inline truncate">
            {t('header.noSession')}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {onSpotlight && (
          <button
            type="button"
            onClick={onSpotlight}
            className="group flex items-center gap-2.5 h-8 pl-2.5 pr-1.5 md:w-64 bg-surface-sunken border border-border rounded-inset shadow-pressed hover:border-border-strong transition-colors"
            title={t('header.searchTitle')}
          >
            <Search size={14} className="text-ash-500 group-hover:text-primary transition-colors shrink-0" />
            <span className="flex-1 text-left text-[11px] text-ash-500 group-hover:text-ash-300 hidden md:inline transition-colors">
              {t('header.search')}
            </span>
            <kbd className="lmb-kbd hidden md:inline-flex">
              {mod}K
            </kbd>
          </button>
        )}

        <LanguageSelector variant="admin" className="hidden sm:flex" />

        <div className="flex items-center gap-3 pl-3 border-l border-border-subtle">
          <div className="text-right hidden md:block">
            <p className="text-[8px] font-display font-bold uppercase tracking-[0.2em] text-ash-500 leading-none">
              {t('header.operator')}
            </p>
            <p className="text-xs font-display font-bold text-bone tracking-widest uppercase mt-1 leading-none">
              {user?.email?.split('@')[0] || 'GM.MPG'}
            </p>
          </div>
          <div
            className="w-8 h-8 border border-accent-40 bg-accent-05 flex items-center justify-center text-primary font-display font-bold text-[10px] tracking-wider rounded-inset"
            aria-hidden
          >
            {operatorInitials(user?.email)}
          </div>
        </div>

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
    </header>
  );
}
