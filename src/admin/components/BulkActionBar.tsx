import React from 'react';
import { useTranslation } from 'react-i18next';
import MIcon from './MIcon';

interface BulkActionBarProps {
  count: number;
  onClear: () => void;
  /** Quando informado, mostra "Selecionar todos" (ex.: total visível na lista). */
  onSelectAll?: () => void;
  /** Esconde "Selecionar todos" quando já está tudo marcado. */
  allSelected?: boolean;
  /** Ações do lote (botões `lmb-btn`). */
  children?: React.ReactNode;
  className?: string;
}

/** Barra de ações em lote; não renderiza nada com `count` 0. */
export default function BulkActionBar({
  count,
  onClear,
  onSelectAll,
  allSelected = false,
  children,
  className = '',
}: BulkActionBarProps) {
  const { t } = useTranslation('admin');
  if (count <= 0) return null;
  return (
    <div
      role="toolbar"
      aria-label={t('bulk.selected', { count })}
      className={`flex flex-wrap items-center gap-2 rounded-panel bg-surface-container-high px-3 py-2 shadow-hairline ${className}`}
    >
      <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-primary" aria-live="polite">
        {t('bulk.selected', { count })}
      </span>
      {onSelectAll && !allSelected && (
        <button type="button" onClick={onSelectAll} className="lmb-btn lmb-btn-ghost">
          {t('bulk.selectAll')}
        </button>
      )}
      <div className="flex flex-wrap items-center gap-2 ml-auto">
        {children}
        <button type="button" onClick={onClear} className="lmb-btn lmb-btn-ghost">
          <MIcon name="close" className="text-base" />
          {t('bulk.clear')}
        </button>
      </div>
    </div>
  );
}
