import React from 'react';
import { useTranslation } from 'react-i18next';
import MIcon from './MIcon';

export interface SortOption<K extends string = string> {
  value: K;
  label: string;
}

interface SortSelectProps<K extends string> {
  value: K;
  onChange: (value: K) => void;
  options: SortOption<K>[];
  className?: string;
}

/** Seletor de ordenação das listas do admin (par de `useListControls`). */
export default function SortSelect<K extends string = string>({
  value,
  onChange,
  options,
  className = '',
}: SortSelectProps<K>) {
  const { t } = useTranslation('admin');
  return (
    <label className={`relative flex items-center min-w-0 ${className}`}>
      <span className="sr-only">{t('list.sortLabel')}</span>
      <MIcon name="sort" className="absolute left-2.5 text-base text-ash-500 pointer-events-none" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as K)}
        className="lmb-field pl-9 pr-3 text-[12px] truncate"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
