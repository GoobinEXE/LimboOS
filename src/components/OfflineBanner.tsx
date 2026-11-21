import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useOnlineStatus } from '../lib/connectivity';

const RESTORED_VISIBLE_MS = 2500;

interface OfflineBannerProps {
  /**
   * Mostra "sinal restabelecido" por 2,5 s quando a rede volta. O player desliga:
   * lá o retorno é avisado por toast (usePlayerSync).
   */
  announceRestored?: boolean;
}

/**
 * Faixa global "Sem sinal" (F2), fixa no topo e abaixo do entalhe. Não captura toques:
 * o que está por baixo continua clicável.
 */
export default function OfflineBanner({ announceRestored = true }: OfflineBannerProps) {
  const { t } = useTranslation('common');
  const online = useOnlineStatus();
  const [restored, setRestored] = useState(false);
  const wasOffline = useRef(!online);
  const announceRef = useRef(announceRestored);

  useEffect(() => {
    announceRef.current = announceRestored;
  }, [announceRestored]);

  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      setRestored(false);
      return;
    }
    if (!wasOffline.current) return;
    wasOffline.current = false;
    if (announceRef.current) setRestored(true);
  }, [online]);

  useEffect(() => {
    if (!restored) return;
    const id = window.setTimeout(() => setRestored(false), RESTORED_VISIBLE_MS);
    return () => window.clearTimeout(id);
  }, [restored]);

  const visible = !online || restored;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[10001]"
      role="status"
      aria-live="polite"
    >
      <AnimatePresence initial={false}>
        {visible && (
          <motion.div
            key="signal-strip"
            initial={{ y: '-100%' }}
            animate={{ y: 0 }}
            exit={{ y: '-100%' }}
            className="bg-surface-container-lowest/95 pt-[env(safe-area-inset-top)] shadow-hairline"
          >
            <p className="flex h-7 items-center justify-center gap-2 px-4 font-mono text-[11px] font-bold uppercase tracking-[0.18em]">
              <span
                aria-hidden="true"
                className={online ? 'lmb-led text-phosphor-400' : 'lmb-led text-accent motion-safe:animate-pulse'}
              />
              <span className={online ? 'text-phosphor-300' : 'text-tertiary'}>
                {online
                  ? t('offline.restored', { defaultValue: 'Sinal restabelecido' })
                  : t('offline.banner', { defaultValue: 'Sem sinal. Tentando reconectar' })}
              </span>
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
