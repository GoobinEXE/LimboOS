import React from 'react';
import { useTranslation } from 'react-i18next';
import { User } from 'firebase/auth';
import { LogOut } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import LanguageSelector from '../../components/LanguageSelector';
import { ADMIN_FADE } from '../lib/motion';

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
  onSpotlight?: () => void;
  contextLabel?: string;
  /** Badge da sessão ativa (esquadrão · missão). */
  sessionLabel?: string | null;
  onOpenLive?: () => void;
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

  return (
    <header className="w-full z-50 flex justify-between items-center px-8 h-20 bg-surface-container-low/50 backdrop-blur-md border-b border-primary/20 shrink-0">
      <div className="flex items-center gap-4 min-w-0">
        <div className="flex items-center gap-3 bg-primary/5 border border-primary/10 px-4 py-1.5 rounded-sm shrink-0">
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse shadow-[0_0_8px_rgba(255,140,0,0.4)]" />
          <span className="font-display uppercase font-bold tracking-[0.2em] text-[10px] text-primary">
            {t('header.statusConnected')}
          </span>
        </div>
        {onSpotlight && (
          <button
            onClick={onSpotlight}
            className="flex items-center gap-2 bg-black/20 border border-white/5 px-4 py-1.5 rounded-sm hover:border-primary/20 hover:bg-primary/5 transition-all group shrink-0"
            title={t('header.searchTitle')}
          >
            <span className="material-symbols-outlined text-sm text-industrial-silver/30 group-hover:text-primary transition-colors">
              search
            </span>
            <span className="font-display uppercase font-bold tracking-[0.2em] text-[9px] text-industrial-silver/20 group-hover:text-industrial-silver/40 hidden md:inline transition-colors">
              {t('header.search')}
            </span>
            <kbd className="text-[8px] font-display font-bold text-industrial-silver/15 bg-black/30 border border-white/5 px-1.5 py-0.5 rounded-sm hidden md:inline">
              ⌘K
            </kbd>
          </button>
        )}
        {sessionLabel ? (
          <button
            type="button"
            onClick={onOpenLive}
            className="hidden md:flex items-center gap-2 max-w-xs bg-emerald-500/5 border border-emerald-500/25 px-3 py-1.5 rounded-sm hover:bg-emerald-500/10 transition-colors truncate"
            title={t('header.sessionGoLive')}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="font-display uppercase font-bold tracking-[0.15em] text-[9px] text-emerald-400/90 truncate">
              {t('header.sessionPrefix')} {sessionLabel}
            </span>
          </button>
        ) : (
          <span className="text-[9px] font-display uppercase font-bold tracking-[0.3em] text-industrial-silver/20 hidden xl:inline truncate">
            {t('header.noSession')}
          </span>
        )}
        <span className="relative hidden lg:inline min-w-[8rem] h-4">
          <AnimatePresence mode="wait">
            <motion.span
              key={label}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={ADMIN_FADE}
              className="absolute inset-0 text-[9px] font-display uppercase font-bold tracking-[0.3em] text-industrial-silver/30 truncate"
            >
              {label}
            </motion.span>
          </AnimatePresence>
        </span>
      </div>

      <div className="flex items-center gap-6 shrink-0">
        <LanguageSelector variant="admin" className="hidden sm:flex" />
        <div className="flex items-center gap-4">
          <div className="text-right hidden md:block">
            <p className="text-[9px] font-display font-bold uppercase tracking-[0.2em] text-industrial-silver/40">
              {t('header.operator')}
            </p>
            <p className="text-sm font-display font-bold text-white tracking-widest uppercase">
              {user?.email?.split('@')[0] || 'GM.MPG'}
            </p>
          </div>
          <div className="w-10 h-10 border border-primary/20 bg-surface-container-high flex items-center justify-center text-primary font-display font-bold text-xs shadow-lg rounded-sm group hover:border-primary/50 transition-all">
            <span className="group-hover:scale-110 transition-transform">GM</span>
          </div>
        </div>

        {user && (
          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/5 hover:bg-red-500/10 text-red-500/60 hover:text-red-500 transition-all border border-red-500/10 hover:border-red-500/30 group"
            title={t('header.logoutTitle')}
          >
            <span className="font-display font-bold uppercase tracking-widest text-[10px]">{t('header.logout')}</span>
            <LogOut size={16} className="group-hover:translate-x-1 transition-transform" />
          </button>
        )}
      </div>
    </header>
  );
}
