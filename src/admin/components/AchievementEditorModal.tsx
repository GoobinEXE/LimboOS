import React, { useEffect, useState } from 'react';
import type { AchievementDef, AchievementRuleSpec } from '../../types/achievement';
import type { PlayerStats } from '../../types/player';
import {
  ACHIEVEMENT_CATEGORY_LABELS,
  ACHIEVEMENT_TIER_LABELS,
  PLATFORM_LABELS,
  type AchievementCategory,
  type AchievementTier,
  type PlayerPlatform,
} from '../../services/AchievementManager';
import { campaigns as CAMPAIGNS } from '../../data/campaigns';

const STAT_KEYS: (keyof PlayerStats)[] = [
  'totalListenTime',
  'screwClicks',
  'fidgetClicks',
  'ejectWithoutPlay',
  'maxVolumeTime',
  'zeroVolumeTime',
  'biosOpened',
  'win95Opened',
  'macosOpened',
  'fullTapeListens',
  'threadsReadCount',
  'archiveOpened',
  'modeSwitches',
];

const RULE_TYPES: { type: AchievementRuleSpec['type']; label: string }[] = [
  { type: 'manual', label: 'Manual (só ADM)' },
  { type: 'audioTapeCount', label: 'Contagem de fitas AUDIO' },
  { type: 'listenTime', label: 'Tempo de escuta (s)' },
  { type: 'secretTape', label: 'Intel secreto' },
  { type: 'loreKeyword', label: 'Keyword de lore' },
  { type: 'rapidScan', label: 'Scans rápidos' },
  { type: 'mechanics', label: 'Stat >= N' },
  { type: 'flag', label: 'Flag (stat >= 1)' },
  { type: 'allFlags', label: 'Todas as flags' },
];

export type AchievementEditorForm = {
  id: string;
  title: string;
  description: string;
  hint: string;
  iconUrl: string;
  category: AchievementCategory;
  tier: AchievementTier;
  platforms: PlayerPlatform[];
  campaignMode: 'global' | 'list';
  campaignIds: string[];
  isSecret: boolean;
  unlockCondition: string;
  enabled: boolean;
  ruleType: AchievementRuleSpec['type'];
  ruleCount: number;
  ruleSeconds: number;
  ruleKeyword: string;
  ruleStatKey: keyof PlayerStats;
  ruleTarget: number;
  ruleFlagKeys: (keyof PlayerStats)[];
};

export function emptyAchievementForm(): AchievementEditorForm {
  return {
    id: '',
    title: '',
    description: '',
    hint: '???',
    iconUrl: '',
    category: 'progression',
    tier: 'common',
    platforms: ['global'],
    campaignMode: 'global',
    campaignIds: [],
    isSecret: true,
    unlockCondition: '',
    enabled: true,
    ruleType: 'manual',
    ruleCount: 1,
    ruleSeconds: 60,
    ruleKeyword: '',
    ruleStatKey: 'screwClicks',
    ruleTarget: 1,
    ruleFlagKeys: ['biosOpened'],
  };
}

export function formFromDef(def: AchievementDef): AchievementEditorForm {
  const rule = def.rule;
  return {
    id: def.id,
    title: def.title,
    description: def.description,
    hint: def.hint,
    iconUrl: def.iconUrl,
    category: def.category,
    tier: def.tier,
    platforms: [...def.platforms],
    campaignMode: def.campaignIds === 'global' ? 'global' : 'list',
    campaignIds: def.campaignIds === 'global' ? [] : [...def.campaignIds],
    isSecret: def.isSecret,
    unlockCondition: def.unlockCondition,
    enabled: def.enabled !== false,
    ruleType: rule.type,
    ruleCount:
      rule.type === 'audioTapeCount' || rule.type === 'tapeCount' || rule.type === 'rapidScan'
        ? rule.count
        : 1,
    ruleSeconds: rule.type === 'listenTime' ? rule.seconds : 60,
    ruleKeyword: rule.type === 'loreKeyword' ? rule.keyword : '',
    ruleStatKey:
      rule.type === 'mechanics' || rule.type === 'flag' ? rule.statKey : 'screwClicks',
    ruleTarget: rule.type === 'mechanics' ? rule.target : 1,
    ruleFlagKeys: rule.type === 'allFlags' ? [...rule.statKeys] : ['biosOpened'],
  };
}

export function formToRule(form: AchievementEditorForm): AchievementRuleSpec {
  switch (form.ruleType) {
    case 'manual':
      return { type: 'manual' };
    case 'audioTapeCount':
      return { type: 'audioTapeCount', count: Math.max(1, form.ruleCount) };
    case 'tapeCount':
      return { type: 'tapeCount', count: Math.max(1, form.ruleCount) };
    case 'listenTime':
      return { type: 'listenTime', seconds: Math.max(1, form.ruleSeconds) };
    case 'secretTape':
      return { type: 'secretTape' };
    case 'loreKeyword':
      return { type: 'loreKeyword', keyword: form.ruleKeyword.trim() || 'keyword' };
    case 'rapidScan':
      return { type: 'rapidScan', count: Math.max(1, form.ruleCount) };
    case 'mechanics':
      return { type: 'mechanics', statKey: form.ruleStatKey, target: Math.max(1, form.ruleTarget) };
    case 'flag':
      return { type: 'flag', statKey: form.ruleStatKey };
    case 'allFlags':
      return {
        type: 'allFlags',
        statKeys: form.ruleFlagKeys.length ? form.ruleFlagKeys : ['biosOpened'],
      };
    default:
      return { type: 'manual' };
  }
}

export function formToDefInput(
  form: AchievementEditorForm,
  source: AchievementDef['source'],
): Omit<AchievementDef, 'createdAt' | 'updatedAt'> {
  const id = form.id.trim().toUpperCase().replace(/\s+/g, '-');
  return {
    id,
    title: form.title.trim(),
    description: form.description.trim(),
    hint: form.hint.trim() || '???',
    iconUrl: form.iconUrl.trim() || `/achievements/${id}.png`,
    category: form.category,
    tier: form.tier,
    platforms: form.platforms.length ? form.platforms : ['global'],
    campaignIds: form.campaignMode === 'global' ? 'global' : form.campaignIds,
    isSecret: form.isSecret,
    unlockCondition: form.unlockCondition.trim(),
    rule: formToRule(form),
    enabled: form.enabled,
    source,
  };
}

type Props = {
  open: boolean;
  initial: AchievementEditorForm;
  isEdit: boolean;
  saving: boolean;
  uploadProgress: number | null;
  onClose: () => void;
  onSave: (form: AchievementEditorForm, file: File | null) => void;
};

const fieldClass =
  'w-full bg-black/50 border border-border text-[11px] font-bold uppercase px-3 py-2.5 text-bone outline-none focus:border-secondary rounded-sm';
const labelClass = 'text-[9px] font-black uppercase tracking-widest text-ash-500 mb-1.5 block';

export default function AchievementEditorModal({
  open,
  initial,
  isEdit,
  saving,
  uploadProgress,
  onClose,
  onSave,
}: Props) {
  const [form, setForm] = useState(initial);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(initial);
      setFile(null);
      setPreview(null);
    }
  }, [open, initial]);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const iconSrc = preview || form.iconUrl || null;

  const togglePlatform = (p: PlayerPlatform) => {
    setForm((f) => {
      const has = f.platforms.includes(p);
      if (has && f.platforms.length === 1) return f;
      return {
        ...f,
        platforms: has ? f.platforms.filter((x) => x !== p) : [...f.platforms, p],
      };
    });
  };

  const toggleCampaign = (id: string) => {
    setForm((f) => ({
      ...f,
      campaignIds: f.campaignIds.includes(id)
        ? f.campaignIds.filter((c) => c !== id)
        : [...f.campaignIds, id],
    }));
  };

  const toggleFlagKey = (key: keyof PlayerStats) => {
    setForm((f) => ({
      ...f,
      ruleFlagKeys: f.ruleFlagKeys.includes(key)
        ? f.ruleFlagKeys.filter((k) => k !== key)
        : [...f.ruleFlagKeys, key],
    }));
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9000] flex items-center justify-center bg-surface-scrim p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div className="bg-seam border-2 border-border w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-card shadow-2xl flex flex-col">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-black/40">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-bone">
            {isEdit ? 'Editar conquista' : 'Nova conquista'}
          </h3>
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="text-ash-500 hover:text-bone material-symbols-outlined text-xl"
          >
            close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
          <div className="flex gap-5 items-start">
            <div className="shrink-0 space-y-2">
              <div className="w-20 h-20 rounded-lg border border-secondary/30 overflow-hidden bg-black">
                {iconSrc ? (
                  <img src={iconSrc} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-ash-700">
                    <span className="material-symbols-outlined text-3xl">military_tech</span>
                  </div>
                )}
              </div>
              <label className="block cursor-pointer text-[9px] font-black uppercase tracking-widest text-secondary border border-secondary/30 px-2 py-1.5 text-center rounded-sm hover:bg-secondary/10">
                Foto
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </label>
              {uploadProgress != null && (
                <p className="text-[9px] text-ash-500 font-mono">{Math.round(uploadProgress)}%</p>
              )}
            </div>

            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 min-w-0">
              <div>
                <label className={labelClass}>ID</label>
                <input
                  className={fieldClass}
                  value={form.id}
                  disabled={isEdit}
                  placeholder="ACH-CUSTOM"
                  onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelClass}>Título</label>
                <input
                  className={fieldClass}
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Descrição</label>
                <textarea
                  className={`${fieldClass} min-h-[64px] normal-case`}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Condição (texto UI)</label>
                <input
                  className={fieldClass}
                  value={form.unlockCondition}
                  onChange={(e) => setForm((f) => ({ ...f, unlockCondition: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelClass}>Hint</label>
                <input
                  className={fieldClass}
                  value={form.hint}
                  onChange={(e) => setForm((f) => ({ ...f, hint: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelClass}>URL do ícone</label>
                <input
                  className={fieldClass}
                  value={form.iconUrl}
                  placeholder="/achievements/ACH-X.png"
                  onChange={(e) => setForm((f) => ({ ...f, iconUrl: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className={labelClass}>Categoria</label>
              <select
                className={fieldClass}
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({ ...f, category: e.target.value as AchievementCategory }))
                }
              >
                {(Object.keys(ACHIEVEMENT_CATEGORY_LABELS) as AchievementCategory[]).map((c) => (
                  <option key={c} value={c}>
                    {ACHIEVEMENT_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Tier</label>
              <select
                className={fieldClass}
                value={form.tier}
                onChange={(e) => setForm((f) => ({ ...f, tier: e.target.value as AchievementTier }))}
              >
                {(Object.keys(ACHIEVEMENT_TIER_LABELS) as AchievementTier[]).map((t) => (
                  <option key={t} value={t}>
                    {ACHIEVEMENT_TIER_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-4 pb-1">
              <label className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-ash-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isSecret}
                  onChange={(e) => setForm((f) => ({ ...f, isSecret: e.target.checked }))}
                />
                Secreta
              </label>
              <label className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-ash-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
                />
                Ativa
              </label>
            </div>
          </div>

          <div>
            <label className={labelClass}>Plataformas</label>
            <div className="flex flex-wrap gap-2">
              {(['walkman', 'nokia', 'global'] as PlayerPlatform[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePlatform(p)}
                  className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 border rounded-sm ${
                    form.platforms.includes(p)
                      ? 'border-secondary text-secondary bg-secondary/10'
                      : 'border-border text-ash-500'
                  }`}
                >
                  {PLATFORM_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelClass}>Campanhas</label>
            <div className="flex flex-wrap gap-2 mb-2">
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, campaignMode: 'global' }))}
                className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 border rounded-sm ${
                  form.campaignMode === 'global'
                    ? 'border-secondary text-secondary bg-secondary/10'
                    : 'border-border text-ash-500'
                }`}
              >
                Global
              </button>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, campaignMode: 'list' }))}
                className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 border rounded-sm ${
                  form.campaignMode === 'list'
                    ? 'border-secondary text-secondary bg-secondary/10'
                    : 'border-border text-ash-500'
                }`}
              >
                Específicas
              </button>
            </div>
            {form.campaignMode === 'list' && (
              <div className="flex flex-wrap gap-2">
                {CAMPAIGNS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCampaign(c.id)}
                    className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 border rounded-sm ${
                      form.campaignIds.includes(c.id)
                        ? 'border-primary text-primary bg-primary/10'
                        : 'border-border text-ash-500'
                    }`}
                  >
                    {c.name || c.id}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-border-subtle pt-4 space-y-3">
            <label className={labelClass}>Regra de desbloqueio</label>
            <select
              className={fieldClass}
              value={form.ruleType}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  ruleType: e.target.value as AchievementRuleSpec['type'],
                }))
              }
            >
              {RULE_TYPES.map((r) => (
                <option key={r.type} value={r.type}>
                  {r.label}
                </option>
              ))}
            </select>

            {(form.ruleType === 'audioTapeCount' ||
              form.ruleType === 'tapeCount' ||
              form.ruleType === 'rapidScan') && (
              <div>
                <label className={labelClass}>Contagem</label>
                <input
                  type="number"
                  min={1}
                  className={fieldClass}
                  value={form.ruleCount}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, ruleCount: Number(e.target.value) || 1 }))
                  }
                />
              </div>
            )}
            {form.ruleType === 'listenTime' && (
              <div>
                <label className={labelClass}>Segundos</label>
                <input
                  type="number"
                  min={1}
                  className={fieldClass}
                  value={form.ruleSeconds}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, ruleSeconds: Number(e.target.value) || 1 }))
                  }
                />
              </div>
            )}
            {form.ruleType === 'loreKeyword' && (
              <div>
                <label className={labelClass}>Keyword</label>
                <input
                  className={fieldClass}
                  value={form.ruleKeyword}
                  onChange={(e) => setForm((f) => ({ ...f, ruleKeyword: e.target.value }))}
                />
              </div>
            )}
            {(form.ruleType === 'mechanics' || form.ruleType === 'flag') && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Stat</label>
                  <select
                    className={fieldClass}
                    value={form.ruleStatKey}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        ruleStatKey: e.target.value as keyof PlayerStats,
                      }))
                    }
                  >
                    {STAT_KEYS.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </div>
                {form.ruleType === 'mechanics' && (
                  <div>
                    <label className={labelClass}>Alvo</label>
                    <input
                      type="number"
                      min={1}
                      className={fieldClass}
                      value={form.ruleTarget}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, ruleTarget: Number(e.target.value) || 1 }))
                      }
                    />
                  </div>
                )}
              </div>
            )}
            {form.ruleType === 'allFlags' && (
              <div className="flex flex-wrap gap-2">
                {STAT_KEYS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => toggleFlagKey(k)}
                    className={`text-[9px] font-mono px-2 py-1 border rounded-sm ${
                      form.ruleFlagKeys.includes(k)
                        ? 'border-secondary text-secondary'
                        : 'border-border text-ash-600'
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border flex gap-3 bg-black/40">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="flex-1 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-ash-500 hover:text-bone bg-[#333] rounded-sm"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving || !form.id.trim() || !form.title.trim()}
            onClick={() => onSave(form, file)}
            className="flex-1 px-4 py-3 text-[10px] font-black uppercase tracking-widest bg-primary text-black rounded-sm disabled:opacity-40"
          >
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
