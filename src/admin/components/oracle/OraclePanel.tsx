import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createBlankOracleTemplate } from '../../../modules/oracle';
import { oracleService } from '../../../services/OracleService';
import type { OracleSession, OracleTemplate } from '../../../types/oracle';
import { useAdminScope } from '../../context/AdminScopeContext';
import { useAdminCampaigns } from '../../hooks/useAdminCampaigns';
import type { OracleViewId } from '../../lib/adminNavigation';
import { matchesBindingScope, type CampaignScope } from '../../lib/campaignResources';
import { useModal } from '../ConfirmModal';
import MIcon from '../MIcon';
import { useToast } from '../ToastProvider';
import OracleSessionConsole from './OracleSessionConsole';
import OracleSessionCreatorModal from './OracleSessionCreatorModal';
import OracleTemplateEditorModal from './OracleTemplateEditorModal';
import OracleTemplateList from './OracleTemplateList';

interface OraclePanelProps {
  embedded?: boolean;
  campaignScope?: CampaignScope;
  view?: OracleViewId;
  onViewChange?: (view: OracleViewId) => void;
}

export default function OraclePanel({
  embedded = false,
  campaignScope = 'all',
  view,
  onViewChange,
}: OraclePanelProps) {
  const { t } = useTranslation('admin');
  const toast = useToast();
  const { showConfirm, modal } = useModal();
  const { campaigns } = useAdminCampaigns();
  const { isCoGm } = useAdminScope();

  const [localView, setLocalView] = useState<OracleViewId>('sessoes');
  const activeView = view ?? localView;
  const setView = (next: OracleViewId) => {
    if (onViewChange) onViewChange(next);
    else setLocalView(next);
  };

  const [templates, setTemplates] = useState<OracleTemplate[]>([]);
  const [sessions, setSessions] = useState<OracleSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [creatorTemplate, setCreatorTemplate] = useState<OracleTemplate | null>(null);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<OracleTemplate | null>(null);

  useEffect(() => {
    const unsubTpl = oracleService.subscribeTemplates(setTemplates, (err) => {
      console.warn('[OraclePanel] templates listener error:', err);
    });
    const unsubSess = oracleService.subscribeSessions(setSessions, (err) => {
      console.warn('[OraclePanel] sessions listener error:', err);
    });
    return () => {
      unsubTpl();
      unsubSess();
    };
  }, []);

  const scopedTemplates = useMemo(
    () => templates.filter((tpl) => matchesBindingScope(tpl.campaignIds, campaignScope)),
    [templates, campaignScope],
  );

  const scopedSessions = useMemo(
    () =>
      sessions.filter((s) => {
        if (campaignScope === 'all') return true;
        if (campaignScope === 'global') return !s.campaignId;
        return s.campaignId === campaignScope;
      }),
    [sessions, campaignScope],
  );

  useEffect(() => {
    if (scopedSessions.length === 0) {
      setSelectedSessionId(null);
    } else if (!selectedSessionId || !scopedSessions.some((s) => s.id === selectedSessionId)) {
      setSelectedSessionId(scopedSessions[0].id);
    }
  }, [scopedSessions, selectedSessionId]);

  const activeSession = useMemo(
    () => scopedSessions.find((s) => s.id === selectedSessionId) || null,
    [scopedSessions, selectedSessionId],
  );

  const defaultScopeForNew = (): string[] | 'global' => {
    if (campaignScope !== 'all' && campaignScope !== 'global') return [campaignScope];
    if (isCoGm) return campaigns[0] ? [campaigns[0].id] : [];
    return 'global';
  };

  const openCreatorWith = (template: OracleTemplate | null) => {
    if (!template && scopedTemplates.length === 0) {
      setEditingTemplate(createBlankOracleTemplate(defaultScopeForNew()));
      setView('modelos');
      toast.info(t('oracle.sessions.needTemplateFirst'));
      return;
    }
    setCreatorTemplate(template || scopedTemplates[0] || null);
    setCreatorOpen(true);
  };

  const handleDuplicateTemplate = (source: OracleTemplate) => {
    const cloned: OracleTemplate = structuredClone(source);
    cloned.id = `oraculo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    cloned.name = `${source.name} ${t('common:copySuffix', { defaultValue: '(cópia)' })}`;
    cloned.createdAt = undefined;
    cloned.updatedAt = undefined;
    cloned.campaignIds = defaultScopeForNew();
    setEditingTemplate(cloned);
  };

  const handleDeleteTemplate = async (tpl: OracleTemplate) => {
    const ok = await showConfirm(
      t('oracle.templates.deleteTitle'),
      t('oracle.templates.deleteBody', { name: tpl.name }),
      t('oracle.templates.delete'),
    );
    if (!ok) return;
    try {
      await oracleService.deleteTemplate(tpl.id);
      toast.success(t('oracle.toast.templateDeleted'));
    } catch (err) {
      console.error('[OraclePanel] deleteTemplate failed:', err);
      toast.error(t('oracle.toast.deleteFail'));
    }
  };

  const handleImportJson = (raw: unknown) => {
    if (!raw || typeof raw !== 'object') {
      toast.error(t('oracle.templates.importInvalid'));
      return;
    }
    const candidate = raw as Partial<OracleTemplate>;
    if (!Array.isArray(candidate.sheets) || candidate.sheets.length < 2) {
      toast.error(t('oracle.templates.importInvalid'));
      return;
    }
    const base = createBlankOracleTemplate(defaultScopeForNew());
    const imported: OracleTemplate = {
      ...base,
      ...structuredClone(candidate),
      id: `oraculo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      scoringRules: {
        ...base.scoringRules,
        ...(candidate.scoringRules || {}),
      },
      copy: {
        ...base.copy,
        ...(candidate.copy || {}),
      },
      intakeFields: Array.isArray(candidate.intakeFields) ? structuredClone(candidate.intakeFields) : [],
      sheets: structuredClone(candidate.sheets),
      questions: Array.isArray(candidate.questions) ? structuredClone(candidate.questions) : [],
      syncWords: Array.isArray(candidate.syncWords) ? structuredClone(candidate.syncWords) : [],
      createdAt: undefined,
      updatedAt: undefined,
      campaignIds:
        campaignScope !== 'all' && campaignScope !== 'global'
          ? [campaignScope]
          : isCoGm
            ? (campaigns[0] ? [campaigns[0].id] : [])
            : candidate.campaignIds || 'global',
    };
    setEditingTemplate(imported);
    toast.success(t('oracle.templates.importReady'));
  };

  const defaultCampaignForSession =
    campaignScope !== 'all' && campaignScope !== 'global' ? campaignScope : null;

  return (
    <div className={embedded ? 'space-y-6' : 'space-y-8'}>
      {modal}

      {/* Barra de sub-navegação Sessões / Modelos */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 bg-surface-container-low rounded-sm p-1">
          {(['sessoes', 'modelos'] as const).map((tabId) => {
            const active = activeView === tabId;
            return (
              <button
                key={tabId}
                type="button"
                onClick={() => setView(tabId)}
                className={`h-8 px-4 rounded-inset text-[11px] font-display font-bold uppercase tracking-[0.14em] transition ${
                  active ? 'bg-accent-10 text-primary' : 'text-ash-400 hover:text-bone'
                }`}
              >
                {t(`oracle.view.${tabId}`)}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => openCreatorWith(scopedTemplates[0] || null)}
          className="lmb-btn lmb-btn-solid h-9 px-4"
        >
          <MIcon name="add" className="text-base" />
          <span>{t('oracle.sessions.new')}</span>
        </button>
      </div>

      {activeView === 'modelos' ? (
        <OracleTemplateList
          templates={scopedTemplates}
          campaigns={campaigns}
          campaignScope={campaignScope}
          onLaunchSession={(tpl) => openCreatorWith(tpl)}
          onCreateNew={(tpl) => setEditingTemplate(tpl)}
          onEdit={(tpl) => setEditingTemplate(tpl)}
          onDuplicate={handleDuplicateTemplate}
          onDelete={(tpl) => void handleDeleteTemplate(tpl)}
          onImportJson={handleImportJson}
        />
      ) : scopedSessions.length === 0 ? (
        <div className="bg-surface-container-low rounded-panel p-10 text-center space-y-4">
          <MIcon name="auto_awesome" className="text-4xl text-ash-600 mx-auto" />
          <div className="space-y-1">
            <p className="text-xs font-display font-bold uppercase tracking-wider text-bone">
              {t('oracle.sessions.emptyTitle')}
            </p>
            <p className="text-xs text-ash-400 max-w-md mx-auto leading-relaxed">
              {t('oracle.sessions.emptyBody')}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3 pt-1">
            {scopedTemplates.length > 0 ? (
              <button
                type="button"
                onClick={() => openCreatorWith(scopedTemplates[0])}
                className="lmb-btn lmb-btn-solid h-9 px-4"
              >
                <MIcon name="play_arrow" className="text-base" />
                <span>{t('oracle.sessions.new')}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setEditingTemplate(createBlankOracleTemplate(defaultScopeForNew()));
                  setView('modelos');
                }}
                className="lmb-btn lmb-btn-solid h-9 px-4"
              >
                <MIcon name="add" className="text-base" />
                <span>{t('oracle.templates.createNew')}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setView('modelos')}
              className="lmb-btn h-9 px-4"
            >
              {t('oracle.sessions.browseTemplates')}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Seletor de sessão */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {scopedSessions.map((sess) => {
              const slots = Object.values(sess.slots || {});
              const done = slots.filter((s) => s.status !== 'pending').length;
              const selected = sess.id === activeSession?.id;
              return (
                <button
                  key={sess.id}
                  type="button"
                  onClick={() => setSelectedSessionId(sess.id)}
                  className={`text-left rounded-panel p-4 transition space-y-1.5 ${
                    selected
                      ? 'bg-accent-10 shadow-hairline text-bone'
                      : 'bg-surface-container-low text-ash-300 hover:bg-surface-container'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
                    <span className="text-primary uppercase">{t(`oracle.mode.${sess.mode}`)}</span>
                    <span className={sess.resolved ? 'text-phosphor-400' : 'text-ash-500'}>
                      {done}/{slots.length}
                    </span>
                  </div>
                  <div className="font-display font-bold text-sm uppercase tracking-wide truncate">
                    {sess.title}
                  </div>
                  <div className="text-[11px] font-mono text-ash-500 truncate">
                    {sess.templateSnapshot?.rpgSystem}
                  </div>
                </button>
              );
            })}
          </div>

          {activeSession && (
            <OracleSessionConsole
              session={activeSession}
              campaigns={campaigns}
              onDeleted={() => setSelectedSessionId(null)}
            />
          )}
        </div>
      )}

      <OracleSessionCreatorModal
        open={creatorOpen}
        initialTemplate={creatorTemplate}
        templates={templates}
        campaigns={campaigns}
        defaultCampaignId={defaultCampaignForSession}
        onClose={() => setCreatorOpen(false)}
        onCreated={(id) => {
          setSelectedSessionId(id);
          setView('sessoes');
        }}
      />

      <OracleTemplateEditorModal
        open={Boolean(editingTemplate)}
        template={editingTemplate}
        campaigns={campaigns}
        onClose={() => setEditingTemplate(null)}
        onSave={async (tpl) => {
          await oracleService.saveTemplate(tpl);
          toast.success(t('oracle.toast.templateSaved'));
        }}
      />
    </div>
  );
}
