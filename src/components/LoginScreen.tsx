import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { Lock, Terminal, Cpu, AlertTriangle, ChevronRight } from 'lucide-react';
import { loginOrCreate, loginWithProvider } from '../store/profile';
import type { MasterAccount } from '../types/player';
import { EASE_OUT, EXIT_FAST } from '../lib/motion';

interface LoginScreenProps {
  onLogin: (account: MasterAccount) => void;
}

import RetroSpinner from './player/RetroSpinner';

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const { t } = useTranslation('player');
  const { t: tCommon } = useTranslation('common');
  const [masterId, setMasterId] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterId.trim() || !password) return;
    
    const forbiddenChars = /[<>{}"'`=]/;
    if (forbiddenChars.test(masterId) || forbiddenChars.test(password)) {
      setError(t('auth.error.forbiddenChars', { ns: 'common' }));
      return;
    }

    setError(null);
    setIsLoggingIn(true);
    const result = await loginOrCreate(masterId.trim(), password);
    setIsLoggingIn(false);

    if (!result.ok) {
      setError((result as Extract<typeof result, { ok: false }>).message);
      return;
    }

    // Navega direto — animação de sucesso + AnimatePresence aninhado travava a troca de tela.
    onLogin(result.account);
  };

  const handleProviderLogin = async (provider: 'google' | 'apple') => {
    setError(null);
    setIsLoggingIn(true);
    const result = await loginWithProvider(provider);
    setIsLoggingIn(false);

    if (!result.ok) {
      setError((result as Extract<typeof result, { ok: false }>).message);
      return;
    }

    onLogin(result.account);
  };

  return (
    <div className="w-full h-full flex items-center justify-center p-4 overflow-y-auto relative safe-area-pad min-h-0">
      <div className="noise-overlay" />
      <div className="scanlines" />
      <div className="vignette" />

      <div className="absolute inset-0 opacity-[0.035] pointer-events-none select-none overflow-hidden">
        <div className="absolute top-8 left-8 text-display text-[12vw] text-industrial-silver">TAC-01</div>
        <div className="absolute bottom-8 right-8 text-display text-[12vw] text-industrial-silver text-right">SYS-86</div>
      </div>

      <motion.div
        key="login-panel"
        initial={{ opacity: 0, transform: 'translateY(12px) scale(0.98)' }}
        animate={{ opacity: 1, transform: 'translateY(0px) scale(1)' }}
        exit={{ opacity: 0, transition: EXIT_FAST }}
        transition={{ duration: 0.32, ease: EASE_OUT }}
        className="w-full max-w-md relative"
      >
        <div className="bg-surface-raised rounded-card border border-border shadow-panel relative overflow-hidden">
          <div className="absolute -top-3 right-6 bg-accent px-2 py-0.5 text-[10px] font-display font-bold text-black tracking-widest uppercase z-10 rounded-inset">
            {t('login.badge')}
          </div>
          <div className="p-8">
            <div className="mb-10 border-l-2 border-accent pl-6">
              <div className="text-protocol text-ash-500 mb-3">{t('login.eyebrow')}</div>
              <h1 className="text-display text-4xl sm:text-5xl text-bone mb-2">
                {tCommon('brand.limbo')}<span className="text-accent">{tCommon('brand.os')}</span>
              </h1>
              <p className="text-protocol text-ash-400">
                {t('login.subtitle')}
              </p>
            </div>
            <form onSubmit={handleLogin} className="space-y-8">
              <div className="space-y-6">
                <div className="group">
                  <label htmlFor="login-master-id" className="text-protocol text-ash-400 group-focus-within:text-accent transition-colors duration-(--duration-fast) mb-2 block">
                    {t('login.label.id')}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-ash-500 group-focus-within:text-accent transition-colors duration-(--duration-fast)">
                      <Terminal size={16} />
                    </div>
                    <input id="login-master-id" type="text" required value={masterId} onChange={e => setMasterId(e.target.value)}
                      placeholder={t('login.placeholder.id')}
                      autoComplete="username" autoCapitalize="none" spellCheck={false}
                      aria-invalid={Boolean(error)} aria-describedby={error ? 'login-error' : undefined}
                      className="focus-bare w-full bg-surface-sunken border border-border rounded-control py-4 pl-12 pr-4 text-bone shadow-pressed font-sans text-base tracking-wide focus:ring-0 focus:border-border-accent placeholder:text-ash-600 outline-none transition-colors duration-(--duration-fast)" />
                    <div className="absolute bottom-0 left-4 right-4 h-px bg-accent scale-x-0 origin-left transition-transform duration-(--duration-base) ease-limbo group-focus-within:scale-x-100" />
                  </div>
                </div>

                <div className="group">
                  <label htmlFor="login-password" className="text-protocol text-ash-400 group-focus-within:text-accent transition-colors duration-(--duration-fast) mb-2 block">
                    {t('login.label.password')}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-ash-500 group-focus-within:text-accent transition-colors duration-(--duration-fast)">
                      <Lock size={16} />
                    </div>
                    <input id="login-password" type="password" required value={password} onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      aria-invalid={Boolean(error)} aria-describedby={error ? 'login-error' : undefined}
                      className="focus-bare w-full bg-surface-sunken border border-border rounded-control py-4 pl-12 pr-4 text-bone shadow-pressed font-sans text-base tracking-wide focus:ring-0 focus:border-border-accent placeholder:text-ash-600 outline-none transition-colors duration-(--duration-fast)" />
                    <div className="absolute bottom-0 left-4 right-4 h-px bg-accent scale-x-0 origin-left transition-transform duration-(--duration-base) ease-limbo group-focus-within:scale-x-100" />
                  </div>
                </div>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div id="login-error" role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2, ease: EASE_OUT }}
                    className="bg-error-container/30 border border-error/40 rounded-control p-3 flex items-center gap-3 overflow-hidden">
                    <AlertTriangle size={14} className="text-error shrink-0" />
                    <span className="text-protocol text-error">{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center justify-between gap-6 pt-2">
                <p className="text-[9px] font-display text-ash-600 uppercase tracking-widest leading-relaxed">
                  {t('login.hint.register')}
                </p>
                <button type="submit" disabled={isLoggingIn}
                  className="shrink-0 bg-accent hover:bg-primary text-[#1a0d00] font-display font-bold text-xs uppercase tracking-[0.2em] py-4 px-8 rounded-control transition duration-(--duration-fast) flex items-center justify-center gap-3 group disabled:opacity-50 disabled:cursor-not-allowed glow-orange-subtle active:scale-[0.97]">
                  {isLoggingIn ? (
                    <>
                      <RetroSpinner size="sm" />
                      {t('login.syncing')}
                    </>
                  ) : (
                    <>{t('login.submit')}<ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" /></>
                  )}
                </button>
              </div>
            </form>

            <div className="mt-8 pt-6 border-t border-border space-y-4">
              <div className="text-center">
                <span className="bg-surface-raised px-4 text-[9px] font-display font-bold uppercase tracking-[0.2em] text-ash-500">
                  {t('login.orVia')}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => handleProviderLogin('google')}
                  disabled={isLoggingIn}
                  className="group flex items-center justify-center gap-3 bg-surface-sunken hover:bg-white/5 border border-border rounded-control py-3 transition-colors duration-(--duration-fast) disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4 grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition duration-(--duration-fast)" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  <span className="text-protocol text-industrial-silver">{t('login.google')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleProviderLogin('apple')}
                  disabled={isLoggingIn}
                  className="flex items-center justify-center gap-3 bg-surface-sunken hover:bg-white/5 border border-border rounded-control py-3 transition-colors duration-(--duration-fast) disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-industrial-silver" xmlns="http://www.w3.org/2000/svg">
                    <path d="M16.365 1.43c-.004.015-.008.03-.013.045C16.143 2.115 15.534 3.02 14.618 3.7c-.895.663-1.956 1.077-3.04 1.184a2.95 2.95 0 0 1-.027-.373c-.015-.99.373-1.996 1.055-2.732.682-.736 1.63-1.185 2.57-1.312a3.81 3.81 0 0 1 .158-.02c.003-.005.006-.01.009-.015a.014.014 0 0 1 .01-.01.012.012 0 0 1 .01.006.012.012 0 0 1 .002.002h.001ZM18.96 19.866c-1.137 1.634-2.316 3.266-4.135 3.303-1.782.037-2.366-1.042-4.412-1.042-2.046 0-2.684 1.005-4.375 1.08-1.782.073-3.136-1.78-4.274-3.414C-.626 16.33-1.396 10.96 1.013 7.643c1.173-1.614 2.946-2.64 4.885-2.677 1.745-.037 3.376 1.168 4.45 1.168 1.074 0 3.053-1.458 5.176-1.238 2.197.23 3.992 1.256 5.105 2.875-4.486 2.65-3.753 8.91 1.033 10.87-1.026 2.553-2.684 5.34-3.87 7.054Z"/>
                  </svg>
                  <span className="text-protocol text-industrial-silver">{t('login.apple')}</span>
                </button>
              </div>
            </div>
          </div>
          <div className="bg-surface-panel h-10 flex items-center px-8 justify-between border-t border-border">
            <div className="flex gap-1">
              {[1,2,3,4,5].map(i => (
                <div key={i} className={`w-1.5 h-3 rounded-inset ${isLoggingIn ? 'animate-pulse bg-accent' : 'bg-border-strong'}`} style={{ animationDelay: `${i * 0.1}s` }} />
              ))}
            </div>
            <div className="text-protocol text-ash-600">{t('login.linkNode')}</div>
          </div>
        </div>
      </motion.div>

      <BootLogColumn lines={t('login.bootLog', { returnObjects: true }) as string[]} label={t('login.side.masterAccess')} />
    </div>
  );
}

/** Coluna de CRT com o log de boot do hero (só em telas largas, onde há espaço lateral). */
function BootLogColumn({ lines, label }: { lines: string[]; label: string }) {
  return (
    <div className="hidden xl:block absolute left-10 2xl:left-16 top-1/2 -translate-y-1/2 w-72" aria-hidden>
      <div className="rounded-card border border-border bg-surface-sunken p-1.5 shadow-panel">
        <div className="relative overflow-hidden rounded-inset bg-[#07110a] px-5 py-5 shadow-pressed">
          <div className="scanline animate-scanline opacity-60" />
          <motion.ul
            initial="hidden"
            animate="visible"
            variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.11, delayChildren: 0.35 } } }}
            className="space-y-1 font-mono text-[11px] leading-relaxed text-phosphor-300 [text-shadow:0_0_6px_rgba(118,212,104,0.45)]"
          >
            {lines.map((line, i) => (
              <motion.li
                key={i}
                variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.01 } } }}
                className={i === 2 ? 'pt-2' : i === 4 ? 'pt-2 border-t border-phosphor-500/20 mt-2' : undefined}
              >
                {line}
              </motion.li>
            ))}
            <motion.li
              variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.01 } } }}
              className="pt-1"
            >
              ? <span className="inline-block w-2 h-3 align-middle bg-phosphor-300 animate-blink" />
            </motion.li>
          </motion.ul>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3 px-1">
        <Cpu size={13} className="text-accent" />
        <span className="text-protocol text-ash-400">{label}</span>
        <span className="flex-1 h-px bg-border-subtle" />
        <span className="lmb-led text-accent animate-led" />
      </div>
    </div>
  );
}
