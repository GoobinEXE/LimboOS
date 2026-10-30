import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { auth, db } from '../lib/firebase';
import { logout } from '../store/profile';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import Dashboard from './components/Dashboard';
import { ToastProvider } from './components/ToastProvider';
import RetroLoading from '../components/player/RetroLoading';
import { resolveAdminAccess } from '../lib/adminAccess';
import { ADMIN_SPRING_SNAP } from './lib/motion';
import { achievementCatalogService } from '../services/AchievementCatalogService';
import { npcSmsCatalogService } from '../services/NpcSmsCatalogService';

// Lazy-load Material Symbols font (admin-only, ~250KB)
const MATERIAL_SYMBOLS_URL = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap';

export default function App() {
  const { t } = useTranslation('admin');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasAdminAccess, setHasAdminAccess] = useState<boolean | null>(null);

  useEffect(() => {
    // Load Material Symbols font for admin panel
    if (!document.querySelector(`link[href="${MATERIAL_SYMBOLS_URL}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = MATERIAL_SYMBOLS_URL;
      document.head.appendChild(link);
    }

    const stopCatalog = achievementCatalogService.start();
    const stopNpcSms = npcSmsCatalogService.start();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        // Atualiza lastLogin sem tentar bootstrap de role admin no client
        getDoc(userRef)
          .then((userSnap) => {
            if (userSnap.exists()) {
              setDoc(userRef, { lastLogin: serverTimestamp() }, { merge: true })
                .catch(err => console.warn('[AdminApp] Error updating admin login timestamp:', err));
            }
          })
          .catch((err) => {
            console.warn('[AdminApp] Error fetching admin user doc:', err);
          });

        setHasAdminAccess(await resolveAdminAccess(currentUser));
      } else {
        setHasAdminAccess(false);
      }
      setLoading(false);
    });
    return () => {
      unsubscribe();
      stopCatalog();
      stopNpcSms();
    };
  }, []);

  if (loading || hasAdminAccess === null) {
    return (
      <RetroLoading
        fullScreen
        message={t('loading.protocols')}
        subMessage={t('loading.terminal')}
      />
    );
  }

  if (!user || !hasAdminAccess) {
    return (
      <div className="w-full h-full min-h-screen flex items-center justify-center bg-surface relative overflow-hidden">
        <div className="noise-overlay" />
        <div className="scanlines" />
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={ADMIN_SPRING_SNAP}
          className="relative z-10 max-w-md w-full mx-4 border border-primary/30 bg-surface-container-low/90 p-8 text-center space-y-6"
        >
          <p className="text-[10px] font-display uppercase tracking-[0.35em] text-primary/70">
            {t('accessDenied.eyebrow')}
          </p>
          <h1 className="font-display text-2xl font-bold text-white uppercase tracking-tight">
            {t('accessDenied.title')}
          </h1>
          <p className="text-sm text-industrial-silver/60 leading-relaxed">
            {!user ? t('accessDenied.needAuth') : t('accessDenied.noPrivilege')}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            {user && (
              <button
                type="button"
                onClick={() => void logout()}
                className="px-4 py-2 border border-white/10 text-[11px] font-display uppercase tracking-widest text-industrial-silver/70 hover:border-primary/40 hover:text-primary transition-colors"
              >
                {t('accessDenied.endSession')}
              </button>
            )}
            <a
              href="/?mode=play"
              className="px-4 py-2 border border-primary/40 bg-primary/10 text-[11px] font-display uppercase tracking-widest text-primary hover:bg-primary/20 transition-colors"
            >
              {t('accessDenied.goPlayer')}
            </a>
            {!user && (
              <a
                href="/"
                className="px-4 py-2 border border-white/10 text-[11px] font-display uppercase tracking-widest text-industrial-silver/70 hover:border-primary/40 hover:text-primary transition-colors"
              >
                {t('accessDenied.login')}
              </a>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  return <ToastProvider><Dashboard user={user} onLogout={logout} /></ToastProvider>;
}
