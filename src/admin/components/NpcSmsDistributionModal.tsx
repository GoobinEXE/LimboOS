import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { Group, CharacterData } from '../../types/player';
import { groupService } from '../../services/GroupService';
import { activityLogger } from '../../services/ActivityLogger';
import { useNpcSmsCatalog } from '../../hooks/useNpcSmsCatalog';
import { toLegacyDialogue } from '../../data/npcMessages';
import type { NpcDialogue, NpcSmsDialogueLegacy } from '../../types/npcSms';
import Screw from '../../components/player/Screw';
import OverlayPortal from './OverlayPortal';
import { ADMIN_SPRING } from '../lib/motion';

interface NpcSmsDistributionModalProps {
  group: Group;
  allCharacters: { uid: string; char: CharacterData }[];
  onClose: () => void;
  onSuccess: () => void;
}

interface SmsAssignment {
  characterId: string;
  characterName: string;
  characterUid: string;
  characterPhoneNumber: string;
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

export default function NpcSmsDistributionModal({
  group,
  allCharacters,
  onClose,
  onSuccess,
}: NpcSmsDistributionModalProps) {
  const { t } = useTranslation('admin');
  const { enabledContacts, enabledDialogues, getContact } = useNpcSmsCatalog();
  const [selectedNpc, setSelectedNpc] = useState<string>('all');
  const [mode, setMode] = useState<DistMode>('shuffle');
  const [pickedIds, setPickedIds] = useState<Set<string>>(new Set());
  const [assignments, setAssignments] = useState<SmsAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const groupCharacters = useMemo(() => {
    const slots = group.characterSlots || [];
    return slots
      .map((slot) => {
        const found = allCharacters.find(
          (c) => c.uid === slot.uid && c.char.id === slot.characterId,
        );
        return found ? { uid: slot.uid, char: found.char } : null;
      })
      .filter((c): c is { uid: string; char: CharacterData } => c !== null);
  }, [group.characterSlots, allCharacters]);

  const availableDialogues = useMemo(() => {
    if (selectedNpc === 'all') return enabledDialogues;
    return enabledDialogues.filter((d) => d.npcId === selectedNpc);
  }, [enabledDialogues, selectedNpc]);

  const toLegacy = (d: NpcDialogue): NpcSmsDialogueLegacy =>
    toLegacyDialogue(d, getContact(d.npcId));

  const generateShuffleAssignments = () => {
    if (groupCharacters.length === 0) {
      setAssignments([]);
      return;
    }

    const npcIds =
      selectedNpc === 'all'
        ? enabledContacts.map((n) => n.id)
        : [selectedNpc];

    const newAssignments: SmsAssignment[] = [];

    for (const npcId of npcIds) {
      const dialogues = enabledDialogues.filter((d) => d.npcId === npcId);
      if (dialogues.length === 0) continue;
      const shuffled = shuffleArray(dialogues);
      groupCharacters.forEach((member, index) => {
        const dialogue = shuffled[index % shuffled.length];
        const contact = getContact(npcId);
        newAssignments.push({
          characterId: member.char.id,
          characterName: member.char.codinome,
          characterUid: member.uid,
          characterPhoneNumber: member.char.phoneNumber || '(Sem Telefone)',
          npcId,
          npcName: contact?.name || npcId,
          dialogue: toLegacy(dialogue),
        });
      });
    }

    setAssignments(newAssignments);
  };

  const generatePickAssignments = () => {
    if (groupCharacters.length === 0 || pickedIds.size === 0) {
      setAssignments([]);
      return;
    }
    const picked = availableDialogues.filter((d) => pickedIds.has(d.id));
    if (picked.length === 0) {
      setAssignments([]);
      return;
    }
    const newAssignments: SmsAssignment[] = [];
    groupCharacters.forEach((member, index) => {
      const dialogue = picked[index % picked.length];
      const contact = getContact(dialogue.npcId);
      newAssignments.push({
        characterId: member.char.id,
        characterName: member.char.codinome,
        characterUid: member.uid,
        characterPhoneNumber: member.char.phoneNumber || '(Sem Telefone)',
        npcId: dialogue.npcId,
        npcName: contact?.name || dialogue.npcId,
        dialogue: toLegacy(dialogue),
      });
    });
    setAssignments(newAssignments);
  };

  useEffect(() => {
    if (mode === 'shuffle') generateShuffleAssignments();
    else generatePickAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNpc, groupCharacters, mode, pickedIds, enabledDialogues, enabledContacts]);

  useEffect(() => {
    setPickedIds(new Set());
  }, [selectedNpc]);

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
          group.id,
          assignment.characterId,
          assignment.characterName,
          assignment.characterPhoneNumber,
          assignment.dialogue,
        );
      }

      setFeedback(`✓ Torpedos de SMS enviados com sucesso.`);
      activityLogger.logAdmin(
        'gm.mpg',
        'npc_sms_distributed',
        `Distribuição de torpedos para o grupo ${group.name}: ${assignments.length} diálogos distribuídos.`,
      );

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (error) {
      console.error('Erro na distribuição de SMS:', error);
      setFeedback('ERRO: Falha ao distribuir mensagens.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <OverlayPortal open onClose={loading ? undefined : onClose}>
      <div
        className="fixed inset-0 z-[120] flex justify-end bg-black/80 backdrop-blur-sm animate-fade-in"
        onClick={() => {
          if (!loading) onClose();
        }}
      >
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={ADMIN_SPRING}
          className="bg-[#222] border-l-8 border-seam w-full max-w-2xl shadow-2xl flex flex-col h-full relative overflow-hidden font-chakra"
          onClick={(e) => e.stopPropagation()}
        >
          <Screw className="top-4 left-4" />
          <Screw className="top-4 right-4 -rotate-90" />
          <Screw className="bottom-4 left-4 -rotate-90" />
          <Screw className="bottom-4 right-4" />
          <div className="noise-overlay" />
          <div className="scanlines" />

          <div className="p-8 border-b-4 border-seam bg-black/40 relative z-10 flex justify-between items-center">
            <div>
              <h3 className="font-black text-xl text-white uppercase tracking-widest">
                {t('squads.smsTitle')}
              </h3>
              <p className="text-[10px] text-ash-500 font-bold uppercase tracking-widest mt-1">
                Grupo: <span className="text-primary">{group.name}</span>
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="p-2 text-ash-600 hover:text-white transition-all material-symbols-outlined rounded-sm"
            >
              close
            </button>
          </div>

          <div className="flex flex-wrap border-b-2 border-seam bg-black/20 relative z-10 shrink-0">
            <button
              onClick={() => setSelectedNpc('all')}
              className={`flex-1 min-w-[80px] py-4 text-[9px] font-black uppercase tracking-widest transition-all ${
                selectedNpc === 'all'
                  ? 'text-primary bg-primary/10 border-b-2 border-primary'
                  : 'text-ash-600 hover:text-ash-400'
              }`}
            >
              {t('deliver.npcAll')}
            </button>
            {enabledContacts.map((npc) => (
              <button
                key={npc.id}
                onClick={() => setSelectedNpc(npc.id)}
                className={`flex-1 min-w-[80px] py-4 text-[9px] font-black uppercase tracking-widest transition-all ${
                  selectedNpc === npc.id
                    ? 'text-primary bg-primary/10 border-b-2 border-primary'
                    : 'text-ash-600 hover:text-ash-400'
                }`}
              >
                {npc.name}
              </button>
            ))}
          </div>

          <div className="px-6 pt-4 flex gap-2 relative z-10 shrink-0">
            <button
              type="button"
              onClick={() => setMode('shuffle')}
              className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 border rounded-sm ${
                mode === 'shuffle'
                  ? 'border-secondary text-secondary bg-secondary/10'
                  : 'border-white/10 text-ash-500'
              }`}
            >
              {t('npcSms.shuffleMode')}
            </button>
            <button
              type="button"
              onClick={() => setMode('pick')}
              className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 border rounded-sm ${
                mode === 'pick'
                  ? 'border-secondary text-secondary bg-secondary/10'
                  : 'border-white/10 text-ash-500'
              }`}
            >
              {t('npcSms.pickMode')}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 bg-black/10 relative z-10 custom-scrollbar flex flex-col gap-4">
            {groupCharacters.length === 0 ? (
              <div className="text-center py-20 border-2 border-dashed border-[#333] rounded-sm text-ash-600 uppercase tracking-widest font-black text-xs">
                <span className="material-symbols-outlined text-4xl block mb-2">person_off</span>
                Nenhum agente vinculado a este grupo
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
                          pickedIds.has(d.id)
                            ? 'border-primary/40 bg-primary/5'
                            : 'border-[#2d2d2d] bg-[#181818]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={pickedIds.has(d.id)}
                          onChange={() => togglePick(d.id)}
                          className="mt-1"
                        />
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold text-white uppercase truncate">
                            {d.title}
                          </p>
                          <p className="text-[9px] text-ash-500 line-clamp-1 italic">
                            &ldquo;{d.messages[0]?.text || ''}&rdquo;
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}

                <div className="flex justify-between items-center bg-seam border border-[#333] px-4 py-3 rounded-sm">
                  <span className="text-[10px] font-black text-ash-400 uppercase tracking-widest">
                    {t('npcSms.preview')}
                  </span>
                  {mode === 'shuffle' && (
                    <button
                      onClick={generateShuffleAssignments}
                      disabled={loading}
                      className="flex items-center gap-1.5 text-primary text-[9px] font-black uppercase tracking-widest border border-primary/20 bg-primary/5 hover:bg-primary/15 px-3 py-1.5 rounded-sm active:scale-95 transition-all"
                    >
                      <span className="material-symbols-outlined text-[12px]">shuffle</span>
                      {t('npcSms.reshuffle')}
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {assignments.map((asg, idx) => (
                    <div
                      key={`${asg.npcId}_${asg.characterId}_${idx}`}
                      className="bg-[#181818] border border-[#2d2d2d] p-4 rounded-sm flex items-center justify-between group hover:border-[#444] transition-all"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-mono bg-ash-800 text-ash-400 px-2 py-0.5 rounded-sm font-bold uppercase">
                            NPC: {asg.npcName}
                          </span>
                          <span className="material-symbols-outlined text-ash-600 text-xs">
                            arrow_forward
                          </span>
                          <span className="text-[10px] font-black text-primary uppercase">
                            {asg.characterName}
                          </span>
                        </div>
                        <h4 className="text-[11px] font-bold text-white uppercase mt-2 tracking-wide truncate">
                          {asg.dialogue.title}
                        </h4>
                        <p className="text-[9px] text-ash-500 line-clamp-1 italic mt-1">
                          &ldquo;{asg.dialogue.messages[0]?.text || ''}&rdquo;
                        </p>
                      </div>
                      <div className="text-right ml-4 shrink-0">
                        <span className="text-[9px] text-ash-600 font-bold font-mono">
                          {asg.dialogue.messages.length} SMS
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="p-8 border-t-4 border-seam flex flex-col sm:flex-row justify-between items-center bg-black/40 gap-6 relative z-10 shrink-0">
            <span className="text-[10px] font-black text-ash-500 uppercase tracking-widest">
              {assignments.length} Diálogos vinculados ({groupCharacters.length} agentes)
            </span>
            <div className="flex gap-4 w-full sm:w-auto">
              <button
                onClick={onClose}
                disabled={loading}
                className="flex-1 sm:flex-none px-6 py-4 text-[10px] font-black text-ash-600 hover:text-white transition-colors uppercase tracking-widest disabled:opacity-50"
              >
                CANCELAR
              </button>
              <button
                onClick={handleDistribute}
                disabled={assignments.length === 0 || loading}
                className="flex-2 sm:flex-none bg-primary text-black px-10 py-4 rounded-sm font-black text-[11px] uppercase tracking-widest hover:bg-primary-container transition-all active:scale-95 disabled:opacity-20 glow-orange shadow-lg"
              >
                {loading ? 'ENVIANDO...' : 'DISTRIBUIR SMS'}
              </button>
            </div>
          </div>

          {feedback && (
            <div
              className={`absolute top-6 left-1/2 -translate-x-1/2 bg-black/90 backdrop-blur-sm border px-6 py-3 rounded-full text-[10px] font-black uppercase z-50 flex items-center gap-2 shadow-lg ${
                feedback.startsWith('ERRO')
                  ? 'border-red-500/50 text-red-400'
                  : 'border-phosphor-500/50 text-phosphor-400'
              }`}
            >
              <span className="material-symbols-outlined text-sm">
                {feedback.startsWith('ERRO') ? 'error' : 'check_circle'}
              </span>
              {feedback}
            </div>
          )}
        </motion.div>
      </div>
    </OverlayPortal>
  );
}
