import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { masterAccountLabel } from '../lib/entityLabels';

interface SearchableItem {
  id: string;
  label: string;
  sublabel?: string;
  category: 'account' | 'agent' | 'tab' | 'group' | 'mission';
  icon: string;
  action: () => void;
}

interface SpotlightSearchProps {
  open: boolean;
  onClose: () => void;
  items: SearchableItem[];
}

export default function SpotlightSearch({ open, onClose, items }: SpotlightSearchProps) {
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
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
    tab: 'NAVEGAÇÃO',
    account: 'CONTAS',
    agent: 'AGENTES',
    group: 'ESQUADRÕES',
    mission: 'MISSÕES',
  };

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  const handleSelect = useCallback((item: SearchableItem) => {
    item.action();
    onClose();
  }, [onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIdx]) handleSelect(filtered[selectedIdx]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [filtered, selectedIdx, handleSelect, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-9999 flex items-start justify-center pt-[15vh] bg-black/85 backdrop-blur-lg p-4"
          onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: -10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: -10 }}
            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            className="w-full max-w-lg bg-surface-container-low border border-primary/30 shadow-2xl overflow-hidden"
            onKeyDown={handleKeyDown}
          >
            {/* Search Input */}
            <div className="flex items-center gap-4 px-6 py-5 border-b border-white/5 bg-black/30">
              <span className="material-symbols-outlined text-primary text-xl">search</span>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar agentes, contas, seções..."
                className="flex-1 bg-transparent text-white text-sm font-display font-bold outline-none placeholder:text-industrial-silver/20 uppercase tracking-wider"
              />
              <kbd className="text-[9px] font-display font-bold text-industrial-silver/20 bg-black/30 border border-white/5 px-2 py-1 rounded-sm tracking-wider">ESC</kbd>
            </div>

            {/* Results */}
            <div className="max-h-[50vh] overflow-y-auto custom-scrollbar">
              {filtered.length === 0 ? (
                <div className="py-16 text-center">
                  <span className="material-symbols-outlined text-4xl text-industrial-silver/10 block mb-3">search_off</span>
                  <p className="text-[10px] font-display font-bold text-industrial-silver/20 uppercase tracking-[0.3em]">Nenhum resultado encontrado</p>
                </div>
              ) : (
                Object.entries(grouped).map(([cat, catItems]: [string, SearchableItem[]]) => (
                  <div key={cat}>
                    <div className="px-6 py-2 bg-black/20">
                      <span className="text-[9px] font-display font-bold text-primary/40 uppercase tracking-[0.3em]">{categoryLabel[cat] || cat}</span>
                    </div>
                    {catItems.map((item) => {
                      const globalIdx = filtered.indexOf(item);
                      const isSelected = globalIdx === selectedIdx;
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleSelect(item)}
                          onMouseEnter={() => setSelectedIdx(globalIdx)}
                          className={`w-full flex items-center gap-4 px-6 py-3.5 transition-all text-left ${
                            isSelected ? 'bg-primary/10 text-primary' : 'text-industrial-silver/50 hover:bg-white/5'
                          }`}
                        >
                          <span className={`material-symbols-outlined text-lg ${isSelected ? 'text-primary' : 'text-industrial-silver/15'}`}>{item.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-[11px] font-display font-bold uppercase tracking-widest truncate ${isSelected ? 'text-white' : ''}`}>{item.label}</p>
                            {item.sublabel && <p className="text-[9px] font-mono text-industrial-silver/25 truncate mt-0.5">{item.sublabel}</p>}
                          </div>
                          {isSelected && (
                            <span className="text-[9px] font-display font-bold text-primary/40 tracking-wider">ENTER ↵</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-white/5 bg-black/20 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex gap-3 flex-wrap">
                <span className="text-[8px] font-display font-bold text-industrial-silver/15 uppercase tracking-widest">↑↓ Navegar</span>
                <span className="text-[8px] font-display font-bold text-industrial-silver/15 uppercase tracking-widest">↵ Selecionar</span>
                <span className="text-[8px] font-display font-bold text-industrial-silver/15 uppercase tracking-widest">⌘/Ctrl+K Spotlight</span>
                <span className="text-[8px] font-display font-bold text-industrial-silver/15 uppercase tracking-widest">⌘/Ctrl+1–6 Abas</span>
              </div>
              <span className="text-[8px] font-display font-bold text-industrial-silver/15 uppercase tracking-widest">{filtered.length} resultados</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function buildSearchItems(
  accounts: { uid: string; email?: string; masterName?: string }[],
  characters: { uid: string; char: { id: string; codinome?: string } }[],
  setActiveTab: (tab: string) => void,
  onSelectAccount?: (uid: string) => void,
  onSelectAgent?: (uid: string, charId: string) => void,
  onOpenMissionInventory?: () => void,
  onOpenOpsSub?: (sub: 'relatorios' | 'acesso' | 'qr' | 'conquistas') => void,
  onOpenMesaSub?: (sub: 'esquadroes' | 'contas') => void,
  groups?: { id: string; name: string }[],
  campaigns?: { id: string; name: string }[],
  onSelectGroup?: (groupId: string) => void,
  onSelectMission?: (campaignId: string) => void,
): SearchableItem[] {
  const items: SearchableItem[] = [];

  const tabs = [
    { id: 'live', label: 'Ao Vivo', icon: 'sensors' },
    { id: 'mesa', label: 'Mesa', icon: 'groups' },
    { id: 'missions', label: 'Missões', icon: 'map' },
    { id: 'media', label: 'Conteúdo', icon: 'folder_open' },
    { id: 'systems', label: 'Sistema', icon: 'tune' },
  ];
  tabs.forEach((t) => {
    items.push({
      id: `tab_${t.id}`,
      label: t.label,
      category: 'tab',
      icon: t.icon,
      action: () => setActiveTab(t.id),
    });
  });

  const mesaSubs: { id: 'esquadroes' | 'contas'; label: string; icon: string }[] = [
    { id: 'esquadroes', label: 'Esquadrões', icon: 'groups' },
    { id: 'contas', label: 'Contas', icon: 'group' },
  ];
  mesaSubs.forEach((s) => {
    items.push({
      id: `mesa_${s.id}`,
      label: s.label,
      sublabel: 'Mesa',
      category: 'tab',
      icon: s.icon,
      action: () => {
        if (onOpenMesaSub) onOpenMesaSub(s.id);
        else setActiveTab('mesa');
      },
    });
  });

  const opsSubs: { id: 'relatorios' | 'acesso' | 'qr' | 'conquistas'; label: string; icon: string }[] = [
    { id: 'relatorios', label: 'Relatórios', icon: 'analytics' },
    { id: 'acesso', label: 'Acesso Hardware', icon: 'lock_open' },
    { id: 'qr', label: 'QR & Links', icon: 'qr_code' },
    { id: 'conquistas', label: 'Conquistas', icon: 'emoji_events' },
  ];
  opsSubs.forEach((s) => {
    items.push({
      id: `ops_${s.id}`,
      label: s.label,
      sublabel: 'Sistema',
      category: 'tab',
      icon: s.icon,
      action: () => {
        if (onOpenOpsSub) onOpenOpsSub(s.id);
        else setActiveTab('systems');
      },
    });
  });

  items.push({
    id: 'tab_mission_inventory',
    label: 'Inventário de Missão',
    sublabel: 'Abrir missões → inventário',
    category: 'tab',
    icon: 'inventory_2',
    action: () => {
      if (onOpenMissionInventory) onOpenMissionInventory();
      else setActiveTab('missions');
    },
  });

  items.push({
    id: 'tab_jukebox',
    label: 'Jukebox',
    sublabel: 'Ao Vivo',
    category: 'tab',
    icon: 'queue_music',
    action: () => {
      setActiveTab('live');
      window.setTimeout(() => {
        document.getElementById('admin-jukebox')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 200);
    },
  });

  (groups || []).forEach((g) => {
    items.push({
      id: `group_${g.id}`,
      label: g.name,
      sublabel: 'Esquadrão',
      category: 'group',
      icon: 'groups',
      action: () => {
        if (onSelectGroup) onSelectGroup(g.id);
        else if (onOpenMesaSub) onOpenMesaSub('esquadroes');
        else setActiveTab('mesa');
      },
    });
  });

  (campaigns || []).forEach((c) => {
    items.push({
      id: `mission_${c.id}`,
      label: c.name,
      sublabel: 'Missão',
      category: 'mission',
      icon: 'map',
      action: () => {
        if (onSelectMission) onSelectMission(c.id);
        else setActiveTab('missions');
      },
    });
  });

  accounts.forEach((acc) => {
    items.push({
      id: `acc_${acc.uid}`,
      label: acc.masterName || acc.email || 'Conta sem nome',
      sublabel: acc.email,
      category: 'account',
      icon: 'person',
      action: () => {
        if (onOpenMesaSub) onOpenMesaSub('contas');
        else setActiveTab('mesa');
        onSelectAccount?.(acc.uid);
      },
    });
  });

  const accountByUid = new Map(accounts.map((acc) => [acc.uid, acc]));
  characters.forEach(({ uid, char }) => {
    const account = accountByUid.get(uid);
    items.push({
      id: `char_${char.id}`,
      label: char.codinome || 'Agente sem codinome',
      sublabel: masterAccountLabel(account, 'Mestre desconhecido'),
      category: 'agent',
      icon: 'badge',
      action: () => {
        if (onOpenMesaSub) onOpenMesaSub('contas');
        else setActiveTab('mesa');
        onSelectAgent?.(uid, char.id);
      },
    });
  });

  return items;
}
