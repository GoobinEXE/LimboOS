import React from 'react';
import { useTranslation } from 'react-i18next';
import ReportsPanel, {
  type AgentMetrics,
  type CampaignMetrics,
  type HealthMetrics,
  type EngagementMetrics,
} from './ReportsPanel';
import SystemLogPanel from './SystemLogPanel';
import PlatformAccountsPanel from './PlatformAccountsPanel';
import { useAdminScope } from '../context/AdminScopeContext';
import AdminSubTabs from './AdminSubTabs';
import AdminSectionPanels from './AdminSectionPanels';
import { SYSTEM_SECTIONS, adminPath, type RouteOf, type SystemSectionId } from '../lib/adminNavigation';
import { useAdminNavigate } from '../hooks/useAdminRoute';

interface OperationsPanelProps {
  route: RouteOf<'system'>;
  agents: AgentMetrics;
  campaigns: CampaignMetrics;
  health: HealthMetrics;
  engagement: EngagementMetrics;
}

/**
 * Sistema: Relatórios (panorama e BI) e Log completo.
 */
export default function OperationsPanel({ route, agents, campaigns, health, engagement }: OperationsPanelProps) {
  const { t } = useTranslation('admin');
  const nav = useAdminNavigate();

  const { isPlatformAdmin } = useAdminScope();
  // Contas é administração da plataforma: só aparece com o claim platformAdmin.
  const sections = SYSTEM_SECTIONS.filter((s) => s.id !== 'contas' || isPlatformAdmin);
  const tabs = sections.map((s) => ({ id: s.id, label: t(s.labelKey), icon: s.icon }));
  const current = sections.find((s) => s.id === route.section) ?? sections[0];
  const activeSection = current.id;

  const changeSection = (section: SystemSectionId) => {
    if (section !== route.section) nav.go(adminPath.system(section));
  };

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <span className="w-1 h-9 bg-accent shrink-0" aria-hidden />
          <div className="min-w-0">
            <h2 className="font-display font-bold uppercase tracking-[0.18em] text-xl text-bone leading-none">{t('systems.title')}</h2>
            {current.blurbKey && (
              <p className="text-[10px] font-display font-bold text-ash-500 uppercase tracking-[0.2em] mt-2 truncate">
                {t(current.blurbKey)}
              </p>
            )}
          </div>
        </div>
      </header>

      <AdminSubTabs
        tabs={tabs}
        active={activeSection}
        onChange={changeSection}
        indicatorId="admin-ops-sub"
        ariaLabel={t('systems.title')}
      />

      <AdminSectionPanels
        active={activeSection}
        render={(section) =>
          section === 'relatorios' ? (
            <ReportsPanel agents={agents} campaigns={campaigns} health={health} engagement={engagement} />
          ) : section === 'contas' ? (
            isPlatformAdmin ? <PlatformAccountsPanel /> : null
          ) : (
            <SystemLogPanel />
          )
        }
      />
    </div>
  );
}
