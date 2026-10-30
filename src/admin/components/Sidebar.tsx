import React from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { ADMIN_SPRING_INDICATOR } from '../lib/motion';
import { modKeyLabel } from '../lib/platform';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export default function Sidebar({ activeTab, setActiveTab, isCollapsed, onToggleCollapse }: SidebarProps) {
  const { t } = useTranslation('admin');
  const mod = modKeyLabel();

  const groups = [
    {
      title: t('sidebar.group.session'),
      items: [
        { id: 'live', label: t('sidebar.live'), icon: 'sensors', shortcut: '1' },
        { id: 'mesa', label: t('sidebar.mesa'), icon: 'groups', shortcut: '2' },
        { id: 'missions', label: t('sidebar.missions'), icon: 'map', shortcut: '3' },
      ],
    },
    {
      title: t('sidebar.group.arsenal'),
      items: [
        { id: 'media', label: t('sidebar.media'), icon: 'folder_open', shortcut: '4' },
      ],
    },
    {
      title: t('sidebar.group.core'),
      items: [
        { id: 'systems', label: t('sidebar.systems'), icon: 'tune', shortcut: '5' },
      ],
    },
  ];

  return (
    <aside
      className={clsx(
        'bg-surface-container-low border-r border-seam flex flex-col z-40 overflow-hidden shrink-0',
        'transition-[width] duration-300 ease-drawer motion-reduce:transition-none',
        isCollapsed ? 'w-18' : 'w-60'
      )}
    >
      {/* Marca: mesma altura do Header para alinhar a linha de horizonte */}
      <div
        className={clsx(
          'h-14 border-b border-seam flex items-center shrink-0',
          isCollapsed ? 'justify-center' : 'px-6'
        )}
      >
        {isCollapsed ? (
          <span className="font-display font-bold text-sm leading-none tracking-tight text-bone">
            {t('sidebar.brandCollapsed')}
          </span>
        ) : (
          <div className="flex items-baseline gap-2 whitespace-nowrap">
            <span className="w-1.5 h-4 bg-accent self-center" aria-hidden />
            <span className="text-lg font-bold tracking-tight text-bone font-display leading-none">
              {t('sidebar.brand')}
            </span>
          </div>
        )}
      </div>

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
              <div className="h-px bg-border-subtle mx-3 mb-3" aria-hidden />
            ) : (
              <h3 className="px-3 mb-2 text-[9px] font-display font-bold text-ash-500 uppercase tracking-[0.32em] whitespace-nowrap">
                {group.title}
              </h3>
            )}
            <ul className="space-y-px">
              {group.items.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setActiveTab(item.id)}
                      aria-current={isActive ? 'page' : undefined}
                      title={isCollapsed ? `${item.label} (${mod}${item.shortcut})` : undefined}
                      className={clsx(
                        'w-full h-10 flex items-center text-left relative group rounded-inset transition-colors',
                        isCollapsed ? 'justify-center' : 'px-3 gap-3',
                        isActive
                          ? 'text-primary'
                          : 'text-ash-400 hover:text-bone hover:bg-white/[0.03]'
                      )}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="admin-sidebar-indicator"
                          className="absolute inset-0 rounded-inset bg-accent-05"
                          transition={ADMIN_SPRING_INDICATOR}
                        >
                          <span className="absolute left-0 top-2 bottom-2 w-0.5 bg-accent" />
                        </motion.span>
                      )}
                      <span
                        className={clsx(
                          'material-symbols-outlined relative z-10 transition-colors',
                          isCollapsed ? 'text-xl' : 'text-[18px]',
                          isActive ? 'text-accent' : 'text-ash-600 group-hover:text-ash-300'
                        )}
                        aria-hidden
                      >
                        {item.icon}
                      </span>
                      {!isCollapsed && (
                        <>
                          <span className="relative z-10 flex-1 font-display uppercase font-bold tracking-[0.18em] text-[10px] whitespace-nowrap overflow-hidden">
                            {item.label}
                          </span>
                          <kbd
                            className={clsx(
                              'relative z-10 text-[9px] text-ash-600 transition-opacity',
                              isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                            )}
                          >
                            {mod}
                            {item.shortcut}
                          </kbd>
                        </>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-seam shrink-0">
        <button
          type="button"
          onClick={onToggleCollapse}
          className={clsx(
            'w-full h-11 flex items-center gap-3 text-ash-500 hover:text-bone hover:bg-white/[0.03] transition-colors group',
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
              <span className="flex-1 text-left font-display uppercase font-bold tracking-[0.2em] text-[9px] whitespace-nowrap">
                {t('sidebar.collapse')}
              </span>
              <kbd className="text-[9px] text-ash-600">{mod}\</kbd>
            </>
          )}
        </button>
      </div>

      <div
        className={clsx(
          'border-t border-seam bg-surface-container-lowest shrink-0 flex items-center h-11',
          isCollapsed ? 'justify-center' : 'px-6 gap-3'
        )}
        title={isCollapsed ? t('sidebar.statusOnlineTitle') : undefined}
      >
        <span className="lmb-led text-phosphor-400 animate-led" aria-hidden />
        {!isCollapsed && (
          <div className="min-w-0">
            <p className="text-[9px] text-ash-500 font-display font-bold tracking-[0.2em] uppercase leading-none">
              {t('sidebar.statusLabel')}
            </p>
            <p className="text-[9px] text-phosphor-400 font-display font-bold tracking-widest uppercase mt-1 leading-none">
              {t('sidebar.statusOnline')}
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
