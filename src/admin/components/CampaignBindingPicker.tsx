import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Campaign } from '../../data/campaigns';

interface CampaignBindingPickerProps {
  /** `global` vale em qualquer missão; lista vazia não vale em nenhuma (regra do AchievementManager). */
  value: string[] | 'global';
  onChange: (next: string[] | 'global') => void;
  campaigns: Campaign[];
  label: string;
  hint?: string;
}

/**
 * Vínculo de um recurso (conquista, NPC) com missões: global ou uma lista.
 * Ids que não existem mais aparecem marcados para o mestre poder limpá-los.
 */
export default function CampaignBindingPicker({
  value,
  onChange,
  campaigns,
  label,
  hint,
}: CampaignBindingPickerProps) {
  const { t } = useTranslation('admin');
  const isGlobal = value === 'global';
  const selected = isGlobal ? [] : value;
  const orphanIds = selected.filter((id) => !campaigns.some((c) => c.id === id));

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((c) => c !== id) : [...selected, id]);
  };

  const chipClass = (active: boolean) =>
    `inline-flex items-center gap-1.5 h-8 px-3 rounded-inset text-[11px] font-display font-bold uppercase tracking-[0.12em] transition-colors ${
      active
        ? 'bg-accent-10 text-primary'
        : 'text-ash-400 hover:text-bone'
    }`;

  return (
    <fieldset className="space-y-2">
      <legend className="text-[10px] font-display font-bold uppercase tracking-[0.08em] text-ash-400 mb-2">
        {label}
      </legend>
      <div role="radiogroup" className="flex flex-wrap gap-2">
        <button
          type="button"
          role="radio"
          aria-checked={isGlobal}
          onClick={() => onChange('global')}
          className={chipClass(isGlobal)}
        >
          <span className="material-symbols-outlined text-sm" aria-hidden>public</span>
          {t('scope.bindGlobal')}
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={!isGlobal}
          onClick={() => {
            if (isGlobal) onChange([]);
          }}
          className={chipClass(!isGlobal)}
        >
          <span className="material-symbols-outlined text-sm" aria-hidden>map</span>
          {t('scope.bindSpecific')}
        </button>
      </div>

      {!isGlobal && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {campaigns.map((c) => {
            const on = selected.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(c.id)}
                className={`h-7 px-2.5 rounded-inset text-[11px] transition-colors ${
                  on
                    ? 'bg-accent-10 text-primary'
                    : 'text-ash-400 hover:text-bone'
                }`}
              >
                {c.name || c.id}
              </button>
            );
          })}
          {orphanIds.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => toggle(id)}
              title={t('scope.orphanTitle')}
              className="h-7 px-2.5 bg-red-500/5 rounded-inset text-[11px] text-red-300/90 line-through decoration-red-400/60"
            >
              {id}
            </button>
          ))}
        </div>
      )}

      <p
        className={`text-[11px] leading-relaxed ${
          !isGlobal && selected.length === 0 ? 'text-amber-300/90' : 'text-ash-500'
        }`}
      >
        {isGlobal
          ? hint ?? t('scope.bindGlobalHint')
          : selected.length === 0
            ? t('scope.bindEmptyHint')
            : t('scope.bindCount', { count: selected.length })}
      </p>
    </fieldset>
  );
}
