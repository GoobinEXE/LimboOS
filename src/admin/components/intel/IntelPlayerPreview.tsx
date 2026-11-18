import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import EvidenceReader from '../../../components/EvidenceReader';
import { IntelFactory } from '../../../services/IntelEngine';
import type { IntelItem } from '../../../types/intel';
import type { NpcContact } from '../../../types/npcSms';
import MIcon from '../MIcon';

interface PreviewShellProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Ao lado do modal em telas largas (xl); em telas menores cobre a tela inteira.
 * O pai precisa ser `relative` para o painel ancorar à direita do modal.
 */
function PreviewShell({ title, onClose, children }: PreviewShellProps) {
  const { t } = useTranslation('admin');
  return (
    <aside
      aria-label={title}
      className="fixed inset-4 z-[110] flex flex-col rounded-sm bg-surface-container-low shadow-panel xl:absolute xl:inset-auto xl:left-full xl:top-0 xl:ml-3 xl:h-full xl:w-[min(420px,calc((100vw-42rem)/2-1.5rem))]"
    >
      <div className="flex items-center justify-between gap-2 px-4 py-3 bg-black/40 shrink-0">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-primary truncate">{title}</span>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 text-ash-500 hover:text-bone rounded-sm"
          aria-label={t('intel.editor.previewClose', { defaultValue: 'Fechar prévia' })}
        >
          <MIcon name="close" />
        </button>
      </div>
      <div className="relative flex-1 min-h-0 overflow-hidden">{children}</div>
    </aside>
  );
}

interface IntelPlayerPreviewProps {
  /** Rascunho do formulário (não o item salvo). Nada é gravado. */
  draft: IntelItem;
  onClose: () => void;
}

/** Prévia lateral do rascunho de intel como o jogador lê (texto, imagem e meta). */
export default function IntelPlayerPreview({ draft, onClose }: IntelPlayerPreviewProps) {
  const { t } = useTranslation('admin');
  const title = t('intel.editor.previewAsPlayer', { defaultValue: 'Ver como jogador' });
  const supported = draft.type === 'TEXT' || draft.type === 'VISUAL' || draft.type === 'META';

  const evidence = useMemo(() => {
    if (!supported) return null;
    try {
      return IntelFactory.getInstance().create({
        ...draft,
        id: draft.id || 'preview',
        title: draft.title || '—',
      });
    } catch {
      return null;
    }
  }, [draft, supported]);

  return (
    <PreviewShell title={title} onClose={onClose}>
      {evidence ? (
        <EvidenceReader evidence={evidence} onClose={onClose} />
      ) : (
        <p className="p-6 text-[11px] font-display text-ash-400">
          {t('intel.editor.previewUnavailable', {
            defaultValue: 'A prévia cobre texto, imagem e meta. Áudio e vídeo não têm prévia aqui.',
          })}
        </p>
      )}
    </PreviewShell>
  );
}

/** Cartão estático do contato como aparece na lista de SMS do jogador. */
export function NpcContactPreview({ contact, onClose }: { contact: NpcContact; onClose: () => void }) {
  const { t } = useTranslation('admin');
  return (
    <PreviewShell title={t('intel.editor.previewAsPlayer', { defaultValue: 'Ver como jogador' })} onClose={onClose}>
      <div className="p-6">
        <div className="flex items-center gap-3 rounded-sm bg-[#07110a] p-4 text-crt font-mono">
          {contact.avatarUrl ? (
            <img src={contact.avatarUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
          ) : (
            <MIcon name="person" className="text-4xl" />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-bold uppercase">{contact.name || '—'}</p>
            <p className="truncate text-xs opacity-70">{contact.number}</p>
          </div>
        </div>
      </div>
    </PreviewShell>
  );
}
