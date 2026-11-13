import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import DeliverShell from './DeliverShell';
import { useToast } from './ToastProvider';
import { useAdminScope } from '../context/AdminScopeContext';
import {
  cancelScheduledPush,
  listPushActivity,
  schedulePush,
  sendPush,
  type PushLogEntry,
  type PushTarget,
  type ScheduledPushEntry,
} from '../lib/pushAdmin';

const TITLE_MAX = 65;
const BODY_MAX = 240;

type TargetMode = 'selected' | 'group' | 'mission' | 'all';

interface PushDeliverDrawerProps {
  targets: { uid: string; characterId: string; label: string }[];
  missionId?: string | null;
  groupId?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

const fieldClass = 'w-full bg-black/40 px-3 py-2 text-sm text-bone font-mono outline-none focus:bg-accent-10';
const labelClass = 'block text-[10px] font-display font-bold uppercase tracking-wider text-ash-500 mb-1';

/** Mensagem do mestre para os aparelhos dos jogadores, na hora ou agendada. */
export default function PushDeliverDrawer({ targets, missionId, groupId, onClose, onSuccess }: PushDeliverDrawerProps) {
  const { t } = useTranslation('admin');
  const toast = useToast();
  const { scope: { wsId }, isOwner } = useAdminScope();
  const [mode, setMode] = useState<TargetMode>('selected');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sendAt, setSendAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<PushLogEntry[]>([]);
  const [scheduled, setScheduled] = useState<ScheduledPushEntry[]>([]);

  const refresh = useCallback(async () => {
    try {
      const activity = await listPushActivity(wsId);
      setLog(activity.log);
      setScheduled(activity.scheduled.filter((item) => item.status === 'pending'));
    } catch (err) {
      console.warn('[Push] histórico:', err);
    }
  }, [wsId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const buildTarget = (): PushTarget | null => {
    if (mode === 'all') return { kind: 'all' };
    if (mode === 'group') return groupId ? { kind: 'group', groupId } : null;
    if (mode === 'mission') return missionId ? { kind: 'campaign', campaignId: missionId } : null;
    return { kind: 'characters', items: targets.map(({ uid, characterId }) => ({ uid, characterId })) };
  };

  const submit = async () => {
    const target = buildTarget();
    if (!target || !title.trim() || !body.trim()) return;
    setLoading(true);
    try {
      if (sendAt) {
        await schedulePush({ wsId, target, title, body, sendAt: new Date(sendAt).toISOString() });
        toast.success(t('push.toast.scheduled'));
      } else {
        const result = await sendPush({ wsId, target, title, body });
        toast.success(t('push.toast.sent', { sent: result.sent, n: result.recipients }));
      }
      onSuccess();
    } catch (err) {
      console.error('[Push] envio:', err);
      toast.error(t('push.toast.fail'));
      setLoading(false);
    }
  };

  const cancel = async (id: string) => {
    try {
      await cancelScheduledPush(wsId, id);
      await refresh();
    } catch (err) {
      console.error('[Push] cancelar:', err);
      toast.error(t('push.toast.fail'));
    }
  };

  const modes: { id: TargetMode; label: string; enabled: boolean }[] = [
    { id: 'selected', label: t('push.target.selected', { n: targets.length }), enabled: targets.length > 0 },
    { id: 'group', label: t('push.target.group'), enabled: Boolean(groupId) },
    { id: 'mission', label: t('push.target.mission'), enabled: Boolean(missionId) },
    { id: 'all', label: t('push.target.all'), enabled: isOwner },
  ];

  return (
    <DeliverShell title={t('deliver.kind.push')} targets={targets} onClose={loading ? undefined : onClose}>
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <div>
          <span className={labelClass}>{t('push.target.label')}</span>
          <div className="grid grid-cols-2 gap-2">
            {modes.filter((m) => m.enabled).map((m) => (
              <button
                key={m.id}
                type="button"
                aria-pressed={mode === m.id}
                onClick={() => setMode(m.id)}
                className={`px-3 py-2 text-[10px] font-display font-bold uppercase tracking-wider ${
                  mode === m.id ? 'text-primary bg-primary/10' : 'text-ash-500'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className={labelClass}>{t('push.field.title')}</span>
          <input className={fieldClass} value={title} maxLength={TITLE_MAX} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="block">
          <span className={labelClass}>{t('push.field.body')}</span>
          <textarea className={`${fieldClass} h-24 resize-none`} value={body} maxLength={BODY_MAX} onChange={(e) => setBody(e.target.value)} />
        </label>
        <label className="block">
          <span className={labelClass}>{t('push.field.sendAt')}</span>
          <input type="datetime-local" className={fieldClass} value={sendAt} onChange={(e) => setSendAt(e.target.value)} />
        </label>

        {scheduled.length > 0 && (
          <div>
            <span className={labelClass}>{t('push.pending')}</span>
            <ul className="space-y-1">
              {scheduled.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="min-w-0 text-[11px] text-bone truncate">
                    {item.sendAt ? new Date(item.sendAt).toLocaleString() : ''} · {item.title}
                  </span>
                  <button type="button" onClick={() => cancel(item.id)} className="text-[10px] font-display font-bold uppercase tracking-wider text-ash-500 hover:text-bone shrink-0">
                    {t('accounts.cancel')}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {log.length > 0 && (
          <div>
            <span className={labelClass}>{t('push.history')}</span>
            <ul className="space-y-1">
              {log.slice(0, 12).map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 px-1 py-1 text-[11px]">
                  <span className="min-w-0 text-ash-400 truncate">{item.title}</span>
                  <span className="font-mono text-ash-500 shrink-0">{item.sent}/{item.recipients}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="p-4 border-t border-border-subtle bg-black/30 flex justify-end gap-3">
        <button type="button" disabled={loading} onClick={onClose} className="px-4 py-2 text-[10px] font-display font-bold uppercase tracking-wider text-ash-500 hover:text-bone">
          {t('accounts.cancel')}
        </button>
        <button
          type="button"
          disabled={loading || !title.trim() || !body.trim() || !buildTarget()}
          onClick={submit}
          className="px-5 py-2 bg-primary text-black text-[10px] font-display font-black uppercase tracking-wider disabled:opacity-30"
        >
          {sendAt ? t('push.action.schedule') : t('push.action.send')}
        </button>
      </div>
    </DeliverShell>
  );
}
