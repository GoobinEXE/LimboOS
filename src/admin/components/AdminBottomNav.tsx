import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { clsx } from 'clsx';
import { ADMIN_SPRING_INDICATOR } from '../lib/motion';
import { ADMIN_DESTINATIONS, type AdminDestinationId } from '../lib/adminNavigation';

interface AdminBottomNavProps {
  activeDest: AdminDestinationId;
  hrefFor: (dest: AdminDestinationId) => string;
}

/**
 * Navegação principal em tablet retrato e celular (abaixo de `lg`): os cinco
 * destinos da barra lateral, com os mesmos destinos e a mesma regra de link.
 */
export default function AdminBottomNav({ activeDest, hrefFor }: AdminBottomNavProps) {
  const { t } = useTranslation('admin');

  return (
    <nav
      aria-label={t('bottomNav.label')}
      className="lg:hidden fixed inset-x-0 bottom-0 z-50 bg-surface-container-low border-t border-seam pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid grid-cols-5 h-16">
        {ADMIN_DESTINATIONS.map((dest) => {
          const isActive = dest.id === activeDest;
          return (
            <li key={dest.id} className="min-w-0">
              <Link
                to={hrefFor(dest.id)}
                aria-current={isActive ? 'page' : undefined}
                className={clsx(
                  'relative h-full flex flex-col items-center justify-center gap-1 px-1 transition-colors',
                  isActive ? 'text-primary' : 'text-ash-500 active:text-bone'
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="admin-bottomnav-indicator"
                    className="absolute top-0 left-3 right-3 h-0.5 bg-accent"
                    transition={ADMIN_SPRING_INDICATOR}
                    aria-hidden
                  />
                )}
                <span
                  className={clsx('material-symbols-outlined text-[22px]', isActive ? 'text-accent' : 'text-ash-600')}
                  aria-hidden
                >
                  {dest.icon}
                </span>
                <span className="max-w-full truncate font-display uppercase font-bold tracking-[0.12em] text-[9px]">
                  {t(dest.labelKey)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
