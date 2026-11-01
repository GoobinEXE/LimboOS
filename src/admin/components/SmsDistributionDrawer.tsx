import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { groupService } from '../../services/GroupService';
import { activityLogger } from '../../services/ActivityLogger';
import { useNpcSmsCatalog } from '../../hooks/useNpcSmsCatalog';
import { toLegacyDialogue } from '../../data/npcMessages';
import type { NpcSmsDialogueLegacy } from '../../types/npcSms';
import DeliverShell from './DeliverShell';
import { useToast } from './ToastProvider';
import { ADMIN_SPRING } from '../lib/motion';
import { useAdminCampaigns } from '../hooks/useAdminCampaigns';
import { bindingIncludes, isGlobalBinding } from '../lib/campaignResources';

/** Destinatário de SMS: o envio exige o esquadrão do agente (thread do grupo). */
export interface SmsTarget {
  uid: string;
  characterId: string;
  codinome: string;
  phoneNumber?: string;
  groupId: string | null;
  groupName?: string;
  label: string;
}

interface SmsAssignment {
  target: SmsTarget;
  npcId: string;
  npcName: string;
  dialogue: NpcSmsDialogueLegacy;
}

type DistMode = 'shuffle' | 'pick';

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

interface SmsDistributionDrawerProps {
  targets: SmsTarget[];
  /** Missão de referência: mostra NPCs globais + os dela (com opção de ver todos). */
  missionId?: string | null;
  title: string;
  subtitle?: string;
  onClose: () => void;
  onSuccess: () => void;
  /** Origem no log de atividade (Mesa ou Ao Vivo). */
  logAction: 'npc_sms_distributed' | 'npc_sms_distributed_live';
  logContext: string;
}

/**
 * Distribuição de torpedos de NPC, a mesma em Mesa (esquadrão) e no Ao Vivo
 * (agentes online/selecionados): filtro por missão, sorteio ou escolha de
 * diálogos e prévia de quem recebe o quê antes de enviar.
 */
export default function SmsDistributionDrawer({
  targets,
  missionId,
  title,
  subtitle,
  onClose,
  onSuccess,
  logAction,
  logContext,
}: SmsDistributionDrawerProps) {
  const { t } = useTranslation('admin');
  const toast = useToast();
  const { enabledContacts, enabledDialogues, getContact } = useNpcSmsCatalog();
  const { campaigns } = useAdminCampaigns();
  const [selectedNpc, setSelectedNpc] = useState<string>('all');
  const [showAllNpcs, setShowAllNpcs] = useState(false);
  const [mode, setMode] = useState<DistMode>('shuffle');
  const [pickedIds, setPickedIds] = useState<Set<string>>(new Set());
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const [loading, setLoading] = useState(false);

  const missionName = missionId ? campaigns.find((c) => c.id === missionId)?.name || missionId : null;

  /** NPCs que valem na missão (globais + vinculados); "todos" ignora o vínculo. */
  const visibleContacts = useMemo(() => {
    if (!missionId || showAllNpcs) return enabledContacts;
    return enabledContacts.filter(
      (c) => isGlobalBinding(c.campaignIds) || bindingIncludes(c.campaignIds, missionId),
    );
  }, [enabledContacts, missionId, showAllNpcs]);
  const hiddenNpcCount = enabledContacts.length - visibleContacts.length;

  const ready = useMemo(() => targets.filter((target) => target.groupId), [targets]);
  const missingGroup = useMemo(() => targets.filter((target) => !target.groupId), [targets]);

  const availableDialogues = useMemo(() => {
    if (selectedNpc === 'all') {
      const ids = new Set(visibleContacts.map((c) => c.id));
      return enabledDialogues.filter((d) => ids.has(d.npcId));
    }
    return enabledDialogues.filter((d) => d.npcId === selectedNpc);
  }, [enabledDialogues, selectedNpc, visibleContacts]);

  useEffect(() => {
    if (selectedNpc !== 'all' && !visibleContacts.some((c) => c.id === selectedNpc)) {
      setSelectedNpc('all');
    }
  }, [visibleContacts, selectedNpc]);

  useEffect(() => {
    setPickedIds(new Set());
  }, [selectedNpc]);

  // Prévia derivada do estado; "sortear de novo" só troca a semente
  const assignments = useMemo((): SmsAssignment[] => {
    if (ready.length === 0) return [];
    const toAssignment = (target: SmsTarget, dialogue: (typeof enabledDialogues)[number]): SmsAssignment => {
      const contact = getContact(dialogue.npcId);
      return {
        target,
        npcId: dialogue.npcId,
        npcName: contact?.name || dialogue.npcId,
        dialogue: toLegacyDialogue(dialogue, contact),
      };
    };

    if (mode === 'pick') {
      const picked = availableDialogues.filter((d) => pickedIds.has(d.id));
      if (picked.length === 0) return [];
      return ready.map((target, index) => toAssignment(target, picked[index % picked.length]));
    }

    const npcIds = selectedNpc === 'all' ? visibleContacts.map((n) => n.id) : [selectedNpc];
    const list: SmsAssignment[] = [];
    for (const npcId of npcIds) {
      const dialogues = enabledDialogues.filter((d) => d.npcId === npcId);
      if (dialogues.length === 0) continue;
      const shuffled = shuffleArray(dialogues);
      ready.forEach((target, index) => list.push(toAssignment(target, shuffled[index % shuffled.length])));
    }
    return list;
    // shuffleSeed é a dependência que pede um novo sorteio
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, mode, pickedIds, availableDialogues, selectedNpc, visibleContacts, enabledDialogues, getContact, shuffleSeed]);

  const togglePick = (id: string) => {
    setPickedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDistribute = async () => {
    if (assignments.length === 0) return;
    setLoading(true);
    try {
      for (const assignment of assignments) {
        await groupService.sendNpcDialogueToCharacter(
          assignment.target.groupId!,
          assignment.target.characterId,
          assignment.target.codinome || 'Agente',
          assignment.target.phoneNumber || '(Sem Telefone)',
          assignment.dialogue,
        );
      }
      activityLogger.logAdmin(
        'gm.mpg',
        logAction,
        `${logContext}: ${assignments.length} diálogo(s) para ${ready.length} agente(s)`,
      );
      toast.success(t('deliver.toast.smsOk', { n: assignments.length }));
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Erro na distribuição de SMS:', error);
      toast.error(t('deliver.toast.smsFail'));
    } finally {
      setLoading(false);
    }
  };

  const tabClass = (active: boolean) =>
    `flex-1 min-w-[80px] py-3 text-[9px] font-black uppercase tracking-widest transition ${
      active ? 'text-primary bg-primary/10 border-b-2 border-primary' : 'text-ash-600 hover:text-ash-400'
    }`;
  const modeClass = (active: boolean) =>
    `text-[9px] font-black uppercase tracking-widest px-3 py-1.5 border rounded-sm ${
      active ? 'border-secondary text-secondary bg-secondary/10' : 'border-border text-ash-500'
    }`;

  return (
    <DeliverShell
      title={title}
      targets={targets}
      subtitle={
        subtitle || missionName ? (
          <>
            {subtitle}
            {subtitle && missionName ? ' · ' : ''}
            {missionName && (
              <>
                {t('npcSms.distMission')}: <span className="text-bone">{missionName}</span>
              </>
            )}
          </>
        ) : undefined
      }
      onClose={loading ? undefined : onClose}
    >
      {missionId && (hiddenNpcCount > 0 || showAllNpcs) && (
        <label className="px-6 pt-4 flex items-center gap-2 text-[11px] text-ash-400 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showAllNpcs}
            onChange={(e) => setShowAllNpcs(e.target.checked)}
            className="accent-[var(--color-accent)]"
          />
          {showAllNpcs ? t('npcSms.distShowingAll') : t('npcSms.distHidden', { count: hiddenNpcCount })}
        </label>
      )}

      <div className="flex flex-wrap border-b-2 border-seam bg-black/20 mt-4 shrink-0">
        <button type="button" onClick={() => setSelectedNpc('all')} className={tabClass(selectedNpc === 'all')}>
          {t('deliver.npcAll')}
        </button>
        {visibleContacts.map((npc) => (
          <button
            key={npc.id}
            type="button"
            onClick={() => setSelectedNpc(npc.id)}
            className={tabClass(selectedNpc === npc.id)}
          >
            {npc.name}
          </button>
        ))}
      </div>

      <div className="px-6 pt-4 flex gap-2 shrink-0">
        <button type="button" onClick={() => setMode('shuffle')} className={modeClass(mode === 'shuffle')}>
          {t('npcSms.shuffleMode')}
        </button>
        <button type="button" onClick={() => setMode('pick')} className={modeClass(mode === 'pick')}>
          {t('npcSms.pickMode')}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar flex flex-col gap-4">
        {missingGroup.length > 0 && (
          <div className="border border-yellow-500/30 bg-yellow-500/5 px-4 py-3">
            <p className="text-[9px] font-display font-bold uppercase tracking-widest text-yellow-500/80">
              {t('deliver.sms.noSquad')}
            </p>
            <p className="text-[10px] text-ash-500 mt-1">{missingGroup.map((target) => target.label).join(', ')}</p>
          </div>
        )}

        {ready.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-border-subtle rounded-sm text-ash-600 uppercase tracking-widest font-black text-xs">
            <span className="material-symbols-outlined text-4xl block mb-2" aria-hidden>
              person_off
            </span>
            {t('deliver.sms.noAgents')}
          </div>
        ) : (
          <>
            {mode === 'pick' && (
              <div className="space-y-2">
                <span className="text-[10px] font-black text-ash-400 uppercase tracking-widest">
                  {t('npcSms.selectDialogues')}
                </span>
                {availableDialogues.length === 0 && (
                  <p className="text-[10px] text-ash-600 uppercase">{t('npcSms.noDialogues')}</p>
                )}
                {availableDialogues.map((d) => (
                  <label
                    key={d.id}
                    className={`flex items-start gap-3 p-3 border rounded-sm cursor-pointer ${
                      pickedIds.has(d.id) ? 'border-primary/40 bg-primary/5' : 'border-border-subtle bg-black/30'
                    }`}
                  >
                    <input type="checkbox" checked={pickedIds.has(d.id)} onChange={() => togglePick(d.id)} className="mt-1" />
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-bone uppercase truncate">{d.title}</p>
                      <p className="text-[9px] text-ash-500 line-clamp-1 italic">
                        &ldquo;{d.messages[0]?.text || ''}&rdquo;
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            )}

            <div className="flex justify-between items-center bg-seam border border-border-subtle px-4 py-3 rounded-sm">
              <span className="text-[10px] font-black text-ash-400 uppercase tracking-widest">{t('npcSms.preview')}</span>
              {mode === 'shuffle' && (
                <button
                  type="button"
                  onClick={() => setShuffleSeed((n) => n + 1)}
                  disabled={loading}
                  className="flex items-center gap-1.5 text-primary text-[9px] font-black uppercase tracking-widest border border-primary/20 bg-primary/5 hover:bg-primary/15 px-3 py-1.5 rounded-sm active:scale-[0.97] transition"
                >
                  <span className="material-symbols-outlined text-[12px]" aria-hidden>
                    shuffle
                  </span>
                  {t('npcSms.reshuffle')}
                </button>
              )}
            </div>

            <div className="space-y-2">
              {assignments.map((asg, idx) => (
                <div
                  key={`${asg.npcId}_${asg.target.characterId}_${idx}`}
                  className="bg-black/30 border border-border-subtle p-4 rounded-sm flex items-center justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[9px] font-mono bg-ash-800 text-ash-400 px-2 py-0.5 rounded-sm font-bold uppercase">
                        NPC: {asg.npcName}
                      </span>
                      <span className="material-symbols-outlined text-ash-600 text-xs" aria-hidden>
                        arrow_forward
                      </span>
                      <span className="text-[10px] font-black text-primary uppercase">{asg.target.label}</span>
                      {asg.target.groupName && (
                        <span className="text-[9px] text-ash-500 uppercase tracking-widest">{asg.target.groupName}</span>
                      )}
                    </div>
                    <h4 className="text-[11px] font-bold text-bone uppercase mt-2 tracking-wide truncate">
                      {asg.dialogue.title}
                    </h4>
                    <p className="text-[9px] text-ash-500 line-clamp-1 italic mt-1">
                      &ldquo;{asg.dialogue.messages[0]?.text || ''}&rdquo;
                    </p>
                  </div>
                  <span className="text-[9px] text-ash-600 font-bold font-mono ml-4 shrink-0">
                    {asg.dialogue.messages.length} SMS
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="p-4 border-t border-border-subtle bg-black/30 flex items-center justify-between gap-3">
        <span className="text-[10px] font-black text-ash-500 uppercase tracking-widest">
          {t('deliver.sms.summary', { dialogues: assignments.length, agents: ready.length })}
        </span>
        <div className="flex gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="px-4 py-2 text-[10px] font-display font-bold uppercase tracking-widest text-ash-500 hover:text-bone"
          >
            {t('accounts.cancel')}
          </button>
          <motion.button
            type="button"
            disabled={loading || assignments.length === 0}
            onClick={() => void handleDistribute()}
            whileTap={{ scale: 0.97 }}
            animate={loading ? { scale: [1, 0.98, 1] } : { scale: 1 }}
            transition={loading ? { repeat: Infinity, duration: 0.8 } : ADMIN_SPRING}
            className="px-5 py-2 bg-primary text-black text-[10px] font-display font-black uppercase tracking-widest disabled:opacity-30 flex items-center gap-2"
          >
            {loading ? (
              <>
                <span className="material-symbols-outlined text-sm animate-spin" aria-hidden>
                  progress_activity
                </span>
                {t('deliver.sms.sending')}
              </>
            ) : (
              t('deliver.sms.send')
            )}
          </motion.button>
        </div>
      </div>
    </DeliverShell>
  );
}
