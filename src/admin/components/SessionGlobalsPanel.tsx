import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { onSnapshot } from 'firebase/firestore';
import { ShieldBan, ShieldCheck } from 'lucide-react';
import { campaignStateDoc } from '../../lib/tenantScope';
import { setDiskRepairAllowed as saveDiskRepairAllowed, setLimboMilitarySeizure } from '../../store/firestore';
import { activityLogger } from '../../services/ActivityLogger';
import type { LimboGlobalState } from '../../types/player';
import { LIMBO_THREAD_COUNT } from '../../components/LimboBoard';

/**
 * Controles de sessão da missão ativa (Limbo + DiskRepair), no Ao Vivo. O estado
 * vale só para esta campanha: workspaces/{ws}/campaigns/{c}/state/live.
 */
export default function SessionGlobalsPanel({ campaignId }: { campaignId?: string | null }) {
  const { t } = useTranslation('admin');
  const [limboState, setLimboState] = useState<LimboGlobalState>({ seized: false });
  const [diskRepairAllowed, setDiskRepairAllowed] = useState(false);

  useEffect(() => {
    setLimboState({ seized: false });
    setDiskRepairAllowed(false);
    if (!campaignId) return;
    return onSnapshot(campaignStateDoc(campaignId, 'live'), (snap) => {
      const data = snap.exists() ? snap.data() : {};
      setLimboState({ seized: !!data.seized, ...data } as LimboGlobalState);
      setDiskRepairAllowed(!!data.diskRepairAllowed);
    }, (err) => console.warn('[SessionGlobalsPanel] state listener error:', err));
  }, [campaignId]);

  if (!campaignId) {
    return (
      <div className="bg-surface-container-low p-5 rounded-sm">
        <p className="text-[10px] font-display font-bold uppercase tracking-wider text-ash-500">
          {t('sessionGlobals.pickMission')}
        </p>
      </div>
    );
  }

  const toggleLimboMilitary = async () => {
    const next = !limboState.seized;
    activityLogger.logTrace('limbo_military_step', `Limbo USArmy → ${next ? 'ATIVO' : 'INATIVO'}`);
    await setLimboMilitarySeizure(campaignId, next);
    activityLogger.logAdmin('mestre', 'limbo_military_toggle', `Limbo USArmy ${next ? 'ATIVADO' : 'DESATIVADO'} na missão`, {
      seized: next,
      campaignId,
    });
  };

  const toggleDiskRepair = async () => {
    const newState = !diskRepairAllowed;
    await saveDiskRepairAllowed(campaignId, newState);
    activityLogger.logAdmin('mestre', 'disk_repair_toggle', `DiskRepair ${newState ? 'ATIVADO' : 'DESATIVADO'}`, {
      diskRepairAllowed: newState,
      campaignId,
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div
        className={`bg-surface-container-low p-5 rounded-sm flex flex-col gap-4 transition ${
          limboState.seized
            ? ''
            : ''
        }`}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-display font-bold uppercase tracking-wider text-ash-500">
            {t('sessionGlobals.limboTitle')}
          </h3>
          {limboState.seized && <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
        </div>
        <div className="flex items-center gap-3 font-display font-black uppercase text-base">
          {limboState.seized ? (
            <span className="text-red-500 flex items-center gap-2">
              <ShieldBan size={18} /> {t('sessionGlobals.militaryLock')}
            </span>
          ) : (
            <span className="text-phosphor-500 flex items-center gap-2">
              <ShieldCheck size={18} /> {t('sessionGlobals.gridOpen')}
            </span>
          )}
        </div>
        <p
          className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
            limboState.seized ? 'text-red-500/70' : 'text-phosphor-500/70'
          }`}
        >
          {t('sessionGlobals.readGlobal', {
            read: (limboState.readThreadIds || []).length,
            total: LIMBO_THREAD_COUNT,
          })}
        </p>
        <div className="bg-primary/5 p-3 rounded-sm">
          <p className="text-[10px] font-display font-black text-primary uppercase tracking-wider mb-1">
            {t('sessionGlobals.ipHint')}
          </p>
          <p className="text-sm font-mono font-black text-bone tracking-wider">212.45.1.1</p>
        </div>
        <button
          type="button"
          onClick={toggleLimboMilitary}
          className={`px-5 py-2 font-display font-black uppercase text-[10px] tracking-wider transition rounded-sm self-start ${
            limboState.seized
              ? 'bg-red-600 text-bone'
              : 'bg-[#333] text-ash-400 hover:bg-[#444]'
          } active:scale-[0.97]`}
        >
          {limboState.seized ? t('sessionGlobals.normalize') : t('sessionGlobals.forceUsarmy')}
        </button>
      </div>

      <div className="bg-surface-container-low p-5 rounded-sm flex flex-col gap-4">
        <h3 className="text-[10px] font-display font-bold uppercase tracking-wider text-ash-500">
          {t('sessionGlobals.protocols')}
        </h3>
        <div className="flex items-center justify-between p-4 bg-black/40 rounded-sm">
          <div>
            <p className="font-display font-black text-sm text-bone uppercase">{t('sessionGlobals.diskRepair')}</p>
            <p className="text-[10px] text-ash-600 font-bold uppercase mt-1">{t('sessionGlobals.diskRepairDesc')}</p>
          </div>
          <button
            type="button"
            onClick={toggleDiskRepair}
            className={`relative w-14 h-7 rounded-full transition ${
              diskRepairAllowed
                ? 'bg-accent'
                : 'bg-surface-container-highest'
            }`}
            role="switch"
            aria-checked={diskRepairAllowed}
            aria-label={t('sessionGlobals.diskRepair')}
          >
            <div
              className={`absolute top-1 left-1 w-4 h-4 rounded-full transition-transform duration-300 ${
                diskRepairAllowed
                  ? 'translate-x-7 bg-field-ink'
                  : 'translate-x-0 bg-ash-400'
              }`}
            />
          </button>
        </div>
        <p className="text-[10px] text-ash-600 font-display font-bold uppercase tracking-wide leading-relaxed">
          {t('sessionGlobals.hint')}
        </p>
      </div>
    </div>
  );
}
