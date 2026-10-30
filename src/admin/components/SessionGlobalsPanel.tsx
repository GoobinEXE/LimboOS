import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { ShieldBan, ShieldCheck } from 'lucide-react';
import { db } from '../../lib/firebase';
import { setLimboMilitarySeizureGlobal } from '../../store/firestore';
import { activityLogger } from '../../services/ActivityLogger';
import type { LimboGlobalState } from '../../types/player';
import { LIMBO_THREAD_COUNT } from '../../components/LimboBoard';

/**
 * Controles globais de sessão (Limbo + DiskRepair) — vivem no Ao Vivo.
 */
export default function SessionGlobalsPanel() {
  const { t } = useTranslation('admin');
  const [limboState, setLimboState] = useState<LimboGlobalState>({ seized: false });
  const [diskRepairAllowed, setDiskRepairAllowed] = useState(false);

  useEffect(() => {
    const unsubLimbo = onSnapshot(doc(db, 'system', 'limboState'), (snap) => {
      setLimboState(snap.exists() ? (snap.data() as LimboGlobalState) : { seized: false });
    });
    const unsubGameEvents = onSnapshot(doc(db, 'system', 'gameEvents'), (snap) => {
      setDiskRepairAllowed(snap.exists() ? !!snap.data().diskRepairAllowed : false);
    });
    return () => {
      unsubLimbo();
      unsubGameEvents();
    };
  }, []);

  const toggleLimboMilitary = async () => {
    const next = !limboState.seized;
    activityLogger.logTrace('limbo_military_step', `Limbo USArmy → ${next ? 'ATIVO' : 'INATIVO'}`);
    await setLimboMilitarySeizureGlobal(next);
    activityLogger.logAdmin('gm.mpg', 'limbo_military_toggle', `Limbo USArmy ${next ? 'ATIVADO' : 'DESATIVADO'} globalmente`, {
      seized: next,
    });
  };

  const toggleDiskRepair = async () => {
    const newState = !diskRepairAllowed;
    await setDoc(doc(db, 'system', 'gameEvents'), { diskRepairAllowed: newState }, { merge: true });
    activityLogger.logAdmin('gm.mpg', 'disk_repair_toggle', `DiskRepair ${newState ? 'ATIVADO' : 'DESATIVADO'}`, {
      diskRepairAllowed: newState,
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div
        className={`bg-surface-container-low border p-5 rounded-sm flex flex-col gap-4 transition ${
          limboState.seized
            ? 'border-red-500/60 shadow-[0_0_24px_rgba(239,68,68,0.15)]'
            : 'border-primary/10'
        }`}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-display font-bold uppercase tracking-widest text-industrial-silver/40">
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
          className={`text-[10px] font-mono font-bold uppercase tracking-widest ${
            limboState.seized ? 'text-red-500/70' : 'text-phosphor-500/70'
          }`}
        >
          {t('sessionGlobals.readGlobal', {
            read: (limboState.readThreadIds || []).length,
            total: LIMBO_THREAD_COUNT,
          })}
        </p>
        <div className="bg-primary/5 border border-primary/20 p-3 rounded-sm">
          <p className="text-[9px] font-display font-black text-primary uppercase tracking-widest mb-1">
            {t('sessionGlobals.ipHint')}
          </p>
          <p className="text-sm font-mono font-black text-white tracking-wider">212.45.1.1</p>
        </div>
        <button
          type="button"
          onClick={toggleLimboMilitary}
          className={`px-5 py-2 border-2 font-display font-black uppercase text-[10px] tracking-widest transition rounded-sm self-start ${
            limboState.seized
              ? 'bg-red-600 border-red-400 text-white'
              : 'bg-[#333] border-white/5 text-ash-400 hover:bg-[#444]'
          } active:scale-[0.97]`}
        >
          {limboState.seized ? t('sessionGlobals.normalize') : t('sessionGlobals.forceUsarmy')}
        </button>
      </div>

      <div className="bg-surface-container-low border border-primary/10 p-5 rounded-sm flex flex-col gap-4">
        <h3 className="text-[10px] font-display font-bold uppercase tracking-widest text-industrial-silver/40">
          {t('sessionGlobals.protocols')}
        </h3>
        <div className="flex items-center justify-between p-4 bg-black/40 border border-white/5 rounded-sm">
          <div>
            <p className="font-display font-black text-sm text-white uppercase">{t('sessionGlobals.diskRepair')}</p>
            <p className="text-[9px] text-ash-600 font-bold uppercase mt-1">{t('sessionGlobals.diskRepairDesc')}</p>
          </div>
          <button
            type="button"
            onClick={toggleDiskRepair}
            className={`relative w-14 h-7 rounded-full transition border-2 ${
              diskRepairAllowed
                ? 'bg-primary/20 border-primary shadow-[0_0_10px_rgba(255,140,0,0.2)]'
                : 'bg-ash-900 border-ash-800'
            }`}
            aria-label="Toggle DiskRepair"
          >
            <div
              className={`absolute top-1 left-1 w-4 h-4 rounded-full transition-transform duration-300 ${
                diskRepairAllowed
                  ? 'translate-x-7 bg-primary shadow-[0_0_8px_rgba(255,140,0,0.8)]'
                  : 'translate-x-0 bg-ash-800'
              }`}
            />
          </button>
        </div>
        <p className="text-[9px] text-ash-600 font-display font-bold uppercase tracking-wide leading-relaxed">
          {t('sessionGlobals.hint')}
        </p>
      </div>
    </div>
  );
}
