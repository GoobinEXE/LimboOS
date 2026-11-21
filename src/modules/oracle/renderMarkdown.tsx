import React from 'react';

function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const tokenRe = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\))/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = tokenRe.exec(text)) !== null) {
    if (match.index > lastIdx) {
      nodes.push(text.slice(lastIdx, match.index));
    }
    const token = match[0];
    if (token.startsWith('`')) {
      nodes.push(
        <code key={key++} className="px-1.5 py-0.5 rounded-inset bg-surface-sunken font-mono text-[0.9em] text-accent">
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith('**')) {
      nodes.push(
        <strong key={key++} className="font-semibold text-bone">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith('*')) {
      nodes.push(
        <em key={key++} className="italic text-ash-200">
          {token.slice(1, -1)}
        </em>,
      );
    } else if (match[2] && match[3]) {
      nodes.push(
        <a
          key={key++}
          href={match[3]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2 hover:text-bone transition-colors"
        >
          {match[2]}
        </a>,
      );
    }
    lastIdx = match.index + token.length;
  }

  if (lastIdx < text.length) {
    nodes.push(text.slice(lastIdx));
  }
  return nodes;
}

/**
 * Renderizador seguro e leve de Markdown sem `dangerouslySetInnerHTML`.
 * Suporta cabeçalhos, parágrafos, listas, citações, blocos de código, tabelas e divisores.
 */
export function OracleMarkdownBody({ content }: { content: string }) {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let k = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    // Bloco de código cercado
    if (trimmed.startsWith('```')) {
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push(
        <pre
          key={k++}
          className="bg-surface-sunken rounded-card p-3.5 overflow-x-auto font-mono text-xs text-ash-200 shadow-pressed"
        >
          <code>{codeLines.join('\n')}</code>
        </pre>,
      );
      continue;
    }

    // Divisor horizontal
    if (/^(?:---+|\*\*\*+|___+)$/.test(trimmed)) {
      blocks.push(<hr key={k++} className="border-border-subtle my-4" />);
      i += 1;
      continue;
    }

    // Cabeçalhos
    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const cls =
        level === 1
          ? 'text-display text-lg sm:text-xl text-bone uppercase tracking-wide pt-2'
          : level === 2
            ? 'text-display text-sm sm:text-base text-bone uppercase tracking-[0.12em] pt-2 border-b border-border-subtle pb-1'
            : 'text-xs font-display font-bold text-accent uppercase tracking-[0.12em] pt-1';
      blocks.push(
        <div key={k++} className={cls}>
          {renderInline(heading[2])}
        </div>,
      );
      i += 1;
      continue;
    }

    // Citação
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i += 1;
      }
      blocks.push(
        <blockquote
          key={k++}
          className="border-l-2 border-accent pl-3.5 py-1 text-xs sm:text-sm text-ash-300 space-y-1 bg-surface-sunken/40 rounded-r-sm"
        >
          {quoteLines.map((ql, qIdx) => (
            <p key={qIdx}>{renderInline(ql)}</p>
          ))}
        </blockquote>,
      );
      continue;
    }

    // Tabela Markdown simples
    if (
      trimmed.includes('|')
      && i + 1 < lines.length
      && /^\s*\|?[\s:-]+\|[\s|:-]*$/.test(lines[i + 1])
    ) {
      const parseRow = (r: string) =>
        r
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((cell) => cell.trim());
      const headers = parseRow(trimmed);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().includes('|') && lines[i].trim().length > 0) {
        rows.push(parseRow(lines[i]));
        i += 1;
      }
      blocks.push(
        <div key={k++} className="overflow-x-auto rounded-card bg-surface-sunken shadow-pressed">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border-subtle text-ash-400 font-display uppercase tracking-wider text-[10px]">
                {headers.map((h, hi) => (
                  <th key={hi} className="px-3 py-2">
                    {renderInline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle/50 text-ash-200">
              {rows.map((r, ri) => (
                <tr key={ri}>
                  {headers.map((_, ci) => (
                    <td key={ci} className="px-3 py-2">
                      {renderInline(r[ci] || '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // Lista não ordenada
    if (/^[-*+]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].trim().replace(/^[-*+]\s+/, ''));
        i += 1;
      }
      blocks.push(
        <ul key={k++} className="list-disc pl-5 space-y-1 text-xs sm:text-sm text-ash-200 leading-relaxed">
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    // Lista ordenada
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i += 1;
      }
      blocks.push(
        <ol key={k++} className="list-decimal pl-5 space-y-1 text-xs sm:text-sm text-ash-200 leading-relaxed">
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    // Parágrafo contínuo
    const paraLines: string[] = [];
    while (
      i < lines.length
      && lines[i].trim().length > 0
      && !/^(#{1,4}\s|```|>|[-*+]\s|\d+\.\s|(?:---+|\*\*\*+|___+)$)/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i].trim());
      i += 1;
    }
    blocks.push(
      <p key={k++} className="text-xs sm:text-sm text-ash-200 leading-relaxed">
        {renderInline(paraLines.join(' '))}
      </p>,
    );
  }

  return <div className="space-y-3">{blocks}</div>;
}
