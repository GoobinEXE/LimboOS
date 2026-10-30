import React, { useRef } from 'react';
import { motion } from 'motion/react';
import { ADMIN_SPRING_INDICATOR } from '../lib/motion';

export interface AdminSubTab<T extends string> {
  id: T;
  label: string;
  icon: string;
}

interface AdminSubTabsProps<T extends string> {
  tabs: AdminSubTab<T>[];
  active: T;
  onChange: (id: T) => void;
  /** layoutId único por painel para o indicador não saltar entre listas */
  indicatorId: string;
  ariaLabel: string;
}

/**
 * Sub-abas dos painéis admin (Mesa, Sistema…): tablist com setas ←/→,
 * Home/End e indicador sublinhado que desliza entre abas.
 */
export default function AdminSubTabs<T extends string>({
  tabs,
  active,
  onChange,
  indicatorId,
  ariaLabel,
}: AdminSubTabsProps<T>) {
  const listRef = useRef<HTMLDivElement>(null);

  const focusTab = (index: number) => {
    const next = tabs[(index + tabs.length) % tabs.length];
    onChange(next.id);
    listRef.current?.querySelector<HTMLButtonElement>(`[data-tab-id="${next.id}"]`)?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.findIndex((tab) => tab.id === active);
    if (e.key === 'ArrowRight') { e.preventDefault(); focusTab(index + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); focusTab(index - 1); }
    else if (e.key === 'Home') { e.preventDefault(); focusTab(0); }
    else if (e.key === 'End') { e.preventDefault(); focusTab(tabs.length - 1); }
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className="flex flex-wrap items-end gap-1 border-b border-seam"
    >
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            data-tab-id={tab.id}
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={`relative flex items-center gap-2 h-10 px-4 text-[10px] font-display font-bold tracking-[0.2em] uppercase rounded-t-inset transition-colors ${
              isActive ? 'text-primary' : 'text-ash-500 hover:text-bone hover:bg-white/[0.03]'
            }`}
          >
            <span className="material-symbols-outlined text-base" aria-hidden>{tab.icon}</span>
            <span>{tab.label}</span>
            {isActive && (
              <motion.span
                layoutId={indicatorId}
                className="absolute left-2 right-2 -bottom-px h-0.5 bg-accent"
                transition={ADMIN_SPRING_INDICATOR}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
