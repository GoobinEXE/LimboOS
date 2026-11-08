import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Radio } from 'lucide-react';
import { pushService } from '../../services/PushService';

/** Explica o canal antes do pedido do sistema, que o iOS só mostra uma vez. */
export default function PushPermissionPrompt() {
  const { t } = useTranslation('player');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void pushService.getPermission().then((permission) => {
      if (!cancelled && permission === 'prompt' && pushService.shouldAsk()) setVisible(true);
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (!visible) return null;

  const accept = async () => {
    setBusy(true);
    await pushService.requestPermission().catch((err) => console.warn('[Push] permissão:', err));
    setVisible(false);
  };

  const later = () => {
    pushService.askLater();
    setVisible(false);
  };

  return (
    <div className="fixed inset-0 z-[9000] flex items-end sm:items-center justify-center bg-black/70 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div role="dialog" aria-modal="true" aria-labelledby="push-prompt-title" className="w-full max-w-sm rounded-card border border-border-accent bg-surface-raised p-5 space-y-4">
        <div className="flex items-center gap-3 text-primary">
          <Radio size={20} />
          <h2 id="push-prompt-title" className="text-protocol text-primary">{t('push.prompt.title')}</h2>
        </div>
        <p className="text-sm text-ash-300 leading-relaxed">{t('push.prompt.body')}</p>
        <div className="flex gap-2">
          <button type="button" onClick={later} disabled={busy} className="flex-1 py-3 rounded-control border border-border text-protocol text-[10px] text-ash-400">
            {t('push.prompt.later')}
          </button>
          <button type="button" onClick={accept} disabled={busy} className="flex-1 py-3 rounded-control bg-accent text-protocol text-[10px] text-black disabled:opacity-50">
            {t('push.prompt.accept')}
          </button>
        </div>
      </div>
    </div>
  );
}
