import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import type { CharacterData, Group } from '../../types/player';
import type { IntelGrantTarget } from '../../services/IntelService';
import { userService } from '../../services/UserService';
import { groupService } from '../../services/GroupService';
import { activityLogger } from '../../services/ActivityLogger';
import { resolveCampaignPlatform } from '../../data/campaigns';
import { toLegacyDialogue } from '../../data/npcMessages';
import { useAchievementCatalog } from '../../hooks/useAchievementCatalog';
import { useNpcSmsCatalog } from '../../hooks/useNpcSmsCatalog';
import IntelDistributionDrawer from './IntelDistributionDrawer';
import OverlayPortal from './OverlayPortal';
import Screw from '../../components/player/Screw';
import { useToast } from './ToastProvider';
import { ADMIN_SPRING, overlayFade } from '../lib/motion';

export type LiveDeliverKind = 'intel' | 'achievements' | 'sms' | 'video';

export interface LiveDeliverTarget {
  uid: string;
  characterId: string;
  character: CharacterData;
  label: string;
}

interface LiveDeliverDrawerProps {
  kind: LiveDeliverKind;
  targets: LiveDeliverTarget[];
  onClose: () => void;
  onSuccess: () => void;
}

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Shell de entrega ao vivo: Intel | Conquistas | SMS | Vídeo para alvos online.
 */
export default function LiveDeliverDrawer({
  kind,
  targets,
  onClose,
  onSuccess,
}: LiveDeliverDrawerProps) {
  const { t } = useTranslation('admin');
  const kindLabels: Record<LiveDeliverKind, string> = {
    intel: t('deliver.kind.intel'),
    achievements: t('deliver.kind.achievements'),
    sms: t('deliver.kind.sms'),
    video: t('deliver.kind.video'),
  };
  if (kind === 'intel' || kind === 'video') {
    const grantTargets: IntelGrantTarget[] = targets.map((target) => ({
      uid: target.uid,
      characterId: target.characterId,
    }));
    return (
      <IntelDistributionDrawer
        onClose={onClose}
        onSuccess={onSuccess}
        title={kindLabels[kind]}
        targets={grantTargets}
        broadcastMode={kind === 'video'}
      />
    );
  }

  if (kind === 'achievements') {
    return (
      <AchievementDeliverPane
        targets={targets}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    );
  }

  return <SmsDeliverPane targets={targets} onClose={onClose} onSuccess={onSuccess} />;
}

function AchievementDeliverPane({
  targets,
  onClose,
  onSuccess,
}: {
  targets: LiveDeliverTarget[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useTranslation('admin');
  const toast = useToast();
  const { achievements } = useAchievementCatalog();
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return achievements;
    return achievements.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q) ||
        (a.description || '').toLowerCase().includes(q)
    );
  }, [search, achievements]);

  const handleGrant = async () => {
    if (!selectedId || targets.length === 0) return;
    setLoading(true);
    try {
      for (const target of targets) {
        const campaignId = target.character.campaignId || 'unscoped';
        const platform = resolveCampaignPlatform(target.character.campaignId);
        await userService.grantUserAchievement(target.uid, target.characterId, selectedId, {
          campaignId,
          platform,
        });
      }
      activityLogger.logAdmin(
        'gm.mpg',
        'achievement_grant_live',
        `Outorgou ${selectedId} para ${targets.length} agente(s) ao vivo`,
        { achievementId: selectedId, count: targets.length }
      );
      toast.success(t('deliver.toast.achievementOk', { n: targets.length }));
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(t('deliver.toast.achievementFail'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <DeliverShell title={t('deliver.kind.achievements')} targets={targets} onClose={loading ? undefined : onClose}>
      <div className="px-6 py-3 border-b border-border-subtle">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('deliver.searchAchievement')}
          className="w-full bg-black/50 border border-border px-4 py-2.5 text-[10px] font-display font-bold uppercase tracking-widest text-bone placeholder:text-ash-700 outline-none focus:border-primary/40"
        />
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-white/5">
        {filtered.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setSelectedId(a.id)}
            className={`w-full flex items-center gap-4 px-6 py-3 text-left transition-colors ${
              selectedId === a.id ? 'bg-primary/10' : 'hover:bg-white/5'
            }`}
          >
            <img src={a.icon} alt="" className="w-10 h-10 object-cover rounded-sm border border-border shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-display font-bold uppercase tracking-widest text-bone truncate">
                {a.title}
              </p>
              <p className="text-[9px] font-mono text-ash-600 truncate mt-0.5">{a.id}</p>
            </div>
            {selectedId === a.id && (
              <span className="material-symbols-outlined text-primary text-lg">check_circle</span>
            )}
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="p-12 text-center text-[10px] font-display font-bold uppercase tracking-widest text-ash-600">
            Nenhuma conquista encontrada
          </p>
        )}
      </div>
      <div className="p-4 border-t border-border-subtle bg-black/30 flex justify-end gap-3">
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
          disabled={loading || !selectedId}
          onClick={handleGrant}
          whileTap={{ scale: 0.97 }}
          animate={loading ? { scale: [1, 0.98, 1] } : { scale: 1 }}
          transition={loading ? { repeat: Infinity, duration: 0.8 } : ADMIN_SPRING}
          className="px-5 py-2 bg-primary text-black text-[10px] font-display font-black uppercase tracking-widest disabled:opacity-30 flex items-center gap-2"
        >
          {loading ? (
            <>
              <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
              Outorgando...
            </>
          ) : (
            `Outorgar a ${targets.length}`
          )}
        </motion.button>
      </div>
    </DeliverShell>
  );
}

function SmsDeliverPane({
  targets,
  onClose,
  onSuccess,
}: {
  targets: LiveDeliverTarget[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useTranslation('admin');
  const toast = useToast();
  const { enabledContacts, enabledDialogues, getContact } = useNpcSmsCatalog();
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedNpc, setSelectedNpc] = useState('all');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return groupService.subscribeToGroups(setGroups);
  }, []);

  const targetsWithGroup = useMemo(() => {
    return targets.map((t) => {
      const group = groups.find((g) =>
        (g.characterSlots || []).some((s) => s.uid === t.uid && s.characterId === t.characterId)
      );
      return { ...t, group };
    });
  }, [targets, groups]);

  const missingGroup = targetsWithGroup.filter((t) => !t.group);
  const ready = targetsWithGroup.filter((t) => t.group);

  const handleDistribute = async () => {
    if (ready.length === 0) return;
    setLoading(true);
    try {
      const npcIds =
        selectedNpc === 'all' ? enabledContacts.map((n) => n.id) : [selectedNpc];
      let sent = 0;

      for (const npcId of npcIds) {
        const dialogues = enabledDialogues.filter((d) => d.npcId === npcId);
        if (dialogues.length === 0) continue;
        const shuffled = shuffleArray(dialogues);

        for (let i = 0; i < ready.length; i++) {
          const target = ready[i];
          const dialogue = shuffled[i % shuffled.length];
          const legacy = toLegacyDialogue(dialogue, getContact(npcId));
          await groupService.sendNpcDialogueToCharacter(
            target.group!.id,
            target.characterId,
            target.character.codinome || 'Agente',
            target.character.phoneNumber || '(Sem Telefone)',
            legacy
          );
          sent++;
        }
      }

      activityLogger.logAdmin(
        'gm.mpg',
        'npc_sms_distributed_live',
        `SMS ao vivo: ${sent} diálogo(s) para ${ready.length} agente(s)`
      );
      toast.success(t('deliver.toast.smsOk', { n: sent }));
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(t('deliver.toast.smsFail'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <DeliverShell title={t('deliver.kind.sms')} targets={targets} onClose={loading ? undefined : onClose}>
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
        <div>
          <p className="text-[9px] font-display font-bold uppercase tracking-widest text-ash-500 mb-2">
            NPC
          </p>
          <select
            value={selectedNpc}
            onChange={(e) => setSelectedNpc(e.target.value)}
            className="w-full bg-black/50 border border-border px-4 py-3 text-[10px] font-display font-bold uppercase tracking-widest text-primary outline-none"
          >
            <option value="all">{t('deliver.npcAll')}</option>
            {enabledContacts.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>
        </div>

        {missingGroup.length > 0 && (
          <div className="border border-yellow-500/30 bg-yellow-500/5 px-4 py-3">
            <p className="text-[9px] font-display font-bold uppercase tracking-widest text-yellow-500/80">
              Sem esquadrão — SMS não será enviado
            </p>
            <p className="text-[10px] text-ash-500 mt-1">
              {missingGroup.map((t) => t.label).join(', ')}
            </p>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-[9px] font-display font-bold uppercase tracking-widest text-ash-500">
            Destinatários prontos ({ready.length})
          </p>
          {ready.map((t) => (
            <div
              key={`${t.uid}_${t.characterId}`}
              className="flex justify-between px-3 py-2 bg-black/40 border border-border-subtle text-[10px] font-display font-bold uppercase tracking-widest"
            >
              <span className="text-bone">{t.label}</span>
              <span className="text-primary/60">{t.group?.name}</span>
            </div>
          ))}
          {ready.length === 0 && (
            <p className="text-[10px] text-ash-600 uppercase tracking-widest">
              Nenhum alvo em esquadrão
            </p>
          )}
        </div>
      </div>
      <div className="p-4 border-t border-border-subtle bg-black/30 flex justify-end gap-3">
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
          disabled={loading || ready.length === 0}
          onClick={handleDistribute}
          whileTap={{ scale: 0.97 }}
          animate={loading ? { scale: [1, 0.98, 1] } : { scale: 1 }}
          transition={loading ? { repeat: Infinity, duration: 0.8 } : ADMIN_SPRING}
          className="px-5 py-2 bg-primary text-black text-[10px] font-display font-black uppercase tracking-widest disabled:opacity-30 flex items-center gap-2"
        >
          {loading ? (
            <>
              <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
              Enviando...
            </>
          ) : (
            `Enviar a ${ready.length}`
          )}
        </motion.button>
      </div>
    </DeliverShell>
  );
}

function DeliverShell({
  title,
  targets,
  onClose,
  children,
}: {
  title: string;
  targets: LiveDeliverTarget[];
  onClose?: () => void;
  children: React.ReactNode;
}) {
  const [visible, setVisible] = useState(true);

  const requestClose = () => {
    if (!onClose) return;
    setVisible(false);
  };

  return (
    <OverlayPortal open onClose={onClose ? requestClose : undefined}>
      <AnimatePresence onExitComplete={() => { if (!visible) onClose?.(); }}>
        {visible && (
          <motion.div
            key="deliver-backdrop"
            variants={overlayFade}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-[120] flex justify-end bg-surface-scrim"
            onClick={() => requestClose()}
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={ADMIN_SPRING}
              className="bg-surface-container-low border-l border-seam w-full max-w-xl shadow-2xl flex flex-col h-full relative overflow-hidden font-display"
              onClick={(e) => e.stopPropagation()}
            >
              <Screw className="top-4 left-4" />
              <Screw className="top-4 right-4 -rotate-90" />
              <div className="noise-overlay" />
              <div className="scanlines" />

              <div className="p-6 border-b-4 border-seam bg-black/40 relative z-10 flex justify-between items-start gap-4">
                <div className="min-w-0">
                  <h3 className="font-black text-xl text-bone uppercase tracking-widest truncate">{title}</h3>
                  <p className="text-[10px] text-ash-500 font-bold uppercase tracking-widest mt-1 truncate">
                    {targets.length} alvo(s): {targets.map((t) => t.label).join(', ')}
                  </p>
                </div>
                {onClose && (
                  <button
                    type="button"
                    onClick={requestClose}
                    className="p-2 text-ash-600 hover:text-bone material-symbols-outlined shrink-0"
                  >
                    close
                  </button>
                )}
              </div>

              <div className="flex-1 flex flex-col min-h-0 relative z-10">{children}</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </OverlayPortal>
  );
}
