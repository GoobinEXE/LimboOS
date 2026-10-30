import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
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
import { FADE_FAST } from '../../lib/motion';
import AdminSubTabs from './AdminSubTabs';

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
      <header className="flex items-end justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <span className="w-1 h-9 bg-accent shrink-0" aria-hidden />
          <div className="min-w-0">
            <h2 className="font-display font-bold uppercase tracking-[0.18em] text-xl text-bone leading-none">{t('systems.title')}</h2>
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
        indicatorId="admin-ops-sub"
        ariaLabel={t('systems.title')}
      />

      {/* Troca de sub-aba é frequente: troca imediata com fade curto, sem esperar saída */}
      <motion.div
          key={activeSub}
          role="tabpanel"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={FADE_FAST}
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
    </div>
  );
}
