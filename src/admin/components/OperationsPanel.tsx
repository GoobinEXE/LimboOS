import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import TerminalPanel from './TerminalPanel';
import RedirectsPanel from './RedirectsPanel';
import AchievementsPanel from './AchievementsPanel';
import NpcSmsPanel from './NpcSmsPanel';
import ReportsPanel, {
  type AgentMetrics,
  type CampaignMetrics,
  type HealthMetrics,
  type EngagementMetrics,
} from './ReportsPanel';
import type { OperationsSubId } from '../lib/adminNavigation';
import { ADMIN_FADE, ADMIN_SPRING_INDICATOR } from '../lib/motion';

interface OperationsPanelProps {
  activeSub: OperationsSubId;
  onSubChange: (sub: OperationsSubId) => void;
  agents: AgentMetrics;
  campaigns: CampaignMetrics;
  health: HealthMetrics;
  engagement: EngagementMetrics;
  onNavigate: (tab: string, options?: { opsSubTab?: OperationsSubId; scrollTo?: string; mesaSubTab?: string }) => void;
}

export default function OperationsPanel({
  activeSub,
  onSubChange,
  agents,
  campaigns,
  health,
  engagement,
  onNavigate,
}: OperationsPanelProps) {
  const { t } = useTranslation('admin');

  const SUBS: { id: OperationsSubId; label: string; icon: string; blurb: string }[] = [
    {
      id: 'relatorios',
      label: t('systems.sub.reports'),
      icon: 'analytics',
      blurb: t('systems.sub.reportsBlurb'),
    },
    {
      id: 'acesso',
      label: t('systems.sub.access'),
      icon: 'lock_open',
      blurb: t('systems.sub.accessBlurb'),
    },
    {
      id: 'qr',
      label: t('systems.sub.qr'),
      icon: 'qr_code',
      blurb: t('systems.sub.qrBlurb'),
    },
    {
      id: 'conquistas',
      label: t('systems.sub.achievements'),
      icon: 'emoji_events',
      blurb: t('systems.sub.achievementsBlurb'),
    },
    {
      id: 'sms',
      label: t('systems.sub.sms'),
      icon: 'sms',
      blurb: t('systems.sub.smsBlurb'),
    },
  ];

  const current = SUBS.find((s) => s.id === activeSub) || SUBS[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-4">
          <div className="w-1.5 h-8 bg-primary shadow-[0_0_12px_rgba(255,140,0,0.45)]" />
          <div>
            <h2 className="font-display font-bold uppercase tracking-widest text-xl text-white">{t('systems.title')}</h2>
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
                  layoutId="admin-ops-sub"
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
          {activeSub === 'relatorios' && (
            <ReportsPanel
              agents={agents}
              campaigns={campaigns}
              health={health}
              engagement={engagement}
              onNavigate={onNavigate}
            />
          )}
          {activeSub === 'acesso' && <TerminalPanel embedded />}
          {activeSub === 'qr' && <RedirectsPanel embedded />}
          {activeSub === 'conquistas' && <AchievementsPanel embedded />}
          {activeSub === 'sms' && <NpcSmsPanel embedded />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
