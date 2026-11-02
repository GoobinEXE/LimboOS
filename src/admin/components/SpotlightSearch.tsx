import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { masterAccountLabel } from '../lib/entityLabels';
import {
  ADMIN_DESTINATIONS,
  CONTENT_SECTIONS,
  MESA_SECTIONS,
  SYSTEM_SECTIONS,
  adminPath,
  defaultDestinationPath,
  type AdminDestinationId,
  type AdminSectionDef,
} from '../lib/adminNavigation';
import i18n from '../../i18n';

export interface SearchableItem {
  id: string;
  label: string;
  sublabel?: string;
  category: 'account' | 'agent' | 'tab' | 'group' | 'mission';
  icon: string;
  /** Caminho do admin (entra no histórico) ou, fora de `/admin`, o app do jogador. */
  to: string;
}

interface SpotlightSearchProps {
  open: boolean;
  onClose: () => void;
  items: SearchableItem[];
  onNavigate: (to: string) => void;
}

export default function SpotlightSearch({ open, onClose, items, onNavigate }: SpotlightSearchProps) {
  const { t } = useTranslation('admin');
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIdx(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const filtered = useMemo(() => {
    if (!query.trim()) return items.slice(0, 12);
    const q = query.toLowerCase();
    return items.filter(
      (it) => it.label.toLowerCase().includes(q) || (it.sublabel || '').toLowerCase().includes(q)
    ).slice(0, 12);
  }, [items, query]);

  // Group results by category
  const grouped = useMemo(() => {
    const map: Record<string, SearchableItem[]> = {};
    filtered.forEach((it) => {
      if (!map[it.category]) map[it.category] = [];
      map[it.category].push(it);
    });
    return map;
  }, [filtered]);

  const categoryLabel: Record<string, string> = {
    tab: t('spotlight.category.nav'),
    account: t('spotlight.category.accounts'),
    agent: t('spotlight.category.agents'),
    group: t('spotlight.category.squads'),
    mission: t('spotlight.category.missions'),
  };

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  const handleSelect = useCallback((item: SearchableItem) => {
    onClose();
    onNavigate(item.to);
  }, [onClose, onNavigate]);

  // Mantém o item ativo visível ao navegar pelo teclado
  useEffect(() => {
    if (!open) return;
    document.getElementById(`spotlight-opt-${selectedIdx}`)?.scrollIntoView({ block: 'nearest' });
  }, [selectedIdx, open]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const count = filtered.length;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (count) setSelectedIdx((prev) => (prev + 1) % count);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (count) setSelectedIdx((prev) => (prev - 1 + count) % count);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIdx]) handleSelect(filtered[selectedIdx]);
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
    }
  }, [filtered, selectedIdx, handleSelect, onClose]);

  // Paleta de comando abre dezenas de vezes por sessão: sem animação de entrada/saída
  if (!open) return null;

  const activeId = filtered[selectedIdx] ? `spotlight-opt-${selectedIdx}` : undefined;

  return (
    <div
      className="fixed inset-0 z-9999 flex items-start justify-center pt-[12vh] bg-surface-scrim p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('spotlight.placeholder')}
        className="w-full max-w-xl bg-surface-container-low border border-border-strong rounded-card shadow-2xl machined-edge overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        {/* Campo de busca */}
        <div className="flex items-center gap-3 px-5 h-14 border-b border-seam">
          <span className="material-symbols-outlined text-accent text-xl" aria-hidden>search</span>
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={filtered.length > 0}
            aria-controls="spotlight-listbox"
            aria-activedescendant={activeId}
            aria-autocomplete="list"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('spotlight.placeholder')}
            className="focus-bare flex-1 bg-transparent text-bone text-[15px] outline-none placeholder:text-ash-600"
          />
          <kbd className="lmb-kbd">ESC</kbd>
        </div>

        {/* Resultados */}
        <div id="spotlight-listbox" role="listbox" className="max-h-[52vh] overflow-y-auto custom-scrollbar py-1">
          {filtered.length === 0 ? (
            <div className="py-14 text-center">
              <span className="material-symbols-outlined text-3xl text-ash-700 block mb-3" aria-hidden>search_off</span>
              <p className="text-[10px] font-display font-bold text-ash-500 uppercase tracking-[0.3em]">{t('spotlight.empty')}</p>
            </div>
          ) : (
            Object.entries(grouped).map(([cat, catItems]: [string, SearchableItem[]]) => (
              <div key={cat} role="group" aria-label={categoryLabel[cat] || cat}>
                <div className="px-5 pt-3 pb-1.5">
                  <span className="text-[9px] font-display font-bold text-ash-500 uppercase tracking-[0.3em]">{categoryLabel[cat] || cat}</span>
                </div>
                {catItems.map((item) => {
                  const globalIdx = filtered.indexOf(item);
                  const isSelected = globalIdx === selectedIdx;
                  return (
                    <button
                      key={item.id}
                      id={`spotlight-opt-${globalIdx}`}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      tabIndex={-1}
                      onClick={() => handleSelect(item)}
                      onMouseMove={() => { if (!isSelected) setSelectedIdx(globalIdx); }}
                      className={`relative w-full flex items-center gap-3.5 px-5 h-12 text-left ${
                        isSelected ? 'bg-accent-10 text-bone' : 'text-ash-300'
                      }`}
                    >
                      {isSelected && <span className="absolute left-0 top-2 bottom-2 w-0.5 bg-accent" aria-hidden />}
                      <span className={`material-symbols-outlined text-[18px] ${isSelected ? 'text-accent' : 'text-ash-600'}`} aria-hidden>{item.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-display font-bold uppercase tracking-[0.14em] truncate">{item.label}</p>
                        {item.sublabel && <p className="text-[10px] font-mono text-ash-500 truncate mt-0.5">{item.sublabel}</p>}
                      </div>
                      {isSelected && (
                        <kbd className="lmb-kbd" aria-hidden>↵</kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Rodapé de dicas */}
        <div className="px-5 py-2.5 border-t border-seam bg-surface-container-lowest flex items-center justify-between gap-3 flex-wrap">
          <div className="flex gap-4 flex-wrap">
            <span className="text-[9px] font-display font-bold text-ash-500 uppercase tracking-widest">{t('spotlight.hint.navigate')}</span>
            <span className="text-[9px] font-display font-bold text-ash-500 uppercase tracking-widest">{t('spotlight.hint.select')}</span>
            <span className="text-[9px] font-display font-bold text-ash-500 uppercase tracking-widest">{t('spotlight.hint.shortcut')}</span>
            <span className="text-[9px] font-display font-bold text-ash-500 uppercase tracking-widest">{t('spotlight.hint.tabs')}</span>
          </div>
          <span className="text-[9px] font-mono text-ash-600 tabular-nums">
            {t('spotlight.resultsCount', { n: filtered.length })}
          </span>
        </div>
      </div>
    </div>
  );
}

function adminT(key: string, opts?: Record<string, unknown>): string {
  return i18n.t(key, { ns: 'admin', ...opts });
}

interface SearchSources {
  accounts: { uid: string; email?: string; masterName?: string }[];
  characters: { uid: string; char: { id: string; codinome?: string } }[];
  groups: { id: string; name: string }[];
  campaigns: { id: string; name: string }[];
  /** Missão usada pelo atalho "Inventário de missão" (a da sessão ativa, se houver). */
  inventoryMissionId?: string | null;
}

/** Itens da paleta: destinos e seções vêm do config de navegação; entidades viram deep links. */
export function buildSearchItems({
  accounts,
  characters,
  groups,
  campaigns,
  inventoryMissionId,
}: SearchSources): SearchableItem[] {
  const items: SearchableItem[] = [];

  ADMIN_DESTINATIONS.forEach((dest) => {
    items.push({
      id: `tab_${dest.id}`,
      label: adminT(dest.labelKey),
      category: 'tab',
      icon: dest.icon,
      to: defaultDestinationPath(dest.id),
    });
  });

  const pushSections = <S extends string>(
    dest: AdminDestinationId,
    sections: readonly AdminSectionDef<S>[],
    pathFor: (section: S) => string
  ) => {
    const destLabel = adminT(ADMIN_DESTINATIONS.find((d) => d.id === dest)!.labelKey);
    sections.forEach((section) => {
      items.push({
        id: `${dest}_${section.id}`,
        label: adminT(section.labelKey),
        sublabel: destLabel,
        category: 'tab',
        icon: section.icon,
        to: pathFor(section.id),
      });
    });
  };
  pushSections('content', CONTENT_SECTIONS, (s) => adminPath.content(s));
  pushSections('mesa', MESA_SECTIONS, (s) => adminPath.mesa(s));
  pushSections('system', SYSTEM_SECTIONS, (s) => adminPath.system(s));

  items.push({
    id: 'tab_mission_inventory',
    label: adminT('spotlight.item.missionInventory'),
    sublabel: adminT('spotlight.item.missionInventorySub'),
    category: 'tab',
    icon: 'inventory_2',
    to: inventoryMissionId ? adminPath.mission(inventoryMissionId, 'inventario') : adminPath.missions(),
  });

  items.push({
    id: 'tab_play_as_agent',
    label: adminT('spotlight.item.playAsAgent'),
    sublabel: adminT('spotlight.item.playAsAgentSub'),
    category: 'tab',
    icon: 'sports_esports',
    to: '/?mode=play',
  });

  items.push({
    id: 'tab_jukebox',
    label: adminT('spotlight.item.jukebox'),
    sublabel: adminT('spotlight.sub.live'),
    category: 'tab',
    icon: 'queue_music',
    to: adminPath.live('jukebox'),
  });

  groups.forEach((g) => {
    items.push({
      id: `group_${g.id}`,
      label: g.name,
      sublabel: adminT('spotlight.sub.squad'),
      category: 'group',
      icon: 'groups',
      to: adminPath.squad(g.id),
    });
  });

  campaigns.forEach((c) => {
    items.push({
      id: `mission_${c.id}`,
      label: c.name,
      sublabel: adminT('spotlight.sub.mission'),
      category: 'mission',
      icon: 'map',
      to: adminPath.mission(c.id),
    });
  });

  accounts.forEach((acc) => {
    items.push({
      id: `acc_${acc.uid}`,
      label: acc.masterName || acc.email || adminT('entity.accountNoName'),
      sublabel: acc.email,
      category: 'account',
      icon: 'person',
      to: adminPath.account(acc.uid),
    });
  });

  const accountByUid = new Map(accounts.map((acc) => [acc.uid, acc]));
  characters.forEach(({ uid, char }) => {
    const account = accountByUid.get(uid);
    items.push({
      id: `char_${char.id}`,
      label: char.codinome || adminT('entity.agentNoCodename'),
      sublabel: masterAccountLabel(account, adminT('entity.masterUnknown')),
      category: 'agent',
      icon: 'badge',
      to: adminPath.agent(uid, char.id),
    });
  });

  return items;
}
