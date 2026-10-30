import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { FADE, SPRING_DRAWER } from '../../lib/motion';
import { LogOut, User, X, ShieldAlert, Users, ChevronRight, type LucideIcon } from 'lucide-react';

interface SecurityMenuProps {
  onClose: () => void;
  onLogout: () => void;
  onShowProfile: () => void;
  onChangeCharacter?: () => void;
}

interface ActionBtnProps {
  onClick?: () => void;
  icon: LucideIcon;
  index: string;
  title: string;
  sub: string;
  tone?: 'accent' | 'danger';
}

const ActionBtn = ({ onClick, icon: Icon, index, title, sub, tone = 'accent' }: ActionBtnProps) => {
  const isDanger = tone === 'danger';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-5 p-5 rounded-card bg-surface-raised border transition duration-200 group text-left active:scale-[0.99] ${
        isDanger
          ? 'border-border hover:border-red-500/40 hover:bg-red-500/5'
          : 'border-border hover:border-border-accent hover:bg-accent-05'
      }`}
    >
      <div
        className={`w-14 h-14 rounded-control border flex items-center justify-center shrink-0 transition-colors duration-200 ${
          isDanger
            ? 'bg-red-950/30 border-red-500/20 text-red-400 group-hover:border-red-500/50'
            : 'bg-surface-sunken border-border text-primary group-hover:border-border-accent group-hover:bg-accent-10'
        }`}
      >
        <Icon size={26} />
      </div>
      <div className="flex-1 min-w-0">
        <span className={`text-mono-ui text-[10px] ${isDanger ? 'text-red-400/60' : 'text-primary/50'}`}>{index}</span>
        <h3 className={`text-display text-lg uppercase mt-0.5 truncate transition-colors ${isDanger ? 'text-red-400' : 'text-white group-hover:text-primary'}`}>
          {title}
        </h3>
        <p className="text-protocol text-[9px] text-ash-500 mt-1 truncate group-hover:text-ash-400 transition-colors">{sub}</p>
      </div>
      <ChevronRight
        size={20}
        className={`shrink-0 opacity-30 group-hover:opacity-100 group-hover:translate-x-0.5 transition ${isDanger ? 'text-red-400' : 'text-primary'}`}
      />
    </button>
  );
};

export const SecurityMenu = ({ onClose, onLogout, onShowProfile, onChangeCharacter }: SecurityMenuProps) => {
  const { t } = useTranslation(['player', 'common']);
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <>
    {/* Desktop: painel ancorado sob o botão de menu, com véu que fecha ao clicar fora */}
    <motion.div
      aria-hidden
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={FADE}
      onClick={onClose}
      className="hidden lg:block absolute inset-0 z-99 bg-surface-scrim"
    />
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={`${t('security.title')} ${t('security.titleAccent')}`}
      initial={{ y: '-100%' }}
      animate={{ y: 0 }}
      exit={{ y: '-100%' }}
      transition={SPRING_DRAWER}
      className="absolute inset-0 lg:inset-auto lg:top-20 lg:left-6 lg:w-[32rem] lg:max-h-[calc(100%-7rem)] lg:rounded-panel lg:border lg:border-border-strong z-100 bg-surface/98 flex flex-col border-b border-border-accent shadow-2xl overflow-hidden touch-none"
    >
      <div className="noise-overlay" />
      <div className="scanlines" />
      <div className="absolute inset-x-0 top-0 h-64 pointer-events-none bg-linear-to-b from-accent-05 to-transparent z-10" />

      <header className="px-6 sm:px-8 pt-[max(1.5rem,env(safe-area-inset-top))] pb-6 border-b border-border flex justify-between items-center bg-surface-raised/60 relative z-20">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-14 h-14 rounded-control bg-accent-10 border border-border-accent flex items-center justify-center text-primary shrink-0">
            <ShieldAlert size={28} />
          </div>
          <div className="min-w-0">
            <p className="text-protocol text-[9px] text-primary/60">{t('security.eyebrow')}</p>
            <h2 className="text-display text-2xl text-white uppercase mt-0.5 truncate">
              {t('security.title')} <span className="text-primary">{t('security.titleAccent')}</span>
            </h2>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('security.closeAria')}
          className="w-11 h-11 rounded-control border border-border bg-surface-panel text-primary flex items-center justify-center hover:border-border-accent hover:bg-accent-10 active:scale-[0.97] transition duration-200 group shrink-0"
        >
          <X size={22} className="group-hover:rotate-90 transition-transform duration-300" />
        </button>
      </header>

      <div className="flex-1 px-6 sm:px-8 py-6 space-y-3 relative z-20 overflow-y-auto custom-scrollbar">
        <ActionBtn index="01" onClick={onShowProfile} icon={User} title={t('security.dossier')} sub={t('security.dossierSub')} />
        <ActionBtn index="02" onClick={onChangeCharacter} icon={Users} title={t('security.switchAgent')} sub={t('security.switchAgentSub')} />
        <ActionBtn index="03" onClick={onLogout} icon={LogOut} title={t('security.logout')} sub={t('security.logoutSub')} tone="danger" />
      </div>

      <footer className="px-6 sm:px-8 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-border-subtle bg-surface-raised/40 relative z-20">
        <div className="flex justify-between items-center text-mono-ui text-[9px] text-ash-600">
          <span>{t('brand.smileCopyright', { ns: 'common' })}</span>
          <span>{t('security.grid')}</span>
        </div>
      </footer>
    </motion.div>
    </>
  );
};
