import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import GroupManager from './GroupManager';
import UserRegistry from './UserRegistry';
import { ADMIN_FADE, ADMIN_SPRING_INDICATOR } from '../lib/motion';

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
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-4">
          <div className="w-1.5 h-8 bg-primary shadow-[0_0_12px_rgba(255,140,0,0.45)]" />
          <div>
            <h2 className="font-display font-bold uppercase tracking-widest text-xl text-white">{t('mesa.title')}</h2>
            <p className="text-[10px] font-display font-bold text-industrial-silver/40 uppercase tracking-[0.2em] mt-1">
              {current.blurb}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap border-b border-primary/10 bg-black/20">
        {SUBS.map((sub) => {
          const isActive = activeSub === sub.id;
          return (
            <button
              key={sub.id}
              type="button"
              onClick={() => onSubChange(sub.id)}
              className={`relative flex items-center gap-2 px-5 py-3 text-[10px] font-display font-bold tracking-[0.2em] uppercase transition-colors border-r border-primary/10 ${
                isActive
                  ? 'text-primary'
                  : 'text-industrial-silver/45 hover:bg-primary/5 hover:text-primary'
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="admin-mesa-sub"
                  className="absolute inset-0 bg-primary/10 border-b-2 border-b-primary"
                  transition={ADMIN_SPRING_INDICATOR}
                />
              )}
              <span className="material-symbols-outlined text-base relative z-10">{sub.icon}</span>
              <span className="relative z-10">{sub.label}</span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeSub}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={ADMIN_FADE}
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
      </AnimatePresence>
    </div>
  );
}
