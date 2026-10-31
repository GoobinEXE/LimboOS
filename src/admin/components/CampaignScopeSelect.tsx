import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Campaign } from '../../data/campaigns';
import type { CampaignScope } from '../lib/campaignResources';

interface CampaignScopeSelectProps {
  value: CampaignScope;
  onChange: (scope: CampaignScope) => void;
  campaigns: Campaign[];
  className?: string;
}

/** Filtro de missão dos catálogos admin (intel, conquistas, NPCs). */
export default function CampaignScopeSelect({
  value,
  onChange,
  campaigns,
  className = '',
}: CampaignScopeSelectProps) {
  const { t } = useTranslation('admin');
  const known = value === 'all' || value === 'global' || campaigns.some((c) => c.id === value);

  return (
    <label className={`relative flex items-center min-w-0 ${className}`}>
      <span className="sr-only">{t('scope.label')}</span>
      <span
        className="material-symbols-outlined absolute left-2.5 text-base text-ash-500 pointer-events-none"
        aria-hidden
      >
        map
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as CampaignScope)}
        className={`lmb-field pl-9 pr-3 text-[12px] truncate ${
          value !== 'all' ? 'border-accent-60 text-primary' : ''
        }`}
      >
        <option value="all">{t('scope.all')}</option>
        <option value="global">{t('scope.global')}</option>
        {!known && <option value={value}>{value}</option>}
        <optgroup label={t('scope.missions')}>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name || c.id}
            </option>
          ))}
        </optgroup>
      </select>
    </label>
  );
}
