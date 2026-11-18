import { AnimatePresence, motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { useVersionUpdate } from '../lib/versionChannel';

/**
 * Aviso de nova versão do site (P02). Fica até o usuário atualizar ou fechar;
 * "Atualizar" recarrega a página. Não aparece no app nativo (canal desligado).
 */
export default function UpdateNotice() {
  const { t } = useTranslation('common');
  const { available, reload, dismiss } = useVersionUpdate();

  return (
    <AnimatePresence>
      {available && (
        <motion.div
          key="update-notice"
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          className="fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-[10001] flex items-center gap-3 rounded-inset bg-surface-panel py-2 pl-4 pr-2 shadow-panel sm:inset-x-auto sm:left-6 sm:max-w-sm"
        >
          <span aria-hidden="true" className="lmb-led text-accent" />
          <p className="min-w-0 flex-1 text-[13px] leading-snug text-bone">
            {t('update.available', { defaultValue: 'Nova versão disponível.' })}
          </p>
          <button type="button" onClick={reload} className="lmb-btn lmb-btn-primary min-h-11 shrink-0">
            {t('update.action', { defaultValue: 'Atualizar' })}
          </button>
          <button
            type="button"
            onClick={dismiss}
            aria-label={t('closeAria')}
            className="lmb-btn lmb-btn-ghost lmb-btn-icon min-h-11 w-11 shrink-0 text-ash-400"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
