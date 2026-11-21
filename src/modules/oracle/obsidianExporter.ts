import type {
  OracleDocumentAttachment,
  OracleIntakeField,
  OracleSession,
  OracleSheet,
  OracleSlot,
  OracleTemplate,
} from '../../types/oracle';
import { formatScore4, resolveSlotDisplayName } from './markdownSheetParser';

function yamlSafe(val: string | number | boolean | null | undefined): string {
  const s = String(val ?? '').replace(/\r?\n/g, ' ').replace(/"/g, '\\"');
  return `"${s}"`;
}

function groupAbilities(abilities: OracleSheet['abilities']) {
  const map = new Map<string, OracleSheet['abilities']>();
  for (const ab of abilities) {
    const cat = ab.category || 'Geral';
    const list = map.get(cat) || [];
    list.push(ab);
    map.set(cat, list);
  }
  return Array.from(map.entries());
}

export interface SlotMarkdownInput {
  sessionTitle: string;
  rpgSystem: string;
  slotCode: string;
  slotLabel?: string | null;
  intakeData: Record<string, string> | null;
  intakeFields: OracleIntakeField[];
  sheet: OracleSheet;
  sharedDocument?: OracleDocumentAttachment | null;
  affinityScore: number;
  isUnexpectedAssignment: boolean;
  customFlavor: Record<string, string>;
  submittedAt?: string | null;
}

export function exportSlotToMarkdown(input: SlotMarkdownInput): string {
  const {
    sessionTitle,
    rpgSystem,
    slotCode,
    slotLabel,
    intakeData,
    intakeFields,
    sheet,
    sharedDocument,
    affinityScore,
    isUnexpectedAssignment,
    customFlavor,
    submittedAt,
  } = input;

  const identity = resolveSlotDisplayName(intakeData, intakeFields, slotLabel, slotCode);
  const lines: string[] = [];

  lines.push('---');
  lines.push(`tags: [rpg, limbo-os, oraculo, ${sheet.id}]`);
  lines.push(`sessao: ${yamlSafe(sessionTitle)}`);
  lines.push(`sistema: ${yamlSafe(rpgSystem)}`);
  lines.push(`codigo_vaga: ${yamlSafe(slotCode)}`);
  lines.push(`identificacao: ${yamlSafe(identity.primary)}`);
  lines.push(`ficha: ${yamlSafe(sheet.name)}`);
  if (sheet.origin) lines.push(`origem: ${yamlSafe(sheet.origin)}`);
  lines.push(`afinidade: ${formatScore4(affinityScore)}`);
  lines.push(`designacao_inesperada: ${isUnexpectedAssignment ? 'true' : 'false'}`);
  if (submittedAt) lines.push(`enviado_em: ${yamlSafe(submittedAt)}`);
  lines.push('---');
  lines.push('');
  lines.push(`# ${sheet.name}`);
  const metaParts = [sheet.origin, sheet.subtitle].filter(Boolean);
  if (metaParts.length > 0) {
    lines.push(`> ${metaParts.join(' · ')}`);
    lines.push('');
  }

  if (isUnexpectedAssignment && sheet.unexpectedNarrative) {
    lines.push('> [!warning] Designação Inesperada');
    lines.push(`> ${sheet.unexpectedNarrative}`);
    lines.push('');
  }

  if (sheet.revealNarrative) {
    lines.push('## Revelação');
    lines.push(sheet.revealNarrative);
    lines.push('');
  }

  if (sheet.summary) {
    lines.push('## Resumo');
    lines.push(sheet.summary);
    lines.push('');
  }

  if (sheet.body?.trim()) {
    lines.push(sheet.body.trim());
    lines.push('');
  }

  const effectiveAttachment = sheet.attachment || (sheet.useSharedDocument ? sharedDocument : null);
  if (effectiveAttachment) {
    const pageInfo = sheet.attachment?.pageRange || sheet.sharedPageRange;
    lines.push('## Documento Anexado');
    lines.push(
      `- [${effectiveAttachment.fileName}](${effectiveAttachment.url})${pageInfo ? ` (${pageInfo})` : ''}`,
    );
    lines.push('');
  }

  if (intakeFields.length > 0 && intakeData) {
    const filled = intakeFields.filter((f) => intakeData[f.id]?.trim());
    if (filled.length > 0) {
      lines.push('## Identificação');
      for (const field of filled) {
        lines.push(`- **${field.label}:** ${intakeData[field.id]}`);
      }
      lines.push('');
    }
  }

  const flavorEntries = (sheet.flavorFields || [])
    .map((ff) => ({ label: ff.label, value: customFlavor?.[ff.id]?.trim() || '' }))
    .filter((item) => item.value);

  if (flavorEntries.length > 0) {
    lines.push('## Personalização');
    for (const entry of flavorEntries) {
      lines.push(`- **${entry.label}:** ${entry.value}`);
    }
    lines.push('');
  }

  if (sheet.attributes?.length > 0) {
    lines.push('## Atributos');
    lines.push('| Atributo | Valor | Observação |');
    lines.push('| :--- | :---: | :--- |');
    for (const attr of sheet.attributes) {
      lines.push(`| ${attr.label} | ${attr.value} | ${attr.note || '—'} |`);
    }
    lines.push('');
  }

  if (sheet.derivedStats?.length > 0) {
    lines.push('## Estatísticas Derivadas');
    for (const st of sheet.derivedStats) {
      lines.push(`- **${st.label}:** ${st.value}`);
    }
    lines.push('');
  }

  if (sheet.traits?.length > 0) {
    lines.push('## Traços');
    for (const tr of sheet.traits) {
      lines.push(`- **${tr.name}:** ${tr.description}`);
    }
    lines.push('');
  }

  if (sheet.abilities?.length > 0) {
    lines.push(`## Habilidades (${sheet.abilities.length})`);
    for (const [category, items] of groupAbilities(sheet.abilities)) {
      lines.push(`### ${category}`);
      for (const ab of items) {
        const costTag = ab.cost ? ` _(${ab.cost})_` : '';
        lines.push(`- **${ab.name}**${costTag}: ${ab.description}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n').trimEnd() + '\n';
}

export function exportSessionToMarkdown(session: OracleSession): string {
  const template: OracleTemplate = session.templateSnapshot;
  const slots = Object.values(session.slots || {});
  const lines: string[] = [];

  lines.push('---');
  lines.push('tags: [rpg, limbo-os, oraculo, sessao-mestre]');
  lines.push(`sessao: ${yamlSafe(session.title)}`);
  lines.push(`sistema: ${yamlSafe(template.rpgSystem)}`);
  lines.push(`modo: ${yamlSafe(session.mode)}`);
  lines.push(`designada: ${session.resolved ? 'true' : 'false'}`);
  lines.push('---');
  lines.push('');
  lines.push(`# Dossiê do Oráculo — ${session.title}`);
  lines.push(`- **Sistema:** ${template.rpgSystem}`);
  lines.push(`- **Modo de Resolução:** ${session.mode}`);
  lines.push(`- **Precisão da Pontuação:** 4 casas decimais (0.0001)`);

  if (session.resolutionMetrics) {
    lines.push(
      `- **Métricas Globais:** Soma ${formatScore4(session.resolutionMetrics.totalScore)} | Mínimo ${formatScore4(session.resolutionMetrics.minScore)} | 1ªs opções ${session.resolutionMetrics.firstChoicesHit} | Acertos de palavras ${session.resolutionMetrics.totalWordHits}`,
    );
  }
  lines.push('');

  const submittedOrRevealed = slots.filter((s) => s.scores);
  if (submittedOrRevealed.length > 0) {
    lines.push('## Matriz de Afinidade');
    const sheetHeaders = template.sheets.map((s) => s.name).join(' | ');
    const sheetSep = template.sheets.map(() => ':---:').join(' | ');
    lines.push(`| Vaga | Identificação | ${sheetHeaders} | Atribuída |`);
    lines.push(`| :--- | :--- | ${sheetSep} | :--- |`);

    for (const slot of submittedOrRevealed) {
      const iden = resolveSlotDisplayName(slot.intakeData, template.intakeFields, slot.label, slot.slotCode);
      const cells = template.sheets
        .map((s) => {
          const scoreTxt = formatScore4(slot.scores?.[s.id] ?? 0);
          const pos = slot.wordPositions?.[s.id];
          return pos?.length ? `${scoreTxt} (pal. #${pos.join(',#')})` : scoreTxt;
        })
        .join(' | ');
      const assigned = template.sheets.find((s) => s.id === slot.assignedSheetId)?.name || '—';
      lines.push(
        `| ${slot.slotCode} | ${iden.primary} | ${cells} | ${assigned}${slot.isUnexpectedAssignment ? ' (Inesperada)' : ''} |`,
      );
    }
    lines.push('');
  }

  if (session.auditLog?.length) {
    lines.push('## Log Auditável');
    for (const entry of session.auditLog) {
      lines.push(`- \`${entry.at}\` — ${entry.message}`);
      if (entry.details?.contenders?.length) {
        for (const c of entry.details.contenders) {
          const sheetName = template.sheets.find((s) => s.id === c.sheetId)?.name || c.sheetId;
          const posStr = c.wordPositions?.length ? `posições #${c.wordPositions.join(', #')}` : 'sem palavras';
          lines.push(
            `  - ${c.slotCode} → ${sheetName}: nota ${formatScore4(c.score)} · ${c.wordHits} palavras (${posStr})${c.won ? ' [vencedor]' : ''}`,
          );
        }
      }
    }
    lines.push('');
  }

  const revealedSlots = slots.filter(
    (s): s is OracleSlot & { assignedSheetId: string } =>
      s.status === 'revealed' && Boolean(s.assignedSheetId),
  );

  for (const slot of revealedSlots) {
    const sheet = template.sheets.find((s) => s.id === slot.assignedSheetId);
    if (!sheet) continue;
    lines.push('---');
    lines.push('');
    lines.push(
      exportSlotToMarkdown({
        sessionTitle: session.title,
        rpgSystem: template.rpgSystem,
        slotCode: slot.slotCode,
        slotLabel: slot.label,
        intakeData: slot.intakeData,
        intakeFields: template.intakeFields,
        sheet,
        sharedDocument: template.sharedDocument,
        affinityScore: slot.affinityScore ?? 0,
        isUnexpectedAssignment: slot.isUnexpectedAssignment,
        customFlavor: slot.customFlavor,
        submittedAt: slot.submittedAt,
      }).trim(),
    );
    lines.push('');
  }

  return lines.join('\n').trimEnd() + '\n';
}

export function downloadMarkdownFile(filename: string, content: string): void {
  const safeName =
    filename
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'ficha-oraculo';
  const finalName = safeName.endsWith('.md') ? safeName : `${safeName}.md`;
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = finalName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
