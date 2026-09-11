import React from 'react';
import type { MasterAccount, CharacterData } from '../../types/player';

export type OperationsSubId = 'relatorios' | 'acesso' | 'qr' | 'conquistas';
export type MesaSubId = 'esquadroes' | 'contas';
export type MissionTabId = 'dados' | 'vinculos' | 'inventario' | 'transmissao';

export const ADMIN_TAB_IDS = ['live', 'mesa', 'missions', 'media', 'systems'] as const;
export type AdminTabId = (typeof ADMIN_TAB_IDS)[number];

export const OPERATIONS_SUB_IDS: OperationsSubId[] = ['relatorios', 'acesso', 'qr', 'conquistas'];
export const MESA_SUB_IDS: MesaSubId[] = ['esquadroes', 'contas'];

export interface MetricNavigationOptions {
  opsSubTab?: OperationsSubId;
  mesaSubTab?: MesaSubId;
  /** @deprecated legacy intel tab migration */
  intelSubTab?: 'acervo' | 'jukebox' | 'qr' | 'conquistas';
  scrollTo?: string;
  openMissionId?: string;
  missionTab?: MissionTabId;
}

export function migrateLegacyAdminUrl(
  tab: string | null,
  sub: string | null
): { tab: AdminTabId; opsSub: OperationsSubId; mesaSub: MesaSubId } | null {
  if (!tab) return null;

  if (tab === 'dashboard') {
    return { tab: 'live', opsSub: 'acesso', mesaSub: 'esquadroes' };
  }
  if (tab === 'players') {
    return { tab: 'mesa', opsSub: 'acesso', mesaSub: 'contas' };
  }
  if (tab === 'squads') {
    return { tab: 'mesa', opsSub: 'acesso', mesaSub: 'esquadroes' };
  }
  if (tab === 'intel') {
    if (sub === 'jukebox') {
      return { tab: 'live', opsSub: 'acesso', mesaSub: 'esquadroes' };
    }
    if (sub === 'qr' || sub === 'conquistas') {
      return { tab: 'systems', opsSub: sub, mesaSub: 'esquadroes' };
    }
    return { tab: 'media', opsSub: 'acesso', mesaSub: 'esquadroes' };
  }
  if (tab === 'systems' && sub === 'jukebox') {
    return { tab: 'live', opsSub: 'acesso', mesaSub: 'esquadroes' };
  }
  if (tab === 'systems' && sub === 'acesso') {
    return { tab: 'systems', opsSub: 'acesso', mesaSub: 'esquadroes' };
  }

  return null;
}

export function readAdminTabFromUrl(): AdminTabId {
  try {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    const sub = params.get('sub');
    const migrated = migrateLegacyAdminUrl(tab, sub);
    if (migrated) return migrated.tab;
    return tab && (ADMIN_TAB_IDS as readonly string[]).includes(tab) ? (tab as AdminTabId) : 'live';
  } catch {
    return 'live';
  }
}

export function readOperationsSubFromUrl(): OperationsSubId {
  try {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    const sub = params.get('sub');
    const migrated = migrateLegacyAdminUrl(tab, sub);
    if (migrated && migrated.tab === 'systems') return migrated.opsSub;
    if (tab === 'systems' && sub && OPERATIONS_SUB_IDS.includes(sub as OperationsSubId)) {
      return sub as OperationsSubId;
    }
    return 'relatorios';
  } catch {
    return 'relatorios';
  }
}

export function readMesaSubFromUrl(): MesaSubId {
  try {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    const sub = params.get('sub');
    const migrated = migrateLegacyAdminUrl(tab, sub);
    if (migrated && migrated.tab === 'mesa') return migrated.mesaSub;
    if (tab === 'mesa' && sub && MESA_SUB_IDS.includes(sub as MesaSubId)) {
      return sub as MesaSubId;
    }
    return 'esquadroes';
  } catch {
    return 'esquadroes';
  }
}

export function syncAdminTabsToUrl(
  tab: string,
  opsSub: OperationsSubId,
  mesaSub: MesaSubId
): void {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    if (tab === 'systems') url.searchParams.set('sub', opsSub);
    else if (tab === 'mesa') url.searchParams.set('sub', mesaSub);
    else if (tab === 'live' && url.searchParams.get('sub') === 'jukebox') {
      // keep hash-style via replace below — clear orphan sub
      url.searchParams.delete('sub');
    } else url.searchParams.delete('sub');
    const next = url.pathname + url.search;
    if (next !== window.location.pathname + window.location.search) {
      window.history.replaceState(window.history.state, '', next);
    }
  } catch {
    // ignore
  }
}

export type { MasterAccount, CharacterData };
