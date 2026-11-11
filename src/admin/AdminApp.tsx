import React, { useState, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { auth, db } from '../lib/firebase';
import { logout } from '../store/profile';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, setDoc, serverTimestamp } from 'firebase/firestore';
import Dashboard from './components/Dashboard';
import { ToastProvider } from './components/ToastProvider';
import RetroLoading from '../components/player/RetroLoading';
import { dialogPop } from './lib/motion';
import { achievementCatalogService } from '../services/AchievementCatalogService';
import { npcSmsCatalogService } from '../services/NpcSmsCatalogService';
import { setTenantScope, type TenantScope } from '../lib/tenantScope';
import { clearCampaignRegistry } from '../data/campaigns';
import { intelRegistry } from '../data/intel_registry';
import type { WorkspaceMembership } from '../types/workspace';
import { AdminScopeProvider, type AdminScopeValue, type WorkspaceOption } from './context/AdminScopeContext';

// Lazy-load Material Symbols font (admin-only, ~250KB)
const MATERIAL_SYMBOLS_URL = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap';
const ACTIVE_WORKSPACE_KEY = 'limboos.admin.workspace';

interface AccessState {
  options: WorkspaceOption[];
  isPlatformAdmin: boolean;
  actorName: string;
}

/** Pastas em que a conta mestra: a própria (workspaces/{uid}) e as de co-mestre. */
async function loadAccess(user: User): Promise<AccessState> {
  const [ownSnap, membershipSnap, token, userSnap] = await Promise.all([
    getDoc(doc(db, 'workspaces', user.uid)).catch(() => null),
    getDocs(collection(db, 'users', user.uid, 'memberships')).catch(() => null),
    user.getIdTokenResult().catch(() => null),
    getDoc(doc(db, 'users', user.uid)).catch(() => null),
  ]);

  const options: WorkspaceOption[] = [];
  if (ownSnap?.exists()) {
    options.push({
      wsId: user.uid,
      name: String(ownSnap.data()?.name || ''),
      role: 'owner',
      campaignIds: null,
    });
  }
  membershipSnap?.docs.forEach((d) => {
    const m = d.data() as WorkspaceMembership;
    const campaignIds = Array.isArray(m.cogmCampaignIds) ? m.cogmCampaignIds : [];
    if (campaignIds.length === 0 || d.id === user.uid) return;
    options.push({ wsId: d.id, name: m.workspaceName || '', role: 'cogm', campaignIds });
  });

  const profile = userSnap?.exists() ? userSnap.data() : {};
  return {
    options,
    isPlatformAdmin: token?.claims.platformAdmin === true,
    actorName: String(profile?.masterName || profile?.displayName || user.displayName || user.email || 'mestre'),
  };
}

function readStoredWorkspace(): string | null {
  try {
    return window.localStorage.getItem(ACTIVE_WORKSPACE_KEY);
  } catch {
    return null;
  }
}

function storeWorkspace(wsId: string) {
  try {
    window.localStorage.setItem(ACTIVE_WORKSPACE_KEY, wsId);
  } catch {
    /* aba privada: a escolha vale só nesta sessão */
  }
}

export default function App() {
  const { t } = useTranslation('admin');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [access, setAccess] = useState<AccessState | null>(null);
  const [activeWsId, setActiveWsId] = useState<string | null>(null);

  const refreshAccess = useCallback(async (currentUser: User) => {
    const next = await loadAccess(currentUser);
    setAccess(next);
    const stored = readStoredWorkspace();
    const preferred =
      next.options.find((o) => o.wsId === stored)
      ?? next.options.find((o) => o.role === 'owner')
      ?? next.options[0]
      ?? null;
    setActiveWsId(preferred?.wsId ?? null);
  }, []);

  useEffect(() => {
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
        getDoc(userRef)
          .then((userSnap) => {
            if (userSnap.exists()) {
              setDoc(userRef, { lastLogin: serverTimestamp() }, { merge: true })
                .catch(err => console.warn('[AdminApp] Error updating login timestamp:', err));
            }
          })
          .catch((err) => console.warn('[AdminApp] Error fetching user doc:', err));
        await refreshAccess(currentUser);
      } else {
        setAccess(null);
        setActiveWsId(null);
        setTenantScope(null);
      }
      setLoading(false);
    });
    return () => {
      unsubscribe();
      stopCatalog();
      stopNpcSms();
      setTenantScope(null);
    };
  }, [refreshAccess]);

  const activeOption = useMemo(
    () => access?.options.find((o) => o.wsId === activeWsId) ?? null,
    [access, activeWsId],
  );

  const scope: TenantScope | null = useMemo(() => {
    if (!user || !activeOption) return null;
    return {
      wsId: activeOption.wsId,
      role: activeOption.role,
      campaignIds: activeOption.campaignIds,
      workspaceName: activeOption.name,
      actorUid: user.uid,
      actorName: access?.actorName,
    };
  }, [user, activeOption, access?.actorName]);

  // A pasta ativa precisa estar definida antes de o Dashboard montar, porque os
  // listeners dos painéis leem dela. O Dashboard só renderiza depois deste efeito.
  const [readyWsId, setReadyWsId] = useState<string | null>(null);
  useLayoutEffect(() => {
    setTenantScope(scope);
    setReadyWsId(scope?.wsId ?? null);
  }, [scope]);

  const switchWorkspace = useCallback((wsId: string) => {
    if (wsId === activeWsId) return;
    clearCampaignRegistry();
    intelRegistry.reset();
    storeWorkspace(wsId);
    setActiveWsId(wsId);
    window.history.pushState(null, '', '/admin');
  }, [activeWsId]);

  useEffect(() => {
    if (activeWsId) storeWorkspace(activeWsId);
  }, [activeWsId]);

  if (loading || (user && access === null)) {
    return (
      <RetroLoading
        fullScreen
        message={t('loading.protocols')}
        subMessage={t('loading.terminal')}
      />
    );
  }

  if (!user) {
    return <AccessShell>
      <AccessHeader eyebrow={t('accessDenied.eyebrow')} title={t('accessDenied.title')} />
      <p className="text-sm text-ash-400 leading-relaxed text-pretty">{t('accessDenied.needAuth')}</p>
      <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
        <a href="/?mode=play" className="lmb-btn lmb-btn-primary">{t('accessDenied.goPlayer')}</a>
        <a href="/" className="lmb-btn">{t('accessDenied.login')}</a>
      </div>
    </AccessShell>;
  }

  if (!scope || !activeOption || !access) {
    return (
      <CreateWorkspaceScreen
        user={user}
        onCreated={() => void refreshAccess(user)}
      />
    );
  }

  if (readyWsId !== scope.wsId) {
    return (
      <RetroLoading
        fullScreen
        message={t('loading.protocols')}
        subMessage={t('loading.terminal')}
      />
    );
  }

  const scopeValue: AdminScopeValue = {
    scope,
    options: access.options,
    isPlatformAdmin: access.isPlatformAdmin,
    isOwner: scope.role === 'owner',
    isCoGm: scope.role === 'cogm',
    canManage: scope.role === 'owner',
    switchWorkspace,
  };

  return (
    <AdminScopeProvider value={scopeValue}>
      <ToastProvider>
        <Dashboard key={scope.wsId} user={user} onLogout={logout} />
      </ToastProvider>
    </AdminScopeProvider>
  );
}

function AccessShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full h-full min-h-screen flex items-center justify-center bg-surface relative overflow-hidden">
      <div className="noise-overlay" />
      <div className="scanlines" />
      <div className="vignette" />
      <motion.div
        variants={dialogPop}
        initial="hidden"
        animate="visible"
        className="relative z-10 max-w-md w-full mx-4 bg-surface-container-low rounded-panel p-8 text-center space-y-5"
      >
        {children}
      </motion.div>
    </div>
  );
}

function AccessHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <>
      <p className="flex items-center justify-center gap-2 text-[10px] font-display font-bold uppercase tracking-[0.08em] text-primary">
        <span className="lmb-led text-accent animate-led" aria-hidden />
        {eyebrow}
      </p>
      <h1 className="font-display text-2xl font-bold text-bone uppercase tracking-tight text-balance">
        {title}
      </h1>
    </>
  );
}

/**
 * Primeira entrada no painel: a conta ainda não tem pasta nem convite de
 * co-mestre. Criar a pasta grava workspaces/{uid} (permitido pelas regras).
 */
function CreateWorkspaceScreen({ user, onCreated }: { user: User; onCreated: () => void }) {
  const { t } = useTranslation('admin');
  const [name, setName] = useState(() => (user.displayName ? `Mesa de ${user.displayName}` : ''));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setError(null);
    try {
      await setDoc(doc(db, 'workspaces', user.uid), {
        ownerUid: user.uid,
        name: trimmed.slice(0, 79),
        createdAt: serverTimestamp(),
      });
      onCreated();
    } catch (err) {
      console.error('[AdminApp] createWorkspace failed:', err);
      setError(t('workspace.createFail'));
      setSaving(false);
    }
  };

  return (
    <AccessShell>
      <AccessHeader eyebrow={t('workspace.eyebrow')} title={t('workspace.createTitle')} />
      <p className="text-sm text-ash-400 leading-relaxed text-pretty">{t('workspace.createBody')}</p>
      <form onSubmit={handleCreate} className="space-y-3 text-left">
        <label className="block text-[10px] font-display font-bold uppercase tracking-wider text-ash-500" htmlFor="ws-name">
          {t('workspace.nameLabel')}
        </label>
        <input
          id="ws-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={79}
          autoFocus
          className="w-full bg-black/40 rounded-sm px-3 py-2 text-sm text-bone font-mono outline-none"
          placeholder={t('workspace.namePlaceholder')}
        />
        {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
        <button type="submit" disabled={!name.trim() || saving} className="lmb-btn lmb-btn-primary w-full">
          {saving ? t('workspace.creating') : t('workspace.createAction')}
        </button>
      </form>
      <p className="text-xs text-ash-500 leading-relaxed text-pretty">{t('workspace.inviteHint')}</p>
      <div className="flex flex-col sm:flex-row gap-2 justify-center pt-1">
        <button type="button" onClick={() => void logout()} className="lmb-btn">
          {t('accessDenied.endSession')}
        </button>
        <a href="/?mode=play" className="lmb-btn">{t('accessDenied.goPlayer')}</a>
      </div>
    </AccessShell>
  );
}
