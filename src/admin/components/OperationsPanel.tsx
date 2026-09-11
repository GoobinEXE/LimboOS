import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import TerminalPanel from './TerminalPanel';
import RedirectsPanel from './RedirectsPanel';
import AchievementsPanel from './AchievementsPanel';
import ReportsPanel, {
  type AgentMetrics,
  type CampaignMetrics,
  type HealthMetrics,
  type EngagementMetrics,
} from './ReportsPanel';
import type { OperationsSubId } from '../lib/adminNavigation';

const SUBS: { id: OperationsSubId; label: string; icon: string; blurb: string }[] = [
  {
    id: 'relatorios',
    label: 'Relatórios',
    icon: 'analytics',
    blurb: 'Panorama, BI e telemetria completa',
  },
  {
    id: 'acesso',
    label: 'Acesso',
    icon: 'lock_open',
    blurb: 'Autorização persistente de hardware DOS/Mac',
  },
  {
    id: 'qr',
    label: 'QR & Links',
    icon: 'qr_code',
    blurb: 'Mapear QR físico → intel de destino',
  },
  {
    id: 'conquistas',
    label: 'Conquistas',
    icon: 'emoji_events',
    blurb: 'Catálogo global de achievements',
  },
];

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
  const current = SUBS.find((s) => s.id === activeSub) || SUBS[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-4">
          <div className="w-1.5 h-8 bg-primary shadow-[0_0_12px_rgba(255,140,0,0.45)]" />
          <div>
            <h2 className="font-display font-bold uppercase tracking-widest text-xl text-white">Sistema</h2>
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
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
