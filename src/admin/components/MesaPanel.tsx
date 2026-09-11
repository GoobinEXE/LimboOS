import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import GroupManager from './GroupManager';
import UserRegistry from './UserRegistry';

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

const SUBS: { id: MesaSubId; label: string; icon: string; blurb: string }[] = [
  {
    id: 'esquadroes',
    label: 'Esquadrões',
    icon: 'groups',
    blurb: 'Mesas de jogo, membros e ações em lote',
  },
  {
    id: 'contas',
    label: 'Contas',
    icon: 'group',
    blurb: 'Contas mestras, personagens e dossiês',
  },
];

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
  const current = SUBS.find((s) => s.id === activeSub) || SUBS[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-4">
          <div className="w-1.5 h-8 bg-primary shadow-[0_0_12px_rgba(255,140,0,0.45)]" />
          <div>
            <h2 className="font-display font-bold uppercase tracking-widest text-xl text-white">Mesa</h2>
            <p className="text-[10px] font-display font-bold text-industrial-silver/40 uppercase tracking-[0.2em] mt-1">
              {current.blurb}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap border-b border-primary/10 bg-black/20">
        {SUBS.map((sub) => (
          <button
            key={sub.id}
            type="button"
            onClick={() => onSubChange(sub.id)}
            className={`flex items-center gap-2 px-5 py-3 text-[10px] font-display font-bold tracking-[0.2em] uppercase transition-all border-r border-primary/10 ${
              activeSub === sub.id
                ? 'bg-primary/10 text-primary border-b-2 border-b-primary'
                : 'text-industrial-silver/45 hover:bg-primary/5 hover:text-primary'
            }`}
          >
            <span className="material-symbols-outlined text-base">{sub.icon}</span>
            {sub.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeSub}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22 }}
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
