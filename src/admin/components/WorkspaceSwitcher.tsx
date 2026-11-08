import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAdminScope } from '../context/AdminScopeContext';

/**
 * Pasta ativa do painel. Com uma pasta só, mostra o nome; com pastas
 * compartilhadas (co-mestre), vira um seletor.
 */
export default function WorkspaceSwitcher({ className = '' }: { className?: string }) {
  const { t } = useTranslation('admin');
  const { scope, options, switchWorkspace } = useAdminScope();
  const label = (name: string, role: 'owner' | 'cogm') =>
    `${name || t('workspace.current')} · ${t(`workspace.role.${role}`)}`;

  if (options.length <= 1) {
    return (
      <p className={`text-[10px] font-display font-bold uppercase tracking-widest text-ash-500 truncate ${className}`} title={t('workspace.current')}>
        {label(scope.workspaceName || '', scope.role === 'owner' ? 'owner' : 'cogm')}
      </p>
    );
  }

  return (
    <label className={`block ${className}`}>
      <span className="sr-only">{t('workspace.switch')}</span>
      <select
        value={scope.wsId}
        onChange={(e) => switchWorkspace(e.target.value)}
        className="w-full bg-black/40 border border-border-subtle text-[10px] font-display font-bold uppercase tracking-widest text-bone px-2 py-1.5 rounded-sm outline-none focus:border-primary/40"
      >
        {options.map((o) => (
          <option key={o.wsId} value={o.wsId}>{label(o.name, o.role)}</option>
        ))}
      </select>
    </label>
  );
}
