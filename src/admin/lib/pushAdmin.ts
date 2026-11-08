import { callFunction } from '../../lib/functions';

export type PushTarget =
  | { kind: 'characters'; items: { uid: string; characterId: string }[] }
  | { kind: 'group'; groupId: string }
  | { kind: 'campaign'; campaignId: string }
  | { kind: 'all' };

export interface PushLogEntry {
  id: string;
  kind: 'auto' | 'manual' | 'scheduled';
  category: string;
  title: string;
  body: string | null;
  targetLabel: string | null;
  recipients: number;
  sent: number;
  failed: number;
  createdAt: string | null;
}

export interface ScheduledPushEntry {
  id: string;
  title: string;
  body: string;
  targetLabel: string | null;
  status: 'pending' | 'sending' | 'sent' | 'failed' | 'cancelled';
  sendAt: string | null;
}

interface PushContent {
  wsId: string;
  target: PushTarget;
  title: string;
  body: string;
}

export function sendPush(content: PushContent) {
  return callFunction<PushContent, { recipients: number; sent: number; failed: number }>('adminSendPush', content);
}

export function schedulePush(content: PushContent & { sendAt: string }) {
  return callFunction<typeof content, { id: string }>('schedulePush', content);
}

export function cancelScheduledPush(wsId: string, id: string) {
  return callFunction<{ wsId: string; id: string }, { success: boolean }>('cancelScheduledPush', { wsId, id });
}

export function listPushActivity(wsId: string) {
  return callFunction<{ wsId: string }, { log: PushLogEntry[]; scheduled: ScheduledPushEntry[] }>('listPushActivity', { wsId });
}
