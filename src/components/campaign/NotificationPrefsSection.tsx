import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isNative } from '../../lib/native/platform';
import { pushService, type PushPermission } from '../../services/PushService';
import type { NotificationPrefs } from '../../types/player';

const CATEGORIES: (keyof NotificationPrefs)[] = ['intel', 'sms', 'achievements', 'gm', 'reminders'];

/** Canais de notificação da conta. Só existe no app nativo. */
export default function NotificationPrefsSection() {
  const { t } = useTranslation('player');
  const [prefs, setPrefs] = useState<NotificationPrefs>({});
  const [permission, setPermission] = useState<PushPermission>('unsupported');

  useEffect(() => {
    if (!isNative()) return;
    void pushService.getPermission().then(setPermission).catch(() => undefined);
    void pushService.loadPrefs().then(setPrefs).catch((err) => console.warn('[Push] prefs:', err));
  }, []);

  if (!isNative()) return null;

  const toggle = (category: keyof NotificationPrefs) => {
    const previous = prefs;
    const next = { ...prefs, [category]: prefs[category] === false };
    setPrefs(next);
    void pushService.savePrefs(next).catch((err) => {
      console.warn('[Push] salvar prefs:', err);
      setPrefs(previous);
    });
  };

  const enable = async () => {
    setPermission(await pushService.requestPermission().catch(() => 'prompt' as PushPermission));
  };

  return (
    <section className="space-y-3">
      <h3 className="text-protocol text-primary">{t('push.prefs.title')}</h3>
      {permission === 'denied' && <p className="text-[11px] text-ash-400">{t('push.prefs.denied')}</p>}
      {permission === 'prompt' && (
        <button type="button" onClick={enable} className="w-full py-3 rounded-control bg-accent text-protocol text-[10px] text-black">
          {t('push.prefs.enable')}
        </button>
      )}
      <div className="rounded-card bg-surface-raised divide-y divide-seam">
        {CATEGORIES.map((category) => {
          const enabled = prefs[category] !== false;
          return (
            <button
              key={category}
              type="button"
              role="switch"
              aria-checked={enabled}
              onClick={() => toggle(category)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
            >
              <span className="text-[11px] font-semibold text-white uppercase tracking-wide">{t(`push.prefs.${category}`)}</span>
              <span className={`text-mono-ui text-[10px] ${enabled ? 'text-primary' : 'text-ash-600'}`}>
                {enabled ? t('push.prefs.on') : t('push.prefs.off')}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
