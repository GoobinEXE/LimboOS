import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Campaign } from '../../../data/campaigns';
import { DEFAULT_CAMPAIGN_FEATURES, type CampaignFeatures } from '../../../types/workspace';
import { campaignAdminService } from '../../../services/CampaignAdminService';
import { useToast } from '../ToastProvider';
import MIcon from '../MIcon';

const FEATURE_ORDER: (keyof CampaignFeatures)[] = ['bios', 'limbo', 'win95', 'terminal', 'mac', 'diskRepair'];

/**
 * Mini-apps narrativos ligados nesta missão. Desligado, o jogador da campanha
 * não vê o atalho nem recebe o "empurrão" do mestre.
 */
export default function MissionAppsTab({ campaign }: { campaign: Campaign }) {
  const { t } = useTranslation('admin');
  const toast = useToast();
  const [saving, setSaving] = useState<keyof CampaignFeatures | null>(null);
  const features: CampaignFeatures = { ...DEFAULT_CAMPAIGN_FEATURES, ...(campaign.features || {}) };

  const toggle = async (key: keyof CampaignFeatures) => {
    setSaving(key);
    try {
      await campaignAdminService.setFeatures(campaign.id, { ...features, [key]: !features[key] });
    } catch (err) {
      console.error('[MissionAppsTab] setFeatures failed:', err);
      toast.error(t('apps.saveFail'));
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-ash-500 leading-relaxed max-w-prose">{t('apps.body')}</p>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {FEATURE_ORDER.map((key) => {
          const on = features[key];
          return (
            <li key={key}>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                disabled={saving !== null}
                onClick={() => void toggle(key)}
                className={`w-full flex items-center justify-between gap-3 px-4 py-4 rounded-sm transition text-left ${
                  on ? 'bg-primary/5 text-primary' : 'bg-surface-container-lowest text-ash-500'
                }`}
              >
                <span>
                  <span className="block text-[11px] font-display font-bold uppercase tracking-wider">{t(`apps.feature.${key}`)}</span>
                  <span className="block text-[10px] text-ash-500 mt-1 normal-case tracking-normal">{t(`apps.featureHint.${key}`)}</span>
                </span>
                <MIcon name={on ? 'toggle_on' : 'toggle_off'} className="text-2xl shrink-0" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
