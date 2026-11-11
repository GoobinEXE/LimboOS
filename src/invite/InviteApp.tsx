import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { logout } from '../store/profile';
import { inviteService } from '../services/InviteService';
import type { InvitePreview } from '../types/workspace';
import LoginScreen from '../components/LoginScreen';
import RetroLoading from '../components/player/RetroLoading';
import RetroSpinner from '../components/player/RetroSpinner';
import { dialogPop } from '../lib/motion';

const ADMIN_WORKSPACE_KEY = 'limboos.admin.workspace';

/**
 * `/convite/:token`: mostra o que o convite concede, pede login se preciso e
 * aceita. Co-mestre vai para o painel da pasta; jogador vai para a seleção de
 * agentes, onde o agente novo da mesa já aparece.
 */
export default function InviteApp() {
  const { token = '' } = useParams();
  const { t } = useTranslation('common');
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [codinome, setCodinome] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    let cancelled = false;
    inviteService
      .preview(token)
      .then((p) => !cancelled && setPreview(p))
      .catch(() => !cancelled && setPreview({ kind: 'player', workspaceName: '', campaignName: '', valid: false, reason: 'not-found' }));
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (user === undefined || preview === null) {
    return <RetroLoading fullScreen message={t('invite.loading')} subMessage={t('invite.loadingSub')} />;
  }

  if (preview.valid && !user) {
    return (
      <div className="min-h-screen bg-surface">
        <p className="text-center text-protocol text-accent pt-6 px-4">
          {t('invite.loginFirst', { campaign: preview.campaignName, workspace: preview.workspaceName })}
        </p>
        <LoginScreen onLogin={() => { /* onAuthStateChanged atualiza a tela */ }} />
      </div>
    );
  }

  const accept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (accepting) return;
    setAccepting(true);
    setError(null);
    try {
      const result = await inviteService.accept(token, codinome.trim() || undefined);
      if (result.kind === 'cogm') {
        try {
          window.localStorage.setItem(ADMIN_WORKSPACE_KEY, result.wsId);
        } catch {
          /* storage indisponível: o painel abre na pasta padrão */
        }
        window.location.assign('/admin');
      } else {
        window.location.assign('/');
      }
    } catch (err) {
      console.error('[InviteApp] acceptInvite failed:', err);
      setError(t('invite.acceptFail'));
      setAccepting(false);
    }
  };

  return (
    <div className="w-full min-h-screen flex items-center justify-center bg-surface relative overflow-hidden">
      <div className="noise-overlay" />
      <div className="scanlines" />
      <div className="vignette" />
      <motion.div
        variants={dialogPop}
        initial="hidden"
        animate="visible"
        className="relative z-10 max-w-md w-full mx-4 bg-surface-container-low rounded-panel p-8 space-y-5"
      >
        <p className="text-[10px] font-display font-bold uppercase tracking-[0.08em] text-primary text-center">
          {t('invite.eyebrow')}
        </p>
        {!preview.valid ? (
          <>
            <h1 className="font-display text-2xl font-bold text-bone uppercase tracking-tight text-center">
              {t('invite.invalidTitle')}
            </h1>
            <p className="text-sm text-ash-400 text-center">{t(`invite.reason.${preview.reason || 'not-found'}`)}</p>
            <a href="/" className="lmb-btn w-full justify-center">{t('invite.goHome')}</a>
          </>
        ) : (
          <form onSubmit={accept} className="space-y-5">
            <h1 className="font-display text-2xl font-bold text-bone uppercase tracking-tight text-center text-balance">
              {preview.kind === 'cogm' ? t('invite.cogmTitle') : t('invite.playerTitle')}
            </h1>
            <p className="text-sm text-ash-300 text-center text-pretty">
              {preview.kind === 'cogm'
                ? t('invite.cogmBody', { campaign: preview.campaignName, workspace: preview.workspaceName })
                : t('invite.playerBody', { campaign: preview.campaignName, workspace: preview.workspaceName })}
            </p>
            {preview.kind === 'player' && (
              <label className="block space-y-2">
                <span className="text-[10px] font-display font-bold uppercase tracking-wider text-ash-500">{t('invite.codinome')}</span>
                <input
                  value={codinome}
                  onChange={(e) => setCodinome(e.target.value)}
                  maxLength={60}
                  placeholder={t('invite.codinomePlaceholder')}
                  className="w-full bg-black/40 rounded-sm px-3 py-2 text-sm text-bone font-mono uppercase outline-none"
                />
                <span className="block text-[10px] text-ash-500">{t('invite.codinomeHint')}</span>
              </label>
            )}
            <p className="text-[11px] text-ash-500 text-center">
              {t('invite.signedAs', { name: user?.displayName || user?.email || '' })}{' '}
              <button type="button" onClick={() => void logout()} className="underline hover:text-bone">{t('invite.switchAccount')}</button>
            </p>
            {error && <p role="alert" className="text-xs text-red-400 text-center">{error}</p>}
            <button type="submit" disabled={accepting} className="lmb-btn lmb-btn-primary w-full justify-center">
              {accepting ? <RetroSpinner size="sm" /> : t('invite.accept')}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
