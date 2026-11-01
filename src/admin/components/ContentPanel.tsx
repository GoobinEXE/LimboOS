import React from 'react';
import { useTranslation } from 'react-i18next';
import MediaLibraryPanel from './MediaLibraryPanel';
import AchievementsPanel from './AchievementsPanel';
import NpcSmsPanel from './NpcSmsPanel';
import RedirectsPanel from './RedirectsPanel';
import AdminSubTabs from './AdminSubTabs';
import AdminSectionPanels from './AdminSectionPanels';
import {
  CONTENT_SECTIONS,
  adminPath,
  type CampaignScopeRequest,
  type ContentSectionId,
  type RouteOf,
} from '../lib/adminNavigation';
import { useAdminNavigate } from '../hooks/useAdminRoute';

interface ContentPanelProps {
  route: RouteOf<'content'>;
  /** Pedido vindo da missão para abrir um catálogo filtrado (e o editor de criação). */
  scopeRequest?: CampaignScopeRequest | null;
  onScopeConsumed?: () => void;
}

/**
 * Conteúdo: todos os catálogos de campanha num destino só
 * (Intel & Mídia, Conquistas, NPCs & SMS, QR & Links).
 */
export default function ContentPanel({ route, scopeRequest, onScopeConsumed }: ContentPanelProps) {
  const { t } = useTranslation('admin');
  const nav = useAdminNavigate();

  const tabs = CONTENT_SECTIONS.map((s) => ({ id: s.id, label: t(s.labelKey), icon: s.icon }));
  const current = CONTENT_SECTIONS.find((s) => s.id === route.section) ?? CONTENT_SECTIONS[0];

  const changeSection = (section: ContentSectionId) => {
    if (section !== route.section) nav.go(adminPath.content(section, route.mission));
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
                  scopeRequest={scopeRequest?.area === 'intel' ? scopeRequest : null}
                  onScopeConsumed={onScopeConsumed}
                />
              );
            case 'conquistas':
              return (
                <AchievementsPanel
                  embedded
                  scopeRequest={scopeRequest?.area === 'achievements' ? scopeRequest : null}
                  onScopeConsumed={onScopeConsumed}
                />
              );
            case 'npcs':
              return (
                <NpcSmsPanel
                  embedded
                  scopeRequest={scopeRequest?.area === 'sms' ? scopeRequest : null}
                  onScopeConsumed={onScopeConsumed}
                />
              );
            case 'qr':
              return <RedirectsPanel embedded />;
          }
        }}
      />
    </div>
  );
}
