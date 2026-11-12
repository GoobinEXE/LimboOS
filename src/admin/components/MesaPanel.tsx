import React from 'react';
import { useTranslation } from 'react-i18next';
import GroupManager from './GroupManager';
import UserRegistry from './UserRegistry';
import TerminalPanel from './TerminalPanel';
import AdminSubTabs from './AdminSubTabs';
import AdminSectionPanels from './AdminSectionPanels';
import { MESA_SECTIONS, adminPath, type MesaSectionId, type RouteOf } from '../lib/adminNavigation';
import { useAdminNavigate } from '../hooks/useAdminRoute';

interface MesaPanelProps {
  route: RouteOf<'mesa'>;
  /** Muda a cada navegação: refaz o destaque do esquadrão mesmo com o mesmo id. */
  locationKey: string;
  isAdmin: boolean;
}

/**
 * Mesa: pessoas e permissões. Esquadrões (padrão), Agentes & Contas e Acesso
 * de hardware (DOS/Mac persistente).
 */
export default function MesaPanel({ route, locationKey, isAdmin }: MesaPanelProps) {
  const { t } = useTranslation('admin');
  const nav = useAdminNavigate();

  const tabs = MESA_SECTIONS.map((s) => ({ id: s.id, label: t(s.labelKey), icon: s.icon }));
  const current = MESA_SECTIONS.find((s) => s.id === route.section) ?? MESA_SECTIONS[0];

  const changeSection = (section: MesaSectionId) => {
    if (section !== route.section || route.accountUid || route.squadId) nav.go(adminPath.mesa(section));
  };

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <span className="w-1 h-9 bg-accent shrink-0" aria-hidden />
          <div className="min-w-0">
            <h2 className="font-display font-bold uppercase tracking-[0.18em] text-xl text-bone leading-none">{t('mesa.title')}</h2>
          </div>
        </div>
      </header>

      <AdminSubTabs
        tabs={tabs}
        active={route.section}
        onChange={changeSection}
        indicatorId="admin-mesa-sub"
        ariaLabel={t('mesa.title')}
      />

      <AdminSectionPanels
        active={route.section}
        render={(section) => {
          switch (section) {
            case 'esquadroes':
              return (
                <GroupManager
                  isAdmin={isAdmin}
                  embedded
                  highlight={route.squadId ? { groupId: route.squadId, key: locationKey } : null}
                />
              );
            case 'contas':
              return (
                <UserRegistry
                  isAdmin={isAdmin}
                  embedded
                  accountUid={route.accountUid}
                  agentId={route.agentId}
                />
              );
            case 'acesso':
              return <TerminalPanel embedded />;
          }
        }}
      />
    </div>
  );
}
