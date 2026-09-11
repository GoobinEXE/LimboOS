import React, { useMemo, useState } from 'react';
import { ALL_ACHIEVEMENTS } from '../../data/achievements';
import {
  ACHIEVEMENT_CATEGORY_LABELS,
  ACHIEVEMENT_TIER_LABELS,
  PLATFORM_LABELS,
  groupAchievementsByCategory,
  type AchievementCategory,
  type AchievementTier,
} from '../../services/AchievementManager';

export default function AchievementsPanel({ embedded = false }: { embedded?: boolean }) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<AchievementCategory | 'all'>('all');

  const filteredAchievements = useMemo(() => {
    const q = search.toLowerCase();
    return ALL_ACHIEVEMENTS.filter((a) => {
      const matchesSearch =
        !q ||
        a.title.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q);
      const matchesCategory = categoryFilter === 'all' || a.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [search, categoryFilter]);

  const groups = groupAchievementsByCategory(filteredAchievements);

  const tierBadge = (tier: AchievementTier) => {
    const tone =
      tier === 'legendary'
        ? 'text-amber-300 border-amber-400/40 bg-amber-400/10'
        : tier === 'rare'
          ? 'text-yellow-300 border-yellow-500/30 bg-yellow-500/10'
          : 'text-zinc-400 border-white/10 bg-white/5';
    return (
      <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 border rounded-sm ${tone}`}>
        {ACHIEVEMENT_TIER_LABELS[tier]}
      </span>
    );
  };

  return (
    <section className="space-y-8 font-chakra">
      {!embedded && (
      <div className="flex items-center gap-4">
        <div className="w-2 h-8 bg-secondary rounded-full animate-pulse shadow-[0_0_10px_rgba(198,198,198,0.4)]" />
        <h2 className="font-black uppercase tracking-widest text-lg text-white">Catálogo_Global_de_Conquistas</h2>
      </div>
      )}

      <div className="bg-surface-container-low border border-primary/10 rounded-sm flex flex-col h-[550px] shadow-2xl overflow-hidden relative">
        <div className="p-6 border-b border-primary/10 bg-black/40 flex flex-col gap-4 relative z-10">
          <div className="flex justify-between items-center gap-4">
            <div className="relative w-full max-w-md">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-zinc-700 text-sm">
                search
              </span>
              <input
                type="text"
                placeholder="FILTRAR_CATÁLOGO..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-black/40 border-2 border-white/5 text-[11px] font-black uppercase px-12 py-3 text-white outline-none focus:border-secondary transition-all rounded-sm"
              />
            </div>
            <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest shrink-0">
              {filteredAchievements.length} MEDALHAS MAPEADAS
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCategoryFilter('all')}
              className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 border rounded-sm transition-colors ${
                categoryFilter === 'all'
                  ? 'border-secondary text-secondary bg-secondary/10'
                  : 'border-white/10 text-zinc-500 hover:text-white'
              }`}
            >
              Todas
            </button>
            {(Object.keys(ACHIEVEMENT_CATEGORY_LABELS) as AchievementCategory[]).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 border rounded-sm transition-colors ${
                  categoryFilter === cat
                    ? 'border-secondary text-secondary bg-secondary/10'
                    : 'border-white/10 text-zinc-500 hover:text-white'
                }`}
              >
                {ACHIEVEMENT_CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 bg-black/20 custom-scrollbar relative z-10 space-y-8">
          {filteredAchievements.length === 0 && (
            <div className="p-24 text-center opacity-20 flex flex-col items-center">
              <span className="material-symbols-outlined text-6xl mb-4">search_off</span>
              <p className="text-[10px] font-black uppercase tracking-[0.4em]">Nenhum_Registro_Encontrado</p>
            </div>
          )}
          {groups.map((group) => (
            <div key={group.category} className="space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">
                {group.label} // {group.items.length}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {group.items.map((ach) => (
                  <div
                    key={ach.id}
                    className="bg-black border-2 border-[#1a1a1a] p-6 rounded-xl flex items-start gap-5 group hover:border-secondary/20 transition-all shadow-lg"
                  >
                    <div className="w-14 h-14 shrink-0 overflow-hidden rounded-lg border border-secondary/20 shadow-inner group-hover:scale-110 transition-transform">
                      <img src={ach.icon} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h4 className="text-sm font-black text-white uppercase tracking-wider group-hover:text-secondary transition-colors">
                          {ach.title}
                        </h4>
                        {tierBadge(ach.tier)}
                        <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 border rounded-sm text-zinc-400 border-white/10">
                          {PLATFORM_LABELS[ach.primaryPlatform]}
                        </span>
                      </div>
                      <p className="text-[9px] font-mono text-zinc-600 font-bold uppercase mt-1 tracking-widest mb-2">
                        ID: {ach.id}
                        {ach.campaignIds === 'global'
                          ? ' · CAMP: GLOBAL'
                          : ` · CAMP: ${ach.campaignIds.join(',')}`}
                      </p>
                      {ach.description && (
                        <p className="text-[10px] text-zinc-400 font-bold leading-relaxed">{ach.description}</p>
                      )}
                      <p className="text-[9px] text-zinc-600 mt-2 leading-relaxed">{ach.unlockCondition}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
