import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Campaign } from '../../../data/campaigns';
import type { Group } from '../../../types/player';
import type { InviteKind, InviteSummary, WorkspaceMember } from '../../../types/workspace';
import { inviteService, inviteUrl } from '../../../services/InviteService';
import { useToast } from '../ToastProvider';
import { useModal } from '../ConfirmModal';
import RetroSpinner from '../../../components/player/RetroSpinner';

interface MissionTeamTabProps {
  campaign: Campaign;
  groups: Group[];
}

const SECTION_LABEL =
  'text-[10px] text-primary/60 font-display font-bold uppercase tracking-wider pb-2';
const FIELD =
  'w-full bg-black/40 text-[11px] font-mono text-bone p-3 outline-none rounded-sm transition';

function formatDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Equipe da missão (só o dono da pasta): co-mestres convidados para esta
 * campanha e convites de jogadores. O link de convite aparece uma vez, na
 * criação; o servidor guarda só o hash do token.
 */
export default function MissionTeamTab({ campaign, groups }: MissionTeamTabProps) {
  const { t, i18n } = useTranslation('admin');
  const toast = useToast();
  const { showConfirm, modal } = useModal();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invites, setInvites] = useState<InviteSummary[] | null>(null);
  const [creating, setCreating] = useState<InviteKind | null>(null);
  const [lastLink, setLastLink] = useState<{ kind: InviteKind; url: string } | null>(null);
  const [squadId, setSquadId] = useState('');
  const [maxUses, setMaxUses] = useState(10);
  const [days, setDays] = useState(7);

  const squads = useMemo(
    () => groups.filter((g) => g.campaignId === campaign.id || (g.unlockedCampaigns || []).includes(campaign.id)),
    [groups, campaign.id],
  );
  const campaignMembers = useMemo(
    () => members.filter((m) => (m.campaignIds || []).includes(campaign.id)),
    [members, campaign.id],
  );

  useEffect(() => inviteService.subscribeMembers(setMembers), []);

  const refreshInvites = useCallback(async () => {
    try {
      setInvites(await inviteService.list(campaign.id));
    } catch (err) {
      console.warn('[MissionTeamTab] listInvites failed:', err);
      setInvites([]);
    }
  }, [campaign.id]);

  useEffect(() => {
    void refreshInvites();
  }, [refreshInvites]);

  const createInvite = async (kind: InviteKind) => {
    setCreating(kind);
    try {
      const created = await inviteService.create({
        kind,
        campaignId: campaign.id,
        ...(kind === 'player' ? { squadId: squadId || null, maxUses } : { maxUses: 1 }),
        expiresInDays: days,
      });
      const url = inviteUrl(created.token);
      setLastLink({ kind, url });
      try {
        await navigator.clipboard.writeText(url);
        toast.success(t('team.toast.copied'));
      } catch {
        toast.success(t('team.toast.created'));
      }
      void refreshInvites();
    } catch (err) {
      console.error('[MissionTeamTab] createInvite failed:', err);
      toast.error(t('team.toast.createFail'));
    } finally {
      setCreating(null);
    }
  };

  const revoke = async (invite: InviteSummary) => {
    if (!(await showConfirm(t('team.revokeTitle'), t('team.revokeBody'), t('team.revoke')))) return;
    try {
      await inviteService.revoke(invite.id);
      void refreshInvites();
    } catch (err) {
      console.error(err);
      toast.error(t('team.toast.revokeFail'));
    }
  };

  const removeMember = async (member: WorkspaceMember) => {
    if (!(await showConfirm(t('team.removeTitle'), t('team.removeBody', { name: member.displayName || member.uid }), t('team.remove')))) return;
    try {
      await inviteService.removeCoGm(member.uid, campaign.id);
      toast.success(t('team.toast.removed'));
    } catch (err) {
      console.error(err);
      toast.error(t('team.toast.removeFail'));
    }
  };

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t('team.toast.copied'));
    } catch {
      /* sem permissão de clipboard: o link continua visível para copiar à mão */
    }
  };

  const activeInvites = (invites || []).filter(
    (i) => !i.revoked && i.uses < i.maxUses && (!i.expiresAt || new Date(i.expiresAt).getTime() > Date.now()),
  );

  return (
    <div className="space-y-10">
      {modal}

      <section className="space-y-4" aria-labelledby="team-cogm">
        <p id="team-cogm" className={SECTION_LABEL}>{t('team.cogmTitle')}</p>
        <p className="text-[11px] text-ash-500 leading-relaxed max-w-prose">{t('team.cogmBody')}</p>
        {campaignMembers.length === 0 ? (
          <p className="text-[10px] text-ash-600 uppercase tracking-wider">{t('team.noCogm')}</p>
        ) : (
          <ul className="space-y-2">
            {campaignMembers.map((m) => (
              <li key={m.uid} className="flex items-center justify-between gap-3 bg-white/5 rounded-sm px-3 py-2">
                <span className="text-[11px] font-display font-bold text-bone uppercase tracking-wider truncate">
                  {m.displayName || m.uid.slice(0, 8)}
                </span>
                <button type="button" onClick={() => void removeMember(m)} className="lmb-btn text-red-400">
                  {t('team.remove')}
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={() => void createInvite('cogm')}
          disabled={creating !== null}
          className="lmb-btn lmb-btn-primary"
        >
          {creating === 'cogm' ? <RetroSpinner /> : t('team.inviteCogm')}
        </button>
      </section>

      <section className="space-y-4" aria-labelledby="team-players">
        <p id="team-players" className={SECTION_LABEL}>{t('team.playersTitle')}</p>
        <p className="text-[11px] text-ash-500 leading-relaxed max-w-prose">{t('team.playersBody')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="space-y-1">
            <span className="block text-[10px] font-display font-bold uppercase tracking-wider text-ash-500">{t('team.squad')}</span>
            <select value={squadId} onChange={(e) => setSquadId(e.target.value)} className={FIELD}>
              <option value="">{t('team.noSquad')}</option>
              {squads.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-[10px] font-display font-bold uppercase tracking-wider text-ash-500">{t('team.maxUses')}</span>
            <input
              type="number"
              min={1}
              max={200}
              value={maxUses}
              onChange={(e) => setMaxUses(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
              className={FIELD}
            />
          </label>
          <label className="space-y-1">
            <span className="block text-[10px] font-display font-bold uppercase tracking-wider text-ash-500">{t('team.days')}</span>
            <input
              type="number"
              min={1}
              max={30}
              value={days}
              onChange={(e) => setDays(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
              className={FIELD}
            />
          </label>
        </div>
        <button
          type="button"
          onClick={() => void createInvite('player')}
          disabled={creating !== null}
          className="lmb-btn lmb-btn-primary"
        >
          {creating === 'player' ? <RetroSpinner /> : t('team.invitePlayers')}
        </button>
      </section>

      {lastLink && (
        <div className="bg-primary/5 rounded-sm p-4 space-y-2" role="status">
          <p className="text-[10px] font-display font-bold uppercase tracking-wider text-primary">
            {lastLink.kind === 'cogm' ? t('team.linkCogm') : t('team.linkPlayers')}
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input readOnly value={lastLink.url} onFocus={(e) => e.currentTarget.select()} className={FIELD} aria-label={t('team.linkLabel')} />
            <button type="button" onClick={() => void copy(lastLink.url)} className="lmb-btn shrink-0">{t('team.copy')}</button>
          </div>
          <p className="text-[10px] text-ash-500">{t('team.linkOnce')}</p>
        </div>
      )}

      <section className="space-y-3" aria-labelledby="team-invites">
        <p id="team-invites" className={SECTION_LABEL}>{t('team.activeInvites')}</p>
        {invites === null ? (
          <RetroSpinner />
        ) : activeInvites.length === 0 ? (
          <p className="text-[10px] text-ash-600 uppercase tracking-wider">{t('team.noInvites')}</p>
        ) : (
          <ul className="space-y-2">
            {activeInvites.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center justify-between gap-3 bg-white/5 rounded-sm px-3 py-2">
                <span className="text-[10px] font-display font-bold uppercase tracking-wider text-bone">
                  {inv.kind === 'cogm' ? t('team.kindCogm') : t('team.kindPlayer')}
                  {inv.squadId && ` · ${groups.find((g) => g.id === inv.squadId)?.name ?? inv.squadId}`}
                </span>
                <span className="text-[10px] font-mono text-ash-500">
                  {t('team.usage', { uses: inv.uses, max: inv.maxUses })} · {t('team.expires', { date: formatDate(inv.expiresAt, i18n.language) })}
                </span>
                <button type="button" onClick={() => void revoke(inv)} className="lmb-btn text-red-400">{t('team.revoke')}</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
