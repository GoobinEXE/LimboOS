import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'motion/react';
import { clsx } from 'clsx';
import OverlayPortal from './OverlayPortal';
import { drawerLeft, overlayFade } from '../lib/motion';
import { ADMIN_DESTINATIONS, ADMIN_NAV_GROUPS, type AdminDestinationId } from '../lib/adminNavigation';
import WorkspaceSwitcher from './WorkspaceSwitcher';

interface AdminNavDrawerProps {
  open: boolean;
  onClose: () => void;
  activeDest: AdminDestinationId;
  hrefFor: (dest: AdminDestinationId) => string;
}

/**
 * Navegação principal em tablet retrato e celular (abaixo de `lg`): a mesma
 * lista da barra lateral, numa gaveta aberta pelo menu do cabeçalho. Fora
 * dela a tela fica inteira para o conteúdo.
 */
export default function AdminNavDrawer({ open, onClose, activeDest, hrefFor }: AdminNavDrawerProps) {
  const { t } = useTranslation('admin');

  return (
    <OverlayPortal open={open} onClose={onClose} withExitAnimation>
      <AnimatePresence>
        {open && (
          <motion.div
            key="admin-nav-scrim"
            variants={overlayFade}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="lg:hidden fixed inset-0 z-[60] bg-surface-scrim"
            onClick={onClose}
          >
            <motion.nav
              variants={drawerLeft}
              aria-label={t('navDrawer.label')}
              onClick={(e) => e.stopPropagation()}
              className="absolute inset-y-0 left-0 w-[min(18rem,85vw)] bg-surface-container-low border-r border-seam flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]"
            >
              <div className="h-14 border-b border-seam flex items-center justify-between px-5 shrink-0">
                <div className="flex items-baseline gap-2 whitespace-nowrap">
                  <span className="w-1.5 h-4 bg-accent self-center" aria-hidden />
                  <span className="text-lg font-bold tracking-tight text-bone font-display leading-none">
                    {t('sidebar.brand')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label={t('header.closeMenu')}
                  className="lmb-btn lmb-btn-ghost lmb-btn-icon material-symbols-outlined text-[20px] tracking-normal normal-case"
                >
                  close
                </button>
              </div>
              <WorkspaceSwitcher className="px-5 py-3 border-b border-seam" />

              <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-5 space-y-6">
                {ADMIN_NAV_GROUPS.map((group) => (
                  <div key={group.id}>
                    <h3 className="px-3 mb-2 text-[10px] font-display font-bold text-ash-500 uppercase tracking-[0.32em]">
                      {t(group.labelKey)}
                    </h3>
                    <ul className="space-y-px">
                      {ADMIN_DESTINATIONS.filter((d) => d.group === group.id).map((dest) => {
                        const isActive = dest.id === activeDest;
                        return (
                          <li key={dest.id}>
                            <Link
                              to={hrefFor(dest.id)}
                              onClick={onClose}
                              aria-current={isActive ? 'page' : undefined}
                              className={clsx(
                                'h-12 flex items-center gap-3 px-3 rounded-inset transition-colors',
                                isActive ? 'text-primary bg-accent-05' : 'text-ash-400 active:bg-white/[0.04]'
                              )}
                            >
                              <span
                                className={clsx(
                                  'material-symbols-outlined text-[20px]',
                                  isActive ? 'text-accent' : 'text-ash-600'
                                )}
                                aria-hidden
                              >
                                {dest.icon}
                              </span>
                              <span className="font-display uppercase font-bold tracking-[0.18em] text-[11px]">
                                {t(dest.labelKey)}
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>
    </OverlayPortal>
  );
}
