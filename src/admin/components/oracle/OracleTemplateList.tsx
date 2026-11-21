import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { createBlankOracleTemplate } from '../../../modules/oracle';
import type { OracleTemplate } from '../../../types/oracle';
import type { Campaign } from '../../../data/campaigns';
import { bindingLabels, type CampaignScope } from '../../lib/campaignResources';
import { useAdminScope } from '../../context/AdminScopeContext';
import MIcon from '../MIcon';

interface OracleTemplateListProps {
  templates: OracleTemplate[];
  campaigns: Campaign[];
  campaignScope: CampaignScope;
  onLaunchSession: (template: OracleTemplate) => void;
  onCreateNew: (template: OracleTemplate) => void;
  onEdit: (template: OracleTemplate) => void;
  onDuplicate: (template: OracleTemplate) => void;
  onDelete: (template: OracleTemplate) => void;
  onImportJson: (raw: unknown) => void;
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function OracleTemplateList({
  templates,
  campaigns,
  campaignScope,
  onLaunchSession,
  onCreateNew,
  onEdit,
  onDuplicate,
  onDelete,
  onImportJson,
}: OracleTemplateListProps) {
  const { t } = useTranslation('admin');
  const { isCoGm } = useAdminScope();
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      onImportJson(JSON.parse(text));
    } catch {
      onImportJson(null);
    }
  };

  const defaultScopeForNew = (): string[] | 'global' => {
    if (campaignScope !== 'all' && campaignScope !== 'global') return [campaignScope];
    if (isCoGm) return campaigns[0] ? [campaigns[0].id] : [];
    return 'global';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] text-ash-400 max-w-prose">{t('oracle.templates.lead')}</p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => void handleFile(e)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="lmb-btn h-9 px-3.5"
          >
            <MIcon name="upload_file" className="text-base" />
            <span>{t('oracle.templates.importJson')}</span>
          </button>
          <button
            type="button"
            onClick={() => onCreateNew(createBlankOracleTemplate(defaultScopeForNew()))}
            className="lmb-btn lmb-btn-primary h-9 px-4"
          >
            <MIcon name="add" className="text-base" />
            <span>{t('oracle.templates.createNew')}</span>
          </button>
        </div>
      </div>

      <section className="space-y-3">
        <h3 className="text-[10px] font-display font-bold uppercase tracking-[0.14em] text-ash-400">
          {t('oracle.templates.workspaceTitle', { count: templates.length })}
        </h3>

        {templates.length === 0 ? (
          <div className="bg-surface-container-low rounded-panel p-10 text-center space-y-4">
            <p className="text-xs text-ash-400 max-w-md mx-auto leading-relaxed">
              {t('oracle.templates.empty')}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => onCreateNew(createBlankOracleTemplate(defaultScopeForNew()))}
                className="lmb-btn lmb-btn-solid h-9 px-4"
              >
                <MIcon name="add" className="text-base" />
                <span>{t('oracle.templates.createNew')}</span>
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="lmb-btn h-9 px-4"
              >
                <MIcon name="upload_file" className="text-base" />
                <span>{t('oracle.templates.importJson')}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map((tpl) => {
              const scopeLabels =
                tpl.campaignIds === 'global'
                  ? [t('scope.bindGlobal')]
                  : bindingLabels(tpl.campaignIds, campaigns);
              const pdfCount =
                tpl.sheets.filter((s) => Boolean(s.attachment) || (s.useSharedDocument && tpl.sharedDocument)).length;
              return (
                <div
                  key={tpl.id}
                  className="bg-surface-container-low rounded-panel p-5 flex flex-col justify-between gap-4 shadow-hairline"
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-mono text-accent">
                        {tpl.codePrefix}
                        {tpl.scoringRules.normalizeScores ? ' · 0–100.0000' : ' · 0.0001'}
                      </span>
                      <span className="text-[10px] font-mono text-ash-500 truncate max-w-48">
                        {scopeLabels.join(', ') || t('oracle.templates.unscoped')}
                      </span>
                    </div>
                    <h4 className="font-display font-bold text-base text-bone uppercase tracking-wide">
                      {tpl.name}
                    </h4>
                    <p className="text-[11px] font-mono text-ash-400">{tpl.rpgSystem}</p>
                    {tpl.description && (
                      <p className="text-[12px] text-ash-400 line-clamp-2">{tpl.description}</p>
                    )}
                    <div className="text-[11px] font-mono text-ash-500 pt-1">
                      {t('oracle.templates.statSummary', {
                        sheets: tpl.sheets.length,
                        questions: tpl.questions.length,
                        words: tpl.syncWords.length,
                      })}
                      {pdfCount > 0 ? ` · ${pdfCount} PDF` : ''}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border-subtle">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onEdit(tpl)}
                        className="lmb-btn h-8 px-2.5"
                        title={t('oracle.templates.edit')}
                      >
                        <MIcon name="edit" className="text-sm" />
                        <span>{t('oracle.templates.edit')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDuplicate(tpl)}
                        className="lmb-btn lmb-btn-ghost lmb-btn-icon h-8 w-8"
                        title={t('oracle.templates.duplicate')}
                        aria-label={t('oracle.templates.duplicate')}
                      >
                        <MIcon name="content_copy" className="text-base" />
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadJson(`${tpl.id}.json`, tpl)}
                        className="lmb-btn lmb-btn-ghost lmb-btn-icon h-8 w-8"
                        title={t('oracle.templates.exportJson')}
                        aria-label={t('oracle.templates.exportJson')}
                      >
                        <MIcon name="download" className="text-base" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(tpl)}
                        className="lmb-btn lmb-btn-ghost lmb-btn-icon h-8 w-8 text-red-400 hover:text-red-300"
                        title={t('oracle.templates.delete')}
                        aria-label={t('oracle.templates.delete')}
                      >
                        <MIcon name="delete" className="text-base" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => onLaunchSession(tpl)}
                      className="lmb-btn lmb-btn-primary h-8 px-3.5"
                    >
                      <MIcon name="play_arrow" className="text-sm" />
                      <span>{t('oracle.templates.launchSession')}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
