import React from 'react';
import { useTranslation } from 'react-i18next';
import AnalyticsPanel from './AnalyticsPanel';
import SystemLogPanel from './SystemLogPanel';

export type AgentMetrics = {
  active: number;
  vivo: number;
  morto: number;
  desaparecido: number;
  highDanger: number;
  archived: number;
};

export type CampaignMetrics = {
  ativa: number;
  bloqueada: number;
  arquivada: number;
  walkman: number;
  nokia: number;
};

export type HealthMetrics = {
  suspended: number;
  dormant: number;
  errors24h: number;
  limboSeized: boolean;
};

export type EngagementMetrics = {
  totalAchievements: number;
  totalScrews: number;
  totalFidgets: number;
  totalEjects: number;
};

interface ReportsPanelProps {
  agents: AgentMetrics;
  campaigns: CampaignMetrics;
  health: HealthMetrics;
  engagement: EngagementMetrics;
  onNavigate: (tab: string, options?: { opsSubTab?: string; scrollTo?: string; mesaSubTab?: string }) => void;
}

/**
 * Sistema → Relatórios — Panorama + BI + log completo (fora da home Ao Vivo).
 */
export default function ReportsPanel({
  agents,
  campaigns,
  health,
  engagement,
  onNavigate,
}: ReportsPanelProps) {
  const { t } = useTranslation('admin');

  return (
    <div className="space-y-8">
      <OperationalPanorama
        agents={agents}
        campaigns={campaigns}
        health={health}
        engagement={engagement}
        onNavigate={onNavigate}
      />
      <div id="admin-analytics">
        <AnalyticsPanel onNavigate={onNavigate as never} />
      </div>
      <div id="admin-system-log" className="border-t border-primary/10 pt-8">
        <SectionDivider title={t('reports.logDivider')} />
        <SystemLogPanel />
      </div>
    </div>
  );
}

function OperationalPanorama({
  agents,
  campaigns,
  health,
  engagement,
  onNavigate,
}: ReportsPanelProps) {
  const { t } = useTranslation('admin');
  const goPlayers = () => onNavigate('mesa', { mesaSubTab: 'contas' });
  const goMissions = () => onNavigate('missions');
  const goAcesso = () => onNavigate('systems', { opsSubTab: 'acesso' });
  const goAnalytics = () => onNavigate('systems', { opsSubTab: 'relatorios', scrollTo: 'admin-analytics' });
  const goLog = () => onNavigate('systems', { opsSubTab: 'relatorios', scrollTo: 'admin-system-log' });
  const goAchievements = () => onNavigate('systems', { opsSubTab: 'conquistas' });

  return (
    <div className="space-y-6">
      <SectionDivider title={t('reports.panorama')} />

      <MetricGroup title={t('reports.group.agents')}>
        <StatCard label={t('reports.metric.activeAgents')} value={agents.active} icon="badge" color="primary" onClick={goPlayers} />
        <StatCard label={t('reports.metric.alive')} value={agents.vivo} icon="favorite" color="tertiary" onClick={goPlayers} />
        <StatCard label={t('reports.metric.dead')} value={agents.morto} icon="skull" color="secondary" onClick={goPlayers} />
        <StatCard label={t('reports.metric.missing')} value={agents.desaparecido} icon="help" color="secondary" onClick={goPlayers} />
        <StatCard label={t('reports.metric.highDanger')} value={agents.highDanger} icon="warning" color="primary" onClick={goPlayers} />
        <StatCard label={t('reports.metric.archived')} value={agents.archived} icon="inventory_2" color="secondary" onClick={goPlayers} />
      </MetricGroup>

      <MetricGroup title={t('reports.group.campaigns')}>
        <StatCard label={t('reports.metric.activeCampaigns')} value={campaigns.ativa} icon="flag" color="primary" onClick={goMissions} />
        <StatCard label={t('reports.metric.blocked')} value={campaigns.bloqueada} icon="lock" color="secondary" onClick={goMissions} />
        <StatCard label={t('reports.metric.archivedCampaigns')} value={campaigns.arquivada} icon="archive" color="secondary" onClick={goMissions} />
        <StatCard label={t('reports.metric.deck')} value={campaigns.walkman} icon="headphones" color="tertiary" onClick={goMissions} />
        <StatCard label={t('reports.metric.handset')} value={campaigns.nokia} icon="smartphone" color="tertiary" onClick={goMissions} />
      </MetricGroup>

      <MetricGroup title={t('reports.group.health')}>
        <StatCard label={t('reports.metric.suspended')} value={health.suspended} icon="block" color="secondary" onClick={goPlayers} />
        <StatCard label={t('reports.metric.dormant')} value={health.dormant} icon="bedtime" color="secondary" onClick={goPlayers} />
        <StatCard label={t('reports.metric.errors24h')} value={health.errors24h} icon="error" color="primary" onClick={goLog} />
        <StatusCard
          label={t('reports.metric.limbo')}
          value={health.limboSeized ? t('live.stat.limboTaken') : t('live.stat.limboFree')}
          icon="security"
          active={health.limboSeized}
          onClick={() => onNavigate('live')}
        />
      </MetricGroup>

      <MetricGroup title={t('reports.group.engagement')}>
        <StatCard label={t('reports.metric.achievements')} value={engagement.totalAchievements} icon="emoji_events" color="primary" onClick={goAchievements} />
        <StatCard label={t('reports.metric.screw')} value={engagement.totalScrews} icon="build" color="tertiary" onClick={goAnalytics} />
        <StatCard label={t('reports.metric.fidget')} value={engagement.totalFidgets} icon="touch_app" color="tertiary" onClick={goAnalytics} />
        <StatCard label={t('reports.metric.eject')} value={engagement.totalEjects} icon="eject" color="secondary" onClick={goAnalytics} />
        <button
          type="button"
          onClick={goAcesso}
          className="bg-surface-container-low border border-primary/20 p-5 text-left hover:border-primary/40 transition"
        >
          <p className="font-display text-[10px] uppercase font-bold tracking-[0.2em] text-industrial-silver/50 mb-2">
            {t('reports.hardware')}
          </p>
          <p className="text-sm font-display font-bold text-primary uppercase tracking-widest">{t('reports.openAccess')}</p>
        </button>
      </MetricGroup>
    </div>
  );
}

function SectionDivider({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="h-px flex-1 bg-linear-to-r from-transparent to-primary/20" />
      <h3 className="text-industrial-silver/40 font-display text-[10px] uppercase font-bold tracking-[0.3em]">{title}</h3>
      <div className="h-px flex-1 bg-linear-to-l from-transparent to-primary/20" />
    </div>
  );
}

function MetricGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="font-display text-[9px] uppercase font-bold tracking-[0.25em] text-industrial-silver/30">{title}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">{children}</div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
  onClick,
}: {
  label: string;
  value: number;
  icon: string;
  color: string;
  onClick?: () => void;
}) {
  const colorMap: Record<string, string> = {
    primary: 'text-primary border-primary/20',
    secondary: 'text-secondary border-secondary/20',
    tertiary: 'text-tertiary border-tertiary/20',
  };
  const iconColorMap: Record<string, string> = {
    primary: 'text-primary/20',
    secondary: 'text-secondary/20',
    tertiary: 'text-tertiary/20',
  };
  const className = `bg-surface-container-low border p-5 relative overflow-hidden group transition hover:bg-surface-container-high ${
    onClick ? 'cursor-pointer hover:border-primary/40 active:scale-[0.98]' : ''
  } ${colorMap[color] ?? colorMap.primary}`;

  const content = (
    <>
      {onClick && (
        <span className="absolute top-3 right-3 material-symbols-outlined text-sm text-primary/0 group-hover:text-primary/50 transition">
          arrow_forward
        </span>
      )}
      <div className="absolute -right-2 -bottom-2 opacity-10 group-hover:opacity-20 transition group-hover:scale-110">
        <span className={`material-symbols-outlined text-6xl ${iconColorMap[color] ?? iconColorMap.primary}`}>{icon}</span>
      </div>
      <p className="font-display text-[10px] uppercase font-bold tracking-[0.2em] text-industrial-silver/50 mb-2">
        {label}
      </p>
      <p className="text-4xl font-display font-bold text-white tracking-tighter">{value}</p>
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${className} text-left w-full`}>
        {content}
      </button>
    );
  }
  return <div className={className}>{content}</div>;
}

function StatusCard({
  label,
  value,
  icon,
  active,
  onClick,
}: {
  label: string;
  value: string;
  icon: string;
  active: boolean;
  onClick?: () => void;
}) {
  const className = `bg-surface-container-low border p-5 relative overflow-hidden group transition hover:bg-surface-container-high ${
    onClick ? 'cursor-pointer hover:border-primary/40 active:scale-[0.98]' : ''
  } ${active ? 'border-red-500/30 text-red-400' : 'border-phosphor-500/20 text-phosphor-400'}`;

  const content = (
    <>
      {onClick && (
        <span className="absolute top-3 right-3 material-symbols-outlined text-sm text-primary/0 group-hover:text-primary/50 transition">
          arrow_forward
        </span>
      )}
      <div className="absolute -right-2 -bottom-2 opacity-10 group-hover:opacity-20 transition group-hover:scale-110">
        <span className={`material-symbols-outlined text-6xl ${active ? 'text-red-500/20' : 'text-phosphor-500/20'}`}>
          {icon}
        </span>
      </div>
      <p className="font-display text-[10px] uppercase font-bold tracking-[0.2em] text-industrial-silver/50 mb-2">
        {label}
      </p>
      <p className="text-2xl font-display font-bold tracking-tight">{value}</p>
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${className} text-left w-full`}>
        {content}
      </button>
    );
  }
  return <div className={className}>{content}</div>;
}
