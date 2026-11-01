import React from 'react';
import { useTranslation } from 'react-i18next';
import MediaLibraryPanel from './MediaLibraryPanel';
import AchievementsPanel from './AchievementsPanel';
import NpcSmsPanel from './NpcSmsPanel';
import RedirectsPanel from './RedirectsPanel';
import AdminSubTabs from './AdminSubTabs';
import AdminSectionPanels from './AdminSectionPanels';
import CampaignScopeSelect from './CampaignScopeSelect';
import { useAdminCampaigns } from '../hooks/useAdminCampaigns';
import {
  CONTENT_SECTIONS,
  adminPath,
  type CampaignScopeRequest,
  type ContentSectionId,
  type NpcViewId,
  type RouteOf,
} from '../lib/adminNavigation';
import type { CampaignScope } from '../lib/campaignResources';
import { useAdminNavigate } from '../hooks/useAdminRoute';

interface ContentPanelProps {
  route: RouteOf<'content'>;
  /** Pedido vindo da missão para abrir um catálogo filtrado (e o editor de criação). */
  scopeRequest?: CampaignScopeRequest | null;
  onScopeConsumed?: () => void;
}

/**
 * Conteúdo: todos os catálogos de campanha num destino só
 * (Intel & Mídia, Conquistas, NPCs & SMS, QR & Links), com um filtro de
 * missão único no URL (`?mission=`) que vale para todos eles.
 */
export default function ContentPanel({ route, scopeRequest, onScopeConsumed }: ContentPanelProps) {
  const { t } = useTranslation('admin');
  const nav = useAdminNavigate();
  const { campaigns } = useAdminCampaigns();
  const scope = route.mission;

  const tabs = CONTENT_SECTIONS.map((s) => ({ id: s.id, label: t(s.labelKey), icon: s.icon }));
  const current = CONTENT_SECTIONS.find((s) => s.id === route.section) ?? CONTENT_SECTIONS[0];

  const changeSection = (section: ContentSectionId) => {
    if (section !== route.section) nav.go(adminPath.content(section, scope));
  };

  // Filtro não cria entrada de histórico: Voltar desfaz navegação, não ajuste de filtro
  const changeScope = (next: CampaignScope) => {
    nav.go(adminPath.content(route.section, next, route.npcView), { replace: true });
  };

  const changeNpcView = (view: NpcViewId) => {
    if (view !== route.npcView) nav.go(adminPath.content('npcs', scope, view));
  };

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <span className="w-1 h-9 bg-accent shrink-0" aria-hidden />
          <div className="min-w-0">
            <h2 className="font-display font-bold uppercase tracking-[0.18em] text-xl text-bone leading-none">
              {t('content.title')}
            </h2>
            {current.blurbKey && (
              <p className="text-[10px] font-display font-bold text-ash-500 uppercase tracking-[0.2em] mt-2 truncate">
                {t(current.blurbKey)}
              </p>
            )}
          </div>
        </div>
        <CampaignScopeSelect
          value={scope}
          onChange={changeScope}
          campaigns={campaigns}
          className="w-full max-w-60 shrink-0"
        />
      </header>

      <AdminSubTabs
        tabs={tabs}
        active={route.section}
        onChange={changeSection}
        indicatorId="admin-content-sub"
        ariaLabel={t('content.title')}
      />

      <AdminSectionPanels
        active={route.section}
        render={(section) => {
          switch (section) {
            case 'intel':
              return (
                <MediaLibraryPanel
                  embedded
                  campaignScope={scope}
                  scopeRequest={scopeRequest?.area === 'intel' ? scopeRequest : null}
                  onScopeConsumed={onScopeConsumed}
                />
              );
            case 'conquistas':
              return (
                <AchievementsPanel
                  embedded
                  campaignScope={scope}
                  scopeRequest={scopeRequest?.area === 'achievements' ? scopeRequest : null}
                  onScopeConsumed={onScopeConsumed}
                />
              );
            case 'npcs':
              return (
                <NpcSmsPanel
                  embedded
                  campaignScope={scope}
                  npcView={route.npcView}
                  onNpcViewChange={changeNpcView}
                  scopeRequest={scopeRequest?.area === 'sms' ? scopeRequest : null}
                  onScopeConsumed={onScopeConsumed}
                />
              );
            case 'qr':
              return <RedirectsPanel embedded campaignScope={scope} />;
          }
        }}
      />
    </div>
  );
}
