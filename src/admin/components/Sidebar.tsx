import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { ADMIN_SPRING_INDICATOR } from '../lib/motion';
import { modKeyLabel } from '../lib/platform';
import { ADMIN_DESTINATIONS, ADMIN_NAV_GROUPS, type AdminDestinationId } from '../lib/adminNavigation';
import WorkspaceSwitcher from './WorkspaceSwitcher';

interface SidebarProps {
  activeDest: AdminDestinationId;
  /** Destino ativo leva à raiz dele; os outros voltam à última rota visitada. */
  hrefFor: (dest: AdminDestinationId) => string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export default function Sidebar({ activeDest, hrefFor, isCollapsed, onToggleCollapse }: SidebarProps) {
  const { t } = useTranslation('admin');
  const mod = modKeyLabel();

  const groups = ADMIN_NAV_GROUPS.map((group) => ({
    title: t(group.labelKey),
    items: ADMIN_DESTINATIONS.filter((d) => d.group === group.id).map((d) => ({
      id: d.id,
      label: t(d.labelKey),
      icon: d.icon,
      shortcut: d.shortcut,
    })),
  }));

  return (
    <aside
      className={clsx(
        'bg-surface-container-low border-r border-seam hidden lg:flex flex-col z-40 overflow-hidden shrink-0',
        'transition-[width] duration-300 ease-drawer motion-reduce:transition-none',
        isCollapsed ? 'w-18' : 'w-60'
      )}
    >
      {/* Marca: mesma altura do Header para alinhar a linha de horizonte */}
      <div
        className={clsx(
          'h-14 bg-accent text-field-ink flex items-center shrink-0',
          isCollapsed ? 'justify-center' : 'px-6'
        )}
      >
        {isCollapsed ? (
          <span className="font-display font-extrabold text-sm leading-none tracking-tight">
            {t('sidebar.brandCollapsed')}
          </span>
        ) : (
          <div className="flex items-baseline gap-2 whitespace-nowrap">
            <span className="text-lg font-extrabold tracking-tight font-display leading-none uppercase">
              {t('sidebar.brand')}
            </span>
          </div>
        )}
      </div>
      {!isCollapsed && <WorkspaceSwitcher className="px-4 py-3 border-b border-seam" />}

      <nav
        aria-label={t('sidebar.navLabel')}
        className={clsx(
          'flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar',
          isCollapsed ? 'px-2 py-4 space-y-3' : 'px-3 py-5 space-y-6'
        )}
      >
        {groups.map((group) => (
          <div key={group.title}>
            {isCollapsed ? (
              <div className="h-0.5 rounded-full bg-surface-container-highest mx-4 mb-3" aria-hidden />
            ) : (
              <h3 className="px-3 mb-2 text-protocol text-[10px] text-ash-500 whitespace-nowrap">
                {group.title}
              </h3>
            )}
            <ul className="space-y-1">
              {group.items.map((item) => {
                const isActive = activeDest === item.id;
                return (
                  <li key={item.id}>
                    <Link
                      to={hrefFor(item.id)}
                      aria-current={isActive ? 'page' : undefined}
                      title={isCollapsed ? `${item.label} (${mod}${item.shortcut})` : undefined}
                      className={clsx(
                        'w-full h-10 flex items-center text-left relative group rounded-control transition-colors',
                        isCollapsed ? 'justify-center' : 'px-3 gap-3',
                        isActive
                          ? 'text-field-ink'
                          : 'text-ash-300 hover:text-bone hover:bg-surface-container-high'
                      )}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="admin-sidebar-indicator"
                          className="absolute inset-0 rounded-control bg-accent"
                          transition={ADMIN_SPRING_INDICATOR}
                        />
                      )}
                      <span
                        className={clsx(
                          'material-symbols-outlined relative z-10 transition-colors',
                          isCollapsed ? 'text-xl' : 'text-[18px]',
                          isActive ? 'text-field-ink' : 'text-ash-500 group-hover:text-ash-200'
                        )}
                        aria-hidden
                      >
                        {item.icon}
                      </span>
                      {!isCollapsed && (
                        <>
                          <span className="relative z-10 flex-1 font-display uppercase font-bold tracking-[0.06em] text-[11px] whitespace-nowrap overflow-hidden">
                            {item.label}
                          </span>
                          <kbd
                            className={clsx(
                              'relative z-10 font-mono text-[10px] transition-opacity',
                              isActive ? 'opacity-100 text-field-ink/60' : 'opacity-0 group-hover:opacity-100 text-ash-500'
                            )}
                          >
                            {mod}
                            {item.shortcut}
                          </kbd>
                        </>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0">
        <button
          type="button"
          onClick={onToggleCollapse}
          className={clsx(
            'w-full h-11 flex items-center gap-3 text-ash-400 hover:text-bone hover:bg-surface-container-high transition-colors group',
            isCollapsed ? 'justify-center' : 'px-6'
          )}
          title={`${isCollapsed ? t('sidebar.expandTitle') : t('sidebar.collapseTitle')} (${mod}\\)`}
          aria-expanded={!isCollapsed}
        >
          {isCollapsed ? (
            <ChevronRight size={16} />
          ) : (
            <>
              <ChevronLeft size={16} />
              <span className="flex-1 text-left text-protocol text-[10px] whitespace-nowrap">
                {t('sidebar.collapse')}
              </span>
              <kbd className="text-[10px] text-ash-600">{mod}\</kbd>
            </>
          )}
        </button>
      </div>

      <div
        className={clsx(
          'bg-surface-container shrink-0 flex items-center h-11',
          isCollapsed ? 'justify-center' : 'px-6 gap-3'
        )}
        title={isCollapsed ? t('sidebar.statusOnlineTitle') : undefined}
      >
        <span className="lmb-led text-phosphor-400 animate-led" aria-hidden />
        {!isCollapsed && (
          <div className="min-w-0">
            <p className="text-[10px] text-ash-500 font-display font-bold tracking-[0.08em] uppercase leading-none">
              {t('sidebar.statusLabel')}
            </p>
            <p className="text-[10px] text-phosphor-400 font-display font-bold tracking-wider uppercase mt-1 leading-none">
              {t('sidebar.statusOnline')}
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
