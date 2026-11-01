/**
 * Fonte única da navegação do admin: destinos, seções, rótulos (chaves i18n),
 * ícones, atalhos, construtores de caminho e o parser de URL.
 *
 * Só `import type` aqui: o módulo roda isolado em Node para checagens headless.
 */
import type { CampaignScope } from './campaignResources';
import type { MissionTabId } from '../components/mission/types';

export type AdminDestinationId = 'live' | 'missions' | 'content' | 'mesa' | 'system';
export type MissionSectionId = MissionTabId;
export type ContentSectionId = 'intel' | 'conquistas' | 'npcs' | 'qr';
export type NpcViewId = 'contatos' | 'dialogos';
export type MesaSectionId = 'esquadroes' | 'contas' | 'acesso';
export type SystemSectionId = 'relatorios' | 'log';

/** Catálogos que aceitam abrir já filtrados por uma missão. */
export type CampaignScopedArea = 'intel' | 'achievements' | 'sms';

/**
 * Pedido de criação vindo da missão: o catálogo de destino abre o editor já
 * vinculado à campanha e consome o pedido uma vez (ver `onScopeConsumed`).
 */
export interface CampaignScopeRequest {
  area: CampaignScopedArea;
  campaignId: string;
  create?: boolean;
}

export type AdminRoute =
  | { dest: 'live' }
  | { dest: 'missions'; view: 'list' }
  | { dest: 'missions'; view: 'new' }
  | { dest: 'missions'; view: 'mission'; campaignId: string; section: MissionSectionId }
  | { dest: 'content'; section: ContentSectionId; mission: CampaignScope; npcView: NpcViewId }
  | { dest: 'mesa'; section: MesaSectionId; accountUid?: string; agentId?: string; squadId?: string }
  | { dest: 'system'; section: SystemSectionId };

export type RouteOf<D extends AdminDestinationId> = Extract<AdminRoute, { dest: D }>;

export type AdminNavGroupId = 'session' | 'prep' | 'table' | 'core';

export interface AdminSectionDef<S extends string = string> {
  id: S;
  labelKey: string;
  blurbKey?: string;
  icon: string;
}

export interface AdminDestinationDef {
  id: AdminDestinationId;
  labelKey: string;
  icon: string;
  shortcut: '1' | '2' | '3' | '4' | '5';
  group: AdminNavGroupId;
}

export const ADMIN_NAV_GROUPS: readonly { id: AdminNavGroupId; labelKey: string }[] = [
  { id: 'session', labelKey: 'sidebar.group.session' },
  { id: 'prep', labelKey: 'sidebar.group.prep' },
  { id: 'table', labelKey: 'sidebar.group.table' },
  { id: 'core', labelKey: 'sidebar.group.core' },
];

export const ADMIN_DESTINATIONS: readonly AdminDestinationDef[] = [
  { id: 'live', labelKey: 'sidebar.live', icon: 'sensors', shortcut: '1', group: 'session' },
  { id: 'missions', labelKey: 'sidebar.missions', icon: 'map', shortcut: '2', group: 'prep' },
  { id: 'content', labelKey: 'sidebar.media', icon: 'folder_open', shortcut: '3', group: 'prep' },
  { id: 'mesa', labelKey: 'sidebar.mesa', icon: 'groups', shortcut: '4', group: 'table' },
  { id: 'system', labelKey: 'sidebar.systems', icon: 'tune', shortcut: '5', group: 'core' },
];

export const MISSION_SECTIONS: readonly AdminSectionDef<MissionSectionId>[] = [
  { id: 'dados', labelKey: 'missions.tab.dados', icon: 'edit_note' },
  { id: 'recursos', labelKey: 'missions.tab.recursos', icon: 'checklist' },
  { id: 'vinculos', labelKey: 'missions.tab.vinculos', icon: 'key' },
  { id: 'inventario', labelKey: 'missions.tab.inventario', icon: 'inventory_2' },
  { id: 'transmissao', labelKey: 'missions.tab.transmissao', icon: 'live_tv' },
];

export const CONTENT_SECTIONS: readonly AdminSectionDef<ContentSectionId>[] = [
  { id: 'intel', labelKey: 'content.sub.intel', blurbKey: 'content.sub.intelBlurb', icon: 'folder_open' },
  { id: 'conquistas', labelKey: 'content.sub.achievements', blurbKey: 'content.sub.achievementsBlurb', icon: 'emoji_events' },
  { id: 'npcs', labelKey: 'content.sub.npcs', blurbKey: 'content.sub.npcsBlurb', icon: 'sms' },
  { id: 'qr', labelKey: 'content.sub.qr', blurbKey: 'content.sub.qrBlurb', icon: 'qr_code' },
];

export const MESA_SECTIONS: readonly AdminSectionDef<MesaSectionId>[] = [
  { id: 'esquadroes', labelKey: 'mesa.sub.squads', blurbKey: 'mesa.sub.squadsBlurb', icon: 'groups' },
  { id: 'contas', labelKey: 'mesa.sub.accounts', blurbKey: 'mesa.sub.accountsBlurb', icon: 'group' },
  { id: 'acesso', labelKey: 'mesa.sub.access', blurbKey: 'mesa.sub.accessBlurb', icon: 'lock_open' },
];

export const SYSTEM_SECTIONS: readonly AdminSectionDef<SystemSectionId>[] = [
  { id: 'relatorios', labelKey: 'systems.sub.reports', blurbKey: 'systems.sub.reportsBlurb', icon: 'analytics' },
  { id: 'log', labelKey: 'systems.sub.log', blurbKey: 'systems.sub.logBlurb', icon: 'receipt_long' },
];

export const DEFAULT_MISSION_SECTION: MissionSectionId = 'recursos';
const DEFAULT_CONTENT_SECTION: ContentSectionId = 'intel';
const DEFAULT_MESA_SECTION: MesaSectionId = 'esquadroes';
const DEFAULT_SYSTEM_SECTION: SystemSectionId = 'relatorios';

/** Id reservado: `/admin/missions/new` é a criação de missão. */
export const NEW_MISSION_SEGMENT = 'new';

const BASE = '/admin';
const enc = encodeURIComponent;

export const adminPath = {
  live: (anchor?: 'jukebox') => `${BASE}/live${anchor ? '#admin-jukebox' : ''}`,
  missions: () => `${BASE}/missions`,
  newMission: () => `${BASE}/missions/${NEW_MISSION_SEGMENT}`,
  mission: (campaignId: string, section: MissionSectionId = DEFAULT_MISSION_SECTION) =>
    `${BASE}/missions/${enc(campaignId)}/${section}`,
  content: (
    section: ContentSectionId = DEFAULT_CONTENT_SECTION,
    mission: CampaignScope = 'all',
    npcView: NpcViewId = 'contatos'
  ) => {
    const view = section === 'npcs' && npcView === 'dialogos' ? '/dialogos' : '';
    const query = mission && mission !== 'all' ? `?mission=${enc(mission)}` : '';
    return `${BASE}/content/${section}${view}${query}`;
  },
  mesa: (section: MesaSectionId = DEFAULT_MESA_SECTION) => `${BASE}/mesa/${section}`,
  squad: (groupId: string) => `${BASE}/mesa/esquadroes?squad=${enc(groupId)}`,
  account: (uid: string) => `${BASE}/mesa/contas/${enc(uid)}`,
  agent: (uid: string, charId: string) => `${BASE}/mesa/contas/${enc(uid)}/${enc(charId)}`,
  system: (section: SystemSectionId = DEFAULT_SYSTEM_SECTION, anchor?: 'analytics') =>
    `${BASE}/system/${section}${anchor ? '#admin-analytics' : ''}`,
};

export function routeToPath(route: AdminRoute): string {
  switch (route.dest) {
    case 'live':
      return adminPath.live();
    case 'missions':
      if (route.view === 'list') return adminPath.missions();
      if (route.view === 'new') return adminPath.newMission();
      return adminPath.mission(route.campaignId, route.section);
    case 'content':
      return adminPath.content(route.section, route.mission, route.npcView);
    case 'mesa':
      if (route.section === 'contas' && route.accountUid) {
        return route.agentId
          ? adminPath.agent(route.accountUid, route.agentId)
          : adminPath.account(route.accountUid);
      }
      if (route.section === 'esquadroes' && route.squadId) return adminPath.squad(route.squadId);
      return adminPath.mesa(route.section);
    case 'system':
      return adminPath.system(route.section);
  }
}

/**
 * Raiz do destino a partir da rota atual: fecha o nível de detalhe
 * (missão aberta, conta, dossiê, destaque) e mantém seção e filtro.
 */
export function destinationRootPath(route: AdminRoute): string {
  switch (route.dest) {
    case 'missions':
      return adminPath.missions();
    case 'mesa':
      return adminPath.mesa(route.section);
    default:
      return routeToPath(route);
  }
}

export function defaultDestinationPath(dest: AdminDestinationId): string {
  switch (dest) {
    case 'live':
      return adminPath.live();
    case 'missions':
      return adminPath.missions();
    case 'content':
      return adminPath.content();
    case 'mesa':
      return adminPath.mesa();
    case 'system':
      return adminPath.system();
  }
}

/** Mapeia as URLs antigas `?tab=&sub=` para os caminhos atuais. */
export function legacyAdminPath(params: URLSearchParams): string {
  const tab = params.get('tab');
  const sub = params.get('sub');
  switch (tab) {
    case 'players':
      return adminPath.mesa('contas');
    case 'squads':
      return adminPath.mesa('esquadroes');
    case 'mesa':
      return adminPath.mesa(sub === 'contas' ? 'contas' : 'esquadroes');
    case 'missions':
      return adminPath.missions();
    case 'media':
      return adminPath.content('intel');
    case 'intel':
      if (sub === 'jukebox') return adminPath.live('jukebox');
      if (sub === 'qr') return adminPath.content('qr');
      if (sub === 'conquistas') return adminPath.content('conquistas');
      return adminPath.content('intel');
    case 'systems':
      switch (sub) {
        case 'jukebox':
          return adminPath.live('jukebox');
        case 'qr':
          return adminPath.content('qr');
        case 'conquistas':
          return adminPath.content('conquistas');
        case 'sms':
          return adminPath.content('npcs');
        case 'acesso':
          return adminPath.mesa('acesso');
        default:
          return adminPath.system('relatorios');
      }
    default:
      return adminPath.live();
  }
}

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function isOneOf<T extends string>(value: string | undefined, list: readonly { id: T }[]): value is T {
  return value !== undefined && list.some((item) => item.id === value);
}

function parseRoute(segments: string[], params: URLSearchParams): AdminRoute {
  const [dest, a, b, c] = segments;
  switch (dest) {
    case 'missions': {
      if (!a) return { dest: 'missions', view: 'list' };
      if (a === NEW_MISSION_SEGMENT) return { dest: 'missions', view: 'new' };
      return {
        dest: 'missions',
        view: 'mission',
        campaignId: a,
        section: isOneOf(b, MISSION_SECTIONS) ? b : DEFAULT_MISSION_SECTION,
      };
    }
    case 'content': {
      const section = isOneOf(a, CONTENT_SECTIONS) ? a : DEFAULT_CONTENT_SECTION;
      const mission = params.get('mission') || 'all';
      const npcView: NpcViewId = section === 'npcs' && b === 'dialogos' ? 'dialogos' : 'contatos';
      return { dest: 'content', section, mission, npcView };
    }
    case 'mesa': {
      const section = isOneOf(a, MESA_SECTIONS) ? a : DEFAULT_MESA_SECTION;
      if (section === 'contas' && b) {
        return { dest: 'mesa', section, accountUid: b, ...(c ? { agentId: c } : {}) };
      }
      const squadId = section === 'esquadroes' ? params.get('squad') : null;
      return { dest: 'mesa', section, ...(squadId ? { squadId } : {}) };
    }
    case 'system':
      return { dest: 'system', section: isOneOf(a, SYSTEM_SECTIONS) ? a : DEFAULT_SYSTEM_SECTION };
    default:
      return { dest: 'live' };
  }
}

/**
 * Lê `pathname` + `search` do admin e devolve a rota tipada. Quando o URL não
 * é canônico (raiz, URL antiga, seção inválida, segmentos extras), `redirect`
 * traz o caminho canônico para um `<Navigate replace>`; `route` já reflete o destino.
 */
export function parseAdminLocation(
  pathname: string,
  search: string
): { route: AdminRoute; redirect: string | null } {
  const params = new URLSearchParams(search);
  const rest = pathname.replace(/^\/admin\/?/, '').replace(/\/+$/, '');
  const segments = rest ? rest.split('/').filter(Boolean).map(safeDecode) : [];

  if (segments.length === 0) {
    const target = params.has('tab') ? legacyAdminPath(params) : adminPath.live();
    const hashIndex = target.indexOf('#');
    const targetPath = hashIndex >= 0 ? target.slice(0, hashIndex) : target;
    const queryIndex = targetPath.indexOf('?');
    const route = parseRoute(
      (queryIndex >= 0 ? targetPath.slice(0, queryIndex) : targetPath)
        .replace(/^\/admin\/?/, '')
        .split('/')
        .filter(Boolean)
        .map(safeDecode),
      new URLSearchParams(queryIndex >= 0 ? targetPath.slice(queryIndex) : '')
    );
    return { route, redirect: target };
  }

  const route = parseRoute(segments, params);
  const canonical = routeToPath(route);
  const current = `${pathname.replace(/\/+$/, '')}${search}`;
  return { route, redirect: decodedUrl(canonical) === decodedUrl(current) ? null : canonical };
}

/** Compara URLs sem depender de como cada lado codificou os segmentos. */
function decodedUrl(url: string): string {
  const queryIndex = url.indexOf('?');
  const path = queryIndex >= 0 ? url.slice(0, queryIndex) : url;
  const query = queryIndex >= 0 ? url.slice(queryIndex + 1) : '';
  const entries = [...new URLSearchParams(query).entries()].map(([k, v]) => `${k}=${v}`).sort();
  return `${path.split('/').map(safeDecode).join('/')}?${entries.join('&')}`;
}
