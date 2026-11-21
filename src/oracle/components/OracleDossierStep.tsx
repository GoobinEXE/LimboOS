import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Save,
  Search,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import { panelEnter } from '../../lib/motion';
import {
  OracleMarkdownBody,
  downloadMarkdownFile,
  exportSlotToMarkdown,
  resolveSlotDisplayName,
} from '../../modules/oracle';
import { oracleService } from '../../services/OracleService';
import type { OracleAbility, PublicOracleSlotResponse } from '../../types/oracle';
import RetroSpinner from '../../components/player/RetroSpinner';

interface OracleDossierStepProps {
  slot: PublicOracleSlotResponse;
  onFlavorSaved: (customFlavor: Record<string, string>) => void;
  onSwitchCode: () => void;
}

export default function OracleDossierStep({
  slot,
  onFlavorSaved,
  onSwitchCode,
}: OracleDossierStepProps) {
  const { t } = useTranslation('common');
  const sheet = slot.sheet;
  const [flavor, setFlavor] = useState<Record<string, string>>(() => ({
    ...(slot.customFlavor || {}),
  }));
  const [savingFlavor, setSavingFlavor] = useState(false);
  const [flavorSavedOk, setFlavorSavedOk] = useState(false);
  const [flavorError, setFlavorError] = useState<string | null>(null);
  const [copiedMd, setCopiedMd] = useState(false);
  const [powerQuery, setPowerQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [showPdfPreview, setShowPdfPreview] = useState(false);

  const abilities = sheet?.abilities || [];
  const categories = useMemo(
    () => Array.from(new Set(abilities.map((a) => a.category || 'Geral'))),
    [abilities],
  );

  const groupedAbilities = useMemo(() => {
    const q = powerQuery.trim().toLowerCase();
    const filtered = abilities.filter((ab) => {
      const catOk = activeCategory === 'all' || (ab.category || 'Geral') === activeCategory;
      const qOk =
        !q
        || ab.name.toLowerCase().includes(q)
        || ab.description.toLowerCase().includes(q)
        || ab.category.toLowerCase().includes(q);
      return catOk && qOk;
    });
    const byCat = new Map<string, OracleAbility[]>();
    for (const ab of filtered) {
      const cat = ab.category || 'Geral';
      const list = byCat.get(cat) || [];
      list.push(ab);
      byCat.set(cat, list);
    }
    return Array.from(byCat.entries());
  }, [abilities, powerQuery, activeCategory]);

  if (!sheet) return null;

  const effectiveDoc = sheet.attachment || (sheet.useSharedDocument ? slot.sharedDocument || null : null);
  const effectivePageRange = sheet.attachment?.pageRange || sheet.sharedPageRange || '';
  const isPdfDoc = Boolean(
    effectiveDoc
    && (effectiveDoc.mimeType === 'application/pdf' || effectiveDoc.fileName.toLowerCase().endsWith('.pdf')),
  );

  const identity = resolveSlotDisplayName(
    slot.intakeData,
    slot.intakeFields,
    slot.slotLabel,
    slot.slotCode || 'ficha',
  );

  const buildMarkdown = () =>
    exportSlotToMarkdown({
      sessionTitle: slot.sessionTitle || '',
      rpgSystem: slot.rpgSystem || '',
      slotCode: slot.slotCode || '',
      slotLabel: slot.slotLabel,
      intakeData: slot.intakeData || null,
      intakeFields: slot.intakeFields || [],
      sheet,
      sharedDocument: slot.sharedDocument,
      affinityScore: slot.affinityScore ?? 0,
      isUnexpectedAssignment: Boolean(slot.isUnexpectedAssignment),
      customFlavor: flavor,
      submittedAt: slot.submittedAt,
    });

  const handleDownloadMd = () => {
    downloadMarkdownFile(`${identity.primary}-${sheet.id}.md`, buildMarkdown());
  };

  const handleCopyMd = async () => {
    try {
      await navigator.clipboard.writeText(buildMarkdown());
      setCopiedMd(true);
      window.setTimeout(() => setCopiedMd(false), 2000);
    } catch {
      /* fallback: download continua disponível */
    }
  };

  const handleSaveFlavor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slot.slotCode || savingFlavor) return;
    setSavingFlavor(true);
    setFlavorError(null);
    setFlavorSavedOk(false);
    try {
      const res = await oracleService.saveFlavor(slot.slotCode, flavor);
      setFlavor(res.customFlavor);
      onFlavorSaved(res.customFlavor);
      setFlavorSavedOk(true);
      window.setTimeout(() => setFlavorSavedOk(false), 2500);
    } catch (err) {
      console.error('[OracleDossier] saveFlavor failed:', err);
      setFlavorError(t('oracle.dossier.flavorSaveFail'));
    } finally {
      setSavingFlavor(false);
    }
  };

  const filledIntakeFields = (slot.intakeFields || []).filter((f) => slot.intakeData?.[f.id]?.trim());
  const hasFlavorFields = (sheet.flavorFields || []).length > 0;

  return (
    <motion.div
      variants={panelEnter}
      initial="hidden"
      animate="visible"
      className="w-full max-w-4xl space-y-6 pb-8"
    >
      {/* Cabeçalho da ficha */}
      <header className="bg-surface-raised rounded-panel shadow-panel p-6 sm:p-8 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: sheet.themeColor || '#FF8C00' }}
              aria-hidden
            />
            <span className="font-mono text-xs text-ash-300">{slot.slotCode}</span>
            {sheet.origin && (
              <span className="px-2.5 py-0.5 rounded-inset bg-accent-10 text-primary text-[11px] font-display font-bold uppercase tracking-wider">
                {sheet.origin}
              </span>
            )}
            {slot.isUnexpectedAssignment && (
              <span className="px-2.5 py-0.5 rounded-inset bg-amber-500/15 text-amber-300 text-[11px] font-display font-bold uppercase tracking-wider inline-flex items-center gap-1">
                <Sparkles size={12} />
                {slot.copy?.unexpectedBadge || t('oracle.dossier.unexpectedBadge')}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={handleCopyMd} className="lmb-btn h-9 px-3 text-xs">
              {copiedMd ? <Check size={14} className="text-phosphor-400" /> : <Copy size={14} />}
              <span>{copiedMd ? t('oracle.dossier.copied') : t('oracle.dossier.copyMd')}</span>
            </button>
            <button type="button" onClick={handleDownloadMd} className="lmb-btn lmb-btn-primary h-9 px-3.5 text-xs">
              <Download size={14} />
              <span>{t('oracle.dossier.exportMd')}</span>
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-display text-2xl sm:text-4xl text-bone uppercase">
            {sheet.name}
          </h1>
          {(sheet.subtitle || slot.rpgSystem) && (
            <p className="text-xs font-mono text-ash-400">
              {[sheet.subtitle, slot.rpgSystem].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>

        {slot.isUnexpectedAssignment && sheet.unexpectedNarrative && (
          <div className="bg-amber-500/10 rounded-card p-4 flex items-start gap-3">
            <TriangleAlert size={18} className="text-amber-300 shrink-0 mt-0.5" />
            <p className="text-xs sm:text-sm text-ash-200 leading-relaxed">
              {sheet.unexpectedNarrative}
            </p>
          </div>
        )}

        {sheet.revealNarrative && (
          <p className="text-sm text-ash-200 leading-relaxed">{sheet.revealNarrative}</p>
        )}

        {sheet.summary && (
          <p className="text-xs sm:text-sm text-ash-400 leading-relaxed border-t border-border-subtle pt-4">
            {sheet.summary}
          </p>
        )}
      </header>

      {/* Documento PDF / arquivo anexado (se existir) */}
      {effectiveDoc && (
        <section className="bg-surface-raised rounded-panel shadow-panel p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <FileText size={20} className="text-accent shrink-0" />
              <div className="min-w-0">
                <h2 className="text-display text-sm text-bone uppercase tracking-[0.12em] truncate">
                  {effectiveDoc.fileName}
                </h2>
                {effectivePageRange && (
                  <p className="text-xs font-mono text-accent mt-0.5">{effectivePageRange}</p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isPdfDoc && (
                <button
                  type="button"
                  onClick={() => setShowPdfPreview((prev) => !prev)}
                  className="lmb-btn h-9 px-3 text-xs"
                >
                  {showPdfPreview ? <EyeOff size={14} /> : <Eye size={14} />}
                  <span>
                    {showPdfPreview ? t('oracle.dossier.hidePdf') : t('oracle.dossier.previewPdf')}
                  </span>
                </button>
              )}
              <a
                href={effectiveDoc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="lmb-btn lmb-btn-primary h-9 px-3.5 text-xs"
              >
                <ExternalLink size={14} />
                <span>{t('oracle.dossier.openDoc')}</span>
              </a>
            </div>
          </div>

          {isPdfDoc && showPdfPreview && (
            <div className="rounded-card overflow-hidden bg-surface-sunken shadow-pressed">
              <iframe
                src={effectiveDoc.url}
                title={effectiveDoc.fileName}
                className="w-full h-[65vh] border-0"
              />
            </div>
          )}
        </section>
      )}

      {/* Corpo livre em Markdown ou texto simples (se existir) */}
      {sheet.body?.trim() && (
        <section className="bg-surface-raised rounded-panel shadow-panel p-5 sm:p-8 space-y-4">
          <h2 className="text-display text-sm text-bone uppercase tracking-[0.14em]">
            {slot.copy?.dossierPhaseTitle || t('oracle.dossier.sheetContent')}
          </h2>
          {sheet.contentFormat === 'plain' ? (
            <pre className="whitespace-pre-wrap font-sans text-xs sm:text-sm text-ash-200 leading-relaxed">
              {sheet.body}
            </pre>
          ) : (
            <OracleMarkdownBody content={sheet.body} />
          )}
        </section>
      )}

      {/* Atributos + Estatísticas Derivadas (opcionais) */}
      {(sheet.attributes.length > 0 || sheet.derivedStats.length > 0) && (
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {sheet.attributes.length > 0 && (
            <div className="lg:col-span-2 bg-surface-raised rounded-panel shadow-panel p-5 sm:p-6 space-y-4">
              <h2 className="text-display text-sm text-bone uppercase tracking-[0.14em]">
                {t('oracle.dossier.attributes')}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {sheet.attributes.map((attr) => (
                  <div key={attr.id} className="bg-surface-sunken rounded-card p-3.5 shadow-pressed space-y-1">
                    <div className="text-[10px] font-display font-bold uppercase tracking-wider text-ash-400">
                      {attr.label}
                    </div>
                    <div className="font-mono text-2xl font-bold text-bone">{attr.value}</div>
                    {attr.note && <div className="text-[11px] text-ash-500 leading-snug">{attr.note}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {sheet.derivedStats.length > 0 && (
            <div className="bg-surface-raised rounded-panel shadow-panel p-5 sm:p-6 space-y-4">
              <h2 className="text-display text-sm text-bone uppercase tracking-[0.14em]">
                {t('oracle.dossier.derivedStats')}
              </h2>
              <dl className="divide-y divide-border-subtle">
                {sheet.derivedStats.map((st) => (
                  <div key={st.id} className="py-2.5 flex items-baseline justify-between gap-3 text-xs">
                    <dt className="text-ash-400 uppercase font-display font-bold tracking-wider">
                      {st.label}
                    </dt>
                    <dd className="font-mono text-bone text-right">{st.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </section>
      )}

      {/* Traços + Identificação (opcionais) */}
      {(sheet.traits.length > 0 || filledIntakeFields.length > 0) && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {sheet.traits.length > 0 && (
            <div className="bg-surface-raised rounded-panel shadow-panel p-5 sm:p-6 space-y-4">
              <h2 className="text-display text-sm text-bone uppercase tracking-[0.14em]">
                {t('oracle.dossier.traits')}
              </h2>
              <ul className="divide-y divide-border-subtle">
                {sheet.traits.map((tr, i) => (
                  <li key={`${tr.name}-${i}`} className="py-3 first:pt-0 last:pb-0 space-y-1">
                    <div className="text-xs font-display font-bold uppercase tracking-wider text-primary">
                      {tr.name}
                    </div>
                    <p className="text-xs text-ash-300 leading-relaxed">{tr.description}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {filledIntakeFields.length > 0 && (
            <div className="bg-surface-raised rounded-panel shadow-panel p-5 sm:p-6 space-y-4">
              <h2 className="text-display text-sm text-bone uppercase tracking-[0.14em]">
                {t('oracle.dossier.intakeSummary')}
              </h2>
              <dl className="divide-y divide-border-subtle">
                {filledIntakeFields.map((field) => (
                  <div key={field.id} className="py-2.5 first:pt-0 last:pb-0 space-y-0.5">
                    <dt className="text-[10px] font-display font-bold uppercase tracking-wider text-ash-500">
                      {field.label}
                    </dt>
                    <dd className="text-xs text-ash-200 whitespace-pre-wrap leading-relaxed">
                      {slot.intakeData?.[field.id]}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </section>
      )}

      {/* Campos de personalização definidos no modelo (só renderiza se houver flavorFields) */}
      {hasFlavorFields && (
        <section className="bg-surface-raised rounded-panel shadow-panel p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-display text-sm text-bone uppercase tracking-[0.14em]">
              {t('oracle.dossier.flavorTitle')}
            </h2>
            {flavorSavedOk && (
              <span className="text-xs text-phosphor-400 inline-flex items-center gap-1">
                <Check size={14} />
                {t('oracle.dossier.flavorSaved')}
              </span>
            )}
          </div>

          <form onSubmit={handleSaveFlavor} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {sheet.flavorFields.map((ff) => (
                <label key={ff.id} className="block space-y-1.5">
                  <span className="lmb-eyebrow block">{ff.label}</span>
                  <input
                    type="text"
                    value={flavor[ff.id] || ''}
                    onChange={(e) => setFlavor({ ...flavor, [ff.id]: e.target.value })}
                    placeholder={ff.placeholder}
                    maxLength={500}
                    className="lmb-field w-full px-3.5 py-2.5 text-sm"
                  />
                  {ff.hint && <span className="block text-[11px] text-ash-500">{ff.hint}</span>}
                </label>
              ))}
            </div>

            {flavorError && (
              <p role="alert" className="text-xs text-error">
                {flavorError}
              </p>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingFlavor}
                className="lmb-btn lmb-btn-primary h-9 px-5 text-xs uppercase tracking-wider"
              >
                {savingFlavor ? <RetroSpinner size="sm" /> : <Save size={14} />}
                <span>{t('oracle.dossier.saveFlavor')}</span>
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Habilidades (opcional) */}
      {abilities.length > 0 && (
        <section className="bg-surface-raised rounded-panel shadow-panel p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-display text-sm text-bone uppercase tracking-[0.14em]">
              {t('oracle.dossier.abilities', { count: abilities.length })}
            </h2>
            <div className="relative w-full sm:w-64">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-ash-500 pointer-events-none"
              />
              <input
                type="search"
                value={powerQuery}
                onChange={(e) => setPowerQuery(e.target.value)}
                placeholder={t('oracle.dossier.searchAbilities')}
                className="lmb-field w-full pl-9 pr-3 py-2 text-xs"
              />
            </div>
          </div>

          {categories.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setActiveCategory('all')}
                className={`h-7 px-3 rounded-inset text-[11px] font-display font-bold uppercase tracking-wider transition ${
                  activeCategory === 'all' ? 'bg-accent-10 text-primary' : 'bg-surface-sunken text-ash-400 hover:text-bone'
                }`}
              >
                {t('oracle.dossier.allCategories')}
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`h-7 px-3 rounded-inset text-[11px] font-display font-bold uppercase tracking-wider transition ${
                    activeCategory === cat ? 'bg-accent-10 text-primary' : 'bg-surface-sunken text-ash-400 hover:text-bone'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {groupedAbilities.length === 0 ? (
            <p className="text-xs text-ash-500 py-4">{t('oracle.dossier.noAbilityMatch')}</p>
          ) : (
            <div className="space-y-6">
              {groupedAbilities.map(([category, list]) => (
                <div key={category} className="space-y-2.5">
                  <h3 className="text-[11px] font-display font-bold uppercase tracking-[0.14em] text-accent border-b border-border-subtle pb-1.5">
                    {category} ({list.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {list.map((ab) => (
                      <div key={ab.id} className="bg-surface-sunken rounded-card p-3.5 shadow-pressed space-y-1.5">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-xs font-display font-bold text-bone uppercase tracking-wide">
                            {ab.name}
                          </span>
                          {ab.cost && (
                            <span className="text-[10px] font-mono text-ash-400 shrink-0">{ab.cost}</span>
                          )}
                        </div>
                        <p className="text-xs text-ash-300 leading-relaxed">{ab.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Rodapé com ação de trocar código */}
      <div className="flex justify-start">
        <button
          type="button"
          onClick={onSwitchCode}
          className="lmb-btn h-9 px-4 text-xs uppercase tracking-wider"
        >
          {t('oracle.dossier.otherCode')}
        </button>
      </div>
    </motion.div>
  );
}
