import type { OracleIntakeField, OracleSheet, SheetContentFormat } from '../../types/oracle';

export type DocumentSplitMode = 'auto' | 'hr' | 'heading';

const PALETTE = ['#FF8C00', '#38BDF8', '#A78BFA', '#34D399', '#F472B6', '#FBBF24', '#F87171', '#2DD4BF'];

export function formatScore4(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '0.0000';
  return n.toFixed(4);
}

export function slugifyOracleId(raw: string, fallback: string): string {
  const s = raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return s || fallback;
}

/**
 * Resolve o nome principal (e subtítulo opcional) de uma vaga a partir de quaisquer
 * `intakeFields` configurados no modelo — sem depender de chaves literais fixas.
 */
export function resolveSlotDisplayName(
  intakeData: Record<string, string> | null | undefined,
  intakeFields: readonly OracleIntakeField[] | undefined,
  slotLabel: string | null | undefined,
  slotCode: string,
): { primary: string; secondary: string | null } {
  const data = intakeData || {};
  const filledValues: string[] = [];

  if (Array.isArray(intakeFields) && intakeFields.length > 0) {
    for (const field of intakeFields) {
      if (field.type === 'textarea') continue;
      const val = (data[field.id] || '').trim();
      if (val) filledValues.push(val);
    }
    if (filledValues.length === 0) {
      for (const field of intakeFields) {
        const val = (data[field.id] || '').trim();
        if (val) {
          filledValues.push(val.slice(0, 60));
          break;
        }
      }
    }
  }

  if (filledValues.length === 0) {
    for (const val of Object.values(data)) {
      const trimmed = (val || '').trim();
      if (trimmed) filledValues.push(trimmed.slice(0, 80));
    }
  }

  const primary = filledValues[0] || (slotLabel || '').trim() || slotCode;
  const secondary = filledValues.length > 1 ? filledValues[1] : null;
  return { primary, secondary };
}

function splitByHorizontalRule(text: string): string[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: string[] = [];
  let current: string[] = [];
  let inFence = false;

  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      current.push(line);
      continue;
    }
    if (!inFence && /^\s*(?:---+|\*\*\*+|___+)\s*$/.test(line)) {
      const joined = current.join('\n').trim();
      if (joined) blocks.push(joined);
      current = [];
    } else {
      current.push(line);
    }
  }
  const tail = current.join('\n').trim();
  if (tail) blocks.push(tail);
  return blocks;
}

function splitByHeadingLevel(text: string, level: 1 | 2): string[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const headingRe = level === 1 ? /^#\s+(.+)$/ : /^##\s+(.+)$/;
  const blocks: string[] = [];
  let current: string[] = [];
  let inFence = false;

  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      current.push(line);
      continue;
    }
    if (!inFence && headingRe.test(line)) {
      const joined = current.join('\n').trim();
      if (joined) blocks.push(joined);
      current = [line];
    } else {
      current.push(line);
    }
  }
  const tail = current.join('\n').trim();
  if (tail) blocks.push(tail);
  return blocks;
}

/**
 * Quebra um único documento Markdown ou texto simples em várias fichas (`OracleSheet[]`).
 * Cada bloco gera uma ficha com título extraído do cabeçalho/primeira linha e corpo preservado.
 */
export function parseSheetsFromSingleDocument(
  rawText: string,
  mode: DocumentSplitMode = 'auto',
  format: SheetContentFormat = 'markdown',
  existingIds: readonly string[] = [],
): OracleSheet[] {
  const cleaned = rawText.replace(/\r\n/g, '\n').trim();
  if (!cleaned) return [];

  let sections: string[] = [];
  if (mode === 'hr') {
    sections = splitByHorizontalRule(cleaned);
  } else if (mode === 'heading') {
    const byH1 = splitByHeadingLevel(cleaned, 1);
    sections = byH1.length >= 2 ? byH1 : splitByHeadingLevel(cleaned, 2);
  } else {
    const byHr = splitByHorizontalRule(cleaned);
    if (byHr.length >= 2) {
      sections = byHr;
    } else {
      const byH1 = splitByHeadingLevel(cleaned, 1);
      if (byH1.length >= 2) {
        sections = byH1;
      } else {
        const byH2 = splitByHeadingLevel(cleaned, 2);
        sections = byH2.length >= 2 ? byH2 : [cleaned];
      }
    }
  }

  const usedIds = new Set(existingIds);
  return sections.slice(0, 64).map((section, idx) => {
    const lines = section.split('\n');
    const firstNonEmptyIdx = lines.findIndex((l) => l.trim().length > 0);
    const firstLine = firstNonEmptyIdx >= 0 ? lines[firstNonEmptyIdx].trim() : `Ficha ${idx + 1}`;
    const headingMatch = firstLine.match(/^#{1,3}\s+(.+)$/);
    const rawName = (headingMatch ? headingMatch[1] : firstLine)
      .replace(/\*\*/g, '')
      .trim()
      .slice(0, 120);
    const name = rawName || `Ficha ${idx + 1}`;

    // Remove apenas o título de nível 1/2 já usado no cabeçalho da ficha para evitar repetição
    const bodyLines = headingMatch
      ? lines.filter((_, i) => i !== firstNonEmptyIdx)
      : lines;
    const body = bodyLines.join('\n').trim();

    const baseId = slugifyOracleId(name, `ficha_${idx + 1}`);
    let id = baseId;
    let suffix = 2;
    while (usedIds.has(id)) {
      id = `${baseId}_${suffix}`;
      suffix += 1;
    }
    usedIds.add(id);

    return {
      id,
      name,
      origin: '',
      subtitle: '',
      summary: '',
      revealNarrative: '',
      unexpectedNarrative: '',
      themeColor: PALETTE[idx % PALETTE.length],
      contentFormat: format,
      body,
      attachment: null,
      useSharedDocument: false,
      sharedPageRange: '',
      attributes: [],
      derivedStats: [],
      traits: [],
      abilities: [],
      flavorFields: [],
    };
  });
}
