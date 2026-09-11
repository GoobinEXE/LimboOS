import React, { useEffect } from 'react';
import { motion } from 'motion/react';
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
      className={`w-full flex items-center gap-5 p-5 rounded-card bg-surface-raised border transition-all duration-200 group text-left active:scale-[0.99] ${
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
        <p className="text-protocol text-[9px] text-industrial-silver/40 mt-1 truncate group-hover:text-industrial-silver/60 transition-colors">{sub}</p>
      </div>
      <ChevronRight
        size={20}
        className={`shrink-0 opacity-30 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all ${isDanger ? 'text-red-400' : 'text-primary'}`}
      />
    </button>
  );
};

export const SecurityMenu = ({ onClose, onLogout, onShowProfile, onChangeCharacter }: SecurityMenuProps) => {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <motion.div
      initial={{ y: '-100%' }}
      animate={{ y: 0 }}
      exit={{ y: '-100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="absolute inset-0 z-100 bg-surface/98 backdrop-blur-xl flex flex-col border-b border-border-accent shadow-2xl overflow-hidden touch-none"
    >
      <div className="noise-overlay" />
      <div className="scanlines" />
      <div className="absolute inset-x-0 top-0 h-64 pointer-events-none bg-linear-to-b from-accent-05 to-transparent z-10" />

      <header className="px-6 sm:px-8 pt-[max(1.5rem,env(safe-area-inset-top))] pb-6 border-b border-border flex justify-between items-center bg-surface-raised/60 relative z-20">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-14 h-14 rounded-control bg-accent-10 border border-border-accent flex items-center justify-center text-primary shrink-0 glow-orange-subtle">
            <ShieldAlert size={28} />
          </div>
          <div className="min-w-0">
            <p className="text-protocol text-[9px] text-primary/60">Protocolos de Acesso RM-84</p>
            <h2 className="text-display text-2xl text-white uppercase mt-0.5 truncate">
              Menu de <span className="text-primary">Segurança</span>
            </h2>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar menu"
          className="w-11 h-11 rounded-control border border-border bg-surface-panel text-primary flex items-center justify-center hover:border-border-accent hover:bg-accent-10 active:scale-95 transition-all duration-200 group shrink-0"
        >
          <X size={22} className="group-hover:rotate-90 transition-transform duration-300" />
        </button>
      </header>

      <div className="flex-1 px-6 sm:px-8 py-6 space-y-3 relative z-20 overflow-y-auto custom-scrollbar">
        <ActionBtn index="01" onClick={onShowProfile} icon={User} title="Dossiê do Agente" sub="Registros, arquivos e medalhas" />
        <ActionBtn index="02" onClick={onChangeCharacter} icon={Users} title="Alternar Agente" sub="Assumir nova identidade de campo" />
        <ActionBtn index="03" onClick={onLogout} icon={LogOut} title="Desconectar Link" sub="Encerrar sessão no terminal atual" tone="danger" />
      </div>

      <footer className="px-6 sm:px-8 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-border-subtle bg-surface-raised/40 relative z-20">
        <div className="flex justify-between items-center text-mono-ui text-[9px] text-industrial-silver/30">
          <span>Indústrias Smile © 2026</span>
          <span>Grid: RM-NODE-ALPHA</span>
        </div>
      </footer>
    </motion.div>
  );
};
