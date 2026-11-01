import {
  ADMIN_DESTINATIONS,
  CONTENT_SECTIONS,
  MESA_SECTIONS,
  MISSION_SECTIONS,
  SYSTEM_SECTIONS,
  adminPath,
  defaultDestinationPath,
  type AdminRoute,
} from './adminNavigation';

export interface AdminCrumb {
  label: string;
  /** Ausente no último nível (página atual). */
  to?: string;
}

export interface BreadcrumbLookup {
  missionName: (campaignId: string) => string;
  accountName: (uid: string) => string;
  agentName: (uid: string, charId: string) => string;
}

type Translate = (key: string) => string;

function sectionLabel(list: readonly { id: string; labelKey: string }[], id: string, t: Translate): string {
  const def = list.find((s) => s.id === id);
  return def ? t(def.labelKey) : id;
}

/** Trilha do cabeçalho: destino › seção › entidade, com links para os níveis acima. */
export function buildAdminBreadcrumb(route: AdminRoute, t: Translate, lookup: BreadcrumbLookup): AdminCrumb[] {
  const dest = ADMIN_DESTINATIONS.find((d) => d.id === route.dest)!;
  const root: AdminCrumb = { label: t(dest.labelKey), to: defaultDestinationPath(route.dest) };
  let crumbs: AdminCrumb[];

  switch (route.dest) {
    case 'live':
      crumbs = [root];
      break;
    case 'missions':
      if (route.view === 'list') crumbs = [root];
      else if (route.view === 'new') crumbs = [root, { label: t('breadcrumb.newMission') }];
      else
        crumbs = [
          root,
          { label: lookup.missionName(route.campaignId), to: adminPath.mission(route.campaignId) },
          { label: sectionLabel(MISSION_SECTIONS, route.section, t) },
        ];
      break;
    case 'content':
      crumbs = [root, { label: sectionLabel(CONTENT_SECTIONS, route.section, t) }];
      break;
    case 'mesa': {
      const section: AdminCrumb = { label: sectionLabel(MESA_SECTIONS, route.section, t), to: adminPath.mesa(route.section) };
      crumbs = [root, section];
      if (route.accountUid) {
        crumbs.push({ label: lookup.accountName(route.accountUid), to: adminPath.account(route.accountUid) });
        if (route.agentId) crumbs.push({ label: lookup.agentName(route.accountUid, route.agentId) });
      }
      break;
    }
    case 'system':
      crumbs = [root, { label: sectionLabel(SYSTEM_SECTIONS, route.section, t) }];
      break;
  }

  const last = crumbs[crumbs.length - 1];
  crumbs[crumbs.length - 1] = { label: last.label };
  return crumbs;
}
