import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import GroupManager from './GroupManager';
import UserRegistry from './UserRegistry';
import { FADE_FAST } from '../../lib/motion';
import AdminSubTabs from './AdminSubTabs';

export type MesaSubId = 'esquadroes' | 'contas';

interface MesaPanelProps {
  activeSub: MesaSubId;
  onSubChange: (sub: MesaSubId) => void;
  isAdmin: boolean;
  onNavigateToMission?: (campaignId: string) => void;
  deepLinkAccountUid?: string | null;
  deepLinkAgent?: { uid: string; charId: string } | null;
  deepLinkGroupId?: string | null;
  onDeepLinkConsumed?: () => void;
}

/**
 * Hub Mesa — Esquadrões (default) + Contas no mesmo destino.
 */
export default function MesaPanel({
  activeSub,
  onSubChange,
  isAdmin,
  onNavigateToMission,
  deepLinkAccountUid,
  deepLinkAgent,
  deepLinkGroupId,
  onDeepLinkConsumed,
}: MesaPanelProps) {
  const { t } = useTranslation('admin');

  const SUBS: { id: MesaSubId; label: string; icon: string; blurb: string }[] = [
    {
      id: 'esquadroes',
      label: t('mesa.sub.squads'),
      icon: 'groups',
      blurb: t('mesa.sub.squadsBlurb'),
    },
    {
      id: 'contas',
      label: t('mesa.sub.accounts'),
      icon: 'group',
      blurb: t('mesa.sub.accountsBlurb'),
    },
  ];

  const current = SUBS.find((s) => s.id === activeSub) || SUBS[0];

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <span className="w-1 h-9 bg-accent shrink-0" aria-hidden />
          <div className="min-w-0">
            <h2 className="font-display font-bold uppercase tracking-[0.18em] text-xl text-bone leading-none">{t('mesa.title')}</h2>
            <p className="text-[10px] font-display font-bold text-ash-500 uppercase tracking-[0.2em] mt-2 truncate">
              {current.blurb}
            </p>
          </div>
        </div>
      </header>

      <AdminSubTabs
        tabs={SUBS}
        active={activeSub}
        onChange={onSubChange}
        indicatorId="admin-mesa-sub"
        ariaLabel={t('mesa.title')}
      />

      {/* Troca de sub-aba é frequente: troca imediata com fade curto, sem esperar saída */}
      <motion.div
          key={activeSub}
          role="tabpanel"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={FADE_FAST}
        >
          {activeSub === 'esquadroes' && (
            <GroupManager
              isAdmin={isAdmin}
              onNavigateToMission={onNavigateToMission}
              embedded
              deepLinkGroupId={deepLinkGroupId}
              onDeepLinkConsumed={onDeepLinkConsumed}
            />
          )}
          {activeSub === 'contas' && (
            <UserRegistry
              isAdmin={isAdmin}
              embedded
              deepLinkAccountUid={deepLinkAccountUid}
              deepLinkAgent={deepLinkAgent}
              onDeepLinkConsumed={onDeepLinkConsumed}
            />
          )}
        </motion.div>
    </div>
  );
}
