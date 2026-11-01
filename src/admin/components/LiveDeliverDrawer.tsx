import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import type { CharacterData, Group } from '../../types/player';
import type { IntelGrantTarget } from '../../services/IntelService';
import { userService } from '../../services/UserService';
import { groupService } from '../../services/GroupService';
import { activityLogger } from '../../services/ActivityLogger';
import { resolveCampaignPlatform } from '../../data/campaigns';
import { useAchievementCatalog } from '../../hooks/useAchievementCatalog';
import IntelDistributionDrawer from './IntelDistributionDrawer';
import SmsDistributionDrawer, { type SmsTarget } from './SmsDistributionDrawer';
import DeliverShell from './DeliverShell';
import { useToast } from './ToastProvider';
import { ADMIN_SPRING } from '../lib/motion';

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
  /** Missão da sessão (ou dos alvos): filtra os NPCs da distribuição de SMS. */
  missionId?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Shell de entrega ao vivo: Intel | Conquistas | SMS | Vídeo para alvos online.
 */
export default function LiveDeliverDrawer({
  kind,
  targets,
  missionId,
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

  return <LiveSmsDeliver targets={targets} missionId={missionId} onClose={onClose} onSuccess={onSuccess} />;
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
          className="w-full bg-black/50 border border-border px-4 py-2.5 text-[10px] font-display font-bold uppercase tracking-widest text-bone placeholder:text-ash-600 outline-none focus:border-primary/40"
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

/** SMS ao vivo: resolve o esquadrão de cada alvo e abre a distribuição unificada. */
function LiveSmsDeliver({
  targets,
  missionId,
  onClose,
  onSuccess,
}: {
  targets: LiveDeliverTarget[];
  missionId?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useTranslation('admin');
  const [groups, setGroups] = useState<Group[]>([]);

  useEffect(() => groupService.subscribeToGroups(setGroups), []);

  const smsTargets = useMemo(
    (): SmsTarget[] =>
      targets.map((target) => {
        const group = groups.find((g) =>
          (g.characterSlots || []).some((s) => s.uid === target.uid && s.characterId === target.characterId)
        );
        return {
          uid: target.uid,
          characterId: target.characterId,
          codinome: target.character.codinome,
          phoneNumber: target.character.phoneNumber,
          groupId: group?.id ?? null,
          groupName: group?.name,
          label: target.label,
        };
      }),
    [targets, groups]
  );

  return (
    <SmsDistributionDrawer
      title={t('deliver.kind.sms')}
      targets={smsTargets}
      missionId={missionId}
      onClose={onClose}
      onSuccess={onSuccess}
      logAction="npc_sms_distributed_live"
      logContext="SMS ao vivo"
    />
  );
}
