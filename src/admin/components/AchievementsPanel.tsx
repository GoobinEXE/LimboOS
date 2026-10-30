import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ACHIEVEMENT_CATEGORY_LABELS,
  ACHIEVEMENT_TIER_LABELS,
  PLATFORM_LABELS,
  groupAchievementsByCategory,
  achievementFromDef,
  type AchievementCategory,
  type AchievementTier,
} from '../../services/AchievementManager';
import type { AchievementDef } from '../../types/achievement';
import { useAchievementCatalog } from '../../hooks/useAchievementCatalog';
import { achievementCatalogService } from '../../services/AchievementCatalogService';
import { useToast } from './ToastProvider';
import { useModal } from './ConfirmModal';
import AchievementEditorModal, {
  emptyAchievementForm,
  formFromDef,
  formToDefInput,
  type AchievementEditorForm,
} from './AchievementEditorModal';

export default function AchievementsPanel({ embedded = false }: { embedded?: boolean }) {
  const { t } = useTranslation('admin');
  const toast = useToast();
  const { showConfirm, showAlert, modal } = useModal();
  const { defs, isRemote } = useAchievementCatalog();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<AchievementCategory | 'all'>('all');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<AchievementDef | null>(null);
  const [editorForm, setEditorForm] = useState<AchievementEditorForm>(emptyAchievementForm());
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);

  const filteredDefs = useMemo(() => {
    const q = search.toLowerCase();
    return defs.filter((a) => {
      const matchesSearch =
        !q ||
        a.title.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q);
      const matchesCategory = categoryFilter === 'all' || a.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [defs, search, categoryFilter]);

  const groups = useMemo(() => {
    const asAchievements = filteredDefs.map(achievementFromDef);
    return groupAchievementsByCategory(asAchievements).map((g) => ({
      ...g,
      defs: g.items
        .map((ach) => filteredDefs.find((d) => d.id === ach.id))
        .filter(Boolean) as AchievementDef[],
    }));
  }, [filteredDefs]);

  const openCreate = () => {
    setEditing(null);
    setEditorForm(emptyAchievementForm());
    setEditorOpen(true);
  };

  const openEdit = (def: AchievementDef) => {
    setEditing(def);
    setEditorForm(formFromDef(def));
    setEditorOpen(true);
  };

  const handleImport = async () => {
    const ok = await showConfirm(
      t('achievements.importTitle'),
      t('achievements.importBody'),
      t('achievements.importAction'),
    );
    if (!ok) return;
    setImporting(true);
    try {
      const { imported, skipped } = await achievementCatalogService.importSuggestions();
      toast.success(t('achievements.importOk', { imported, skipped }));
    } catch (err) {
      console.error(err);
      toast.error(t('achievements.importFail'));
    } finally {
      setImporting(false);
    }
  };

  const handleToggleEnabled = async (def: AchievementDef) => {
    if (!isRemote) {
      await showAlert(t('achievements.needImportTitle'), t('achievements.needImportBody'));
      return;
    }
    try {
      await achievementCatalogService.update(def.id, { enabled: !def.enabled });
      toast.success(
        def.enabled ? t('achievements.disabledOk') : t('achievements.enabledOk'),
      );
    } catch (err) {
      console.error(err);
      toast.error(t('achievements.saveFail'));
    }
  };

  const handleDelete = async (def: AchievementDef) => {
    if (!isRemote) {
      await showAlert(t('achievements.needImportTitle'), t('achievements.needImportBody'));
      return;
    }
    const ok = await showConfirm(
      t('achievements.deleteTitle'),
      t('achievements.deleteBody', { title: def.title }),
      t('achievements.deleteAction'),
    );
    if (!ok) return;
    try {
      await achievementCatalogService.remove(def.id);
      toast.success(t('achievements.deleteOk'));
    } catch (err) {
      console.error(err);
      toast.error(t('achievements.deleteFail'));
    }
  };

  const handleSave = async (form: AchievementEditorForm, file: File | null) => {
    const isEdit = Boolean(editing);
    const source = editing?.source || 'custom';
    let input;
    try {
      input = formToDefInput(form, source);
    } catch {
      toast.error(t('achievements.saveFail'));
      return;
    }
    if (!input.id || !input.title) {
      toast.error(t('achievements.validation'));
      return;
    }
    if (!isRemote && !isEdit) {
      // criar exige Firestore; import primeiro ou criar após import
    }

    setSaving(true);
    setUploadProgress(file ? 0 : null);
    try {
      if (file) {
        const url = await achievementCatalogService.uploadIcon(input.id, file, (pct) =>
          setUploadProgress(pct),
        );
        input.iconUrl = url;
      }

      if (isEdit && editing) {
        const { id: _id, source: _src, ...patch } = input;
        await achievementCatalogService.update(editing.id, patch);
      } else {
        await achievementCatalogService.create({ ...input, source: 'custom' });
      }
      toast.success(t('achievements.saveOk'));
      setEditorOpen(false);
    } catch (err) {
      console.error(err);
      toast.error(t('achievements.saveFail'));
    } finally {
      setSaving(false);
      setUploadProgress(null);
    }
  };

  const tierBadge = (tier: AchievementTier) => {
    const tone =
      tier === 'legendary'
        ? 'text-amber-300 border-amber-400/40 bg-amber-400/10'
        : tier === 'rare'
          ? 'text-yellow-300 border-yellow-500/30 bg-yellow-500/10'
          : 'text-ash-400 border-border bg-white/5';
    return (
      <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border rounded-sm ${tone}`}>
        {ACHIEVEMENT_TIER_LABELS[tier]}
      </span>
    );
  };

  return (
    <section className="space-y-8">
      {modal}
      {!embedded && (
        <div className="flex items-center gap-4">
          <div className="w-2 h-8 bg-secondary rounded-full animate-pulse shadow-[0_0_10px_rgba(198,198,198,0.4)]" />
          <h2 className="font-black uppercase tracking-widest text-lg text-bone">
            {t('achievements.title')}
          </h2>
        </div>
      )}

      <div className="bg-surface-container-low border border-primary/10 rounded-sm flex flex-col h-[550px] shadow-2xl overflow-hidden relative">
        <div className="p-6 border-b border-primary/10 bg-black/40 flex flex-col gap-4 relative z-10">
          <div className="flex justify-between items-center gap-4 flex-wrap">
            <div className="relative w-full max-w-md">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-ash-700 text-sm">
                search
              </span>
              <input
                type="text"
                placeholder={t('achievements.filter')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-black/40 border-2 border-border-subtle text-[11px] font-black uppercase px-12 py-3 text-bone outline-none focus:border-secondary transition rounded-sm"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black text-ash-600 uppercase tracking-widest shrink-0">
                {filteredDefs.length} {t('achievements.countLabel')}
                {!isRemote && (
                  <span className="ml-2 text-amber-500/80">· {t('achievements.localHint')}</span>
                )}
              </span>
              <button
                type="button"
                disabled={importing}
                onClick={handleImport}
                className="text-[9px] font-black uppercase tracking-widest px-3 py-2 border border-secondary/40 text-secondary hover:bg-secondary/10 rounded-sm disabled:opacity-40"
              >
                {importing ? '…' : t('achievements.import')}
              </button>
              <button
                type="button"
                onClick={openCreate}
                className="text-[9px] font-black uppercase tracking-widest px-3 py-2 bg-primary text-black rounded-sm hover:bg-primary-container"
              >
                {t('achievements.create')}
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCategoryFilter('all')}
              className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 border rounded-sm transition-colors ${
                categoryFilter === 'all'
                  ? 'border-secondary text-secondary bg-secondary/10'
                  : 'border-border text-ash-500 hover:text-bone'
              }`}
            >
              {t('achievements.allCategories')}
            </button>
            {(Object.keys(ACHIEVEMENT_CATEGORY_LABELS) as AchievementCategory[]).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 border rounded-sm transition-colors ${
                  categoryFilter === cat
                    ? 'border-secondary text-secondary bg-secondary/10'
                    : 'border-border text-ash-500 hover:text-bone'
                }`}
              >
                {ACHIEVEMENT_CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 bg-black/20 custom-scrollbar relative z-10 space-y-8">
          {filteredDefs.length === 0 && (
            <div className="p-24 text-center text-ash-500 flex flex-col items-center">
              <span className="material-symbols-outlined text-6xl mb-4 text-ash-700" aria-hidden>search_off</span>
              <p className="text-[10px] font-black uppercase tracking-[0.4em]">{t('achievements.empty')}</p>
            </div>
          )}
          {groups.map((group) => (
            <div key={group.category} className="space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-ash-500">
                {group.label} // {group.defs.length}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {group.defs.map((ach) => (
                  <div
                    key={ach.id}
                    className={`bg-black border-2 p-6 rounded-card flex flex-col gap-4 group transition shadow-lg ${
                      ach.enabled === false
                        ? 'border-border-subtle opacity-50'
                        : 'border-seam hover:border-secondary/20'
                    }`}
                  >
                    <div className="flex items-start gap-5">
                      <div className="w-14 h-14 shrink-0 overflow-hidden rounded-card border border-secondary/20 shadow-inner">
                        <img src={ach.iconUrl} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h4 className="text-sm font-black text-bone uppercase tracking-wider group-hover:text-secondary transition-colors">
                            {ach.title}
                          </h4>
                          {tierBadge(ach.tier)}
                          <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border rounded-sm text-ash-400 border-border">
                            {PLATFORM_LABELS[
                              ach.platforms.includes('walkman')
                                ? 'walkman'
                                : ach.platforms.includes('nokia')
                                  ? 'nokia'
                                  : 'global'
                            ]}
                          </span>
                          {ach.source === 'suggestion' && (
                            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border rounded-sm text-amber-400/80 border-amber-400/30">
                              {t('achievements.badgeSuggestion')}
                            </span>
                          )}
                          {ach.enabled === false && (
                            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border rounded-sm text-red-400/80 border-red-400/30">
                              {t('achievements.badgeDisabled')}
                            </span>
                          )}
                        </div>
                        <p className="text-[9px] font-mono text-ash-600 font-bold uppercase mt-1 tracking-widest mb-2">
                          ID: {ach.id}
                          {ach.campaignIds === 'global'
                            ? ' · CAMP: GLOBAL'
                            : ` · CAMP: ${ach.campaignIds.join(',')}`}
                        </p>
                        {ach.description && (
                          <p className="text-[10px] text-ash-400 font-bold leading-relaxed">
                            {ach.description}
                          </p>
                        )}
                        <p className="text-[9px] text-ash-600 mt-2 leading-relaxed">
                          {ach.unlockCondition}
                        </p>
                        <p className="text-[9px] text-ash-700 mt-1 font-mono uppercase">
                          rule: {ach.rule.type}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2 border-t border-border-subtle">
                      <button
                        type="button"
                        onClick={() => openEdit(ach)}
                        disabled={!isRemote}
                        className="flex-1 text-[9px] font-black uppercase tracking-widest py-2 border border-border text-ash-400 hover:text-bone hover:border-secondary/40 rounded-sm disabled:opacity-30"
                      >
                        {t('achievements.edit')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleEnabled(ach)}
                        disabled={!isRemote}
                        className="flex-1 text-[9px] font-black uppercase tracking-widest py-2 border border-border text-ash-400 hover:text-amber-300 rounded-sm disabled:opacity-30"
                      >
                        {ach.enabled === false
                          ? t('achievements.enable')
                          : t('achievements.disable')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(ach)}
                        disabled={!isRemote}
                        className="text-[9px] font-black uppercase tracking-widest px-3 py-2 border border-red-900/40 text-red-400/70 hover:text-red-300 rounded-sm disabled:opacity-30"
                      >
                        {t('achievements.delete')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <AchievementEditorModal
        open={editorOpen}
        initial={editorForm}
        isEdit={Boolean(editing)}
        saving={saving}
        uploadProgress={uploadProgress}
        onClose={() => !saving && setEditorOpen(false)}
        onSave={handleSave}
      />
    </section>
  );
}
