import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { Group } from '../../types/player';
import { Campaign } from '../../data/campaigns';
import { campaignAdminService } from '../../services/CampaignAdminService';
import { campaignLabel } from '../lib/entityLabels';
import Screw from '../../components/player/Screw';
import OverlayPortal from './OverlayPortal';
import { ADMIN_SPRING } from '../lib/motion';

interface GroupMissionsModalProps {
  group: Group;
  campaigns: Campaign[];
  onClose: () => void;
  showAlert: (title: string, message: string) => void | Promise<void>;
  onNavigateToMission?: (campaignId: string) => void;
}

export default function GroupMissionsModal({
  group,
  campaigns,
  onClose,
  showAlert,
  onNavigateToMission,
}: GroupMissionsModalProps) {
  const { t } = useTranslation('admin');
  const [busy, setBusy] = useState(false);

  const unlocked = group.unlockedCampaigns || [];
  const availableToUnlock = campaigns.filter((c) => !unlocked.includes(c.id));
  const availableToAssign = campaigns.filter((c) => c.id !== group.campaignId);

  const withBusy = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const handleUnlock = (campaignId: string, unlock: boolean) =>
    withBusy(async () => {
      try {
        await campaignAdminService.unlockForGroup(group.id, campaignId, unlock);
        await showAlert(
          'Sucesso',
          unlock ? t('groupMissions.toast.authorized') : t('groupMissions.toast.authRemoved')
        );
      } catch (err) {
        console.error(err);
        await showAlert('Erro', t('groupMissions.toast.authFail'));
      }
    });

  const handleAssign = (campaignId: string) =>
    withBusy(async () => {
      try {
        if (!unlocked.includes(campaignId)) {
          await campaignAdminService.unlockForGroup(group.id, campaignId, true);
        }
        await campaignAdminService.assignToGroup(group.id, campaignId);
        await showAlert('Sucesso', t('groupMissions.toast.assigned'));
      } catch (err) {
        console.error(err);
        await showAlert('Erro', t('groupMissions.toast.assignFail'));
      }
    });

  const handleUnassign = () =>
    withBusy(async () => {
      try {
        await campaignAdminService.unassignFromGroup(group.id);
        await showAlert('Sucesso', t('groupMissions.toast.removedField'));
      } catch (err) {
        console.error(err);
        await showAlert('Erro', t('groupMissions.toast.removeFail'));
      }
    });

  return (
    <OverlayPortal open onClose={busy ? undefined : onClose}>
      <div
        className="fixed inset-0 z-[120] flex justify-end bg-surface-scrim animate-fade-in"
        onClick={() => {
          if (!busy) onClose();
        }}
      >
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={ADMIN_SPRING}
          className="bg-surface-container-low border-l border-seam w-full max-w-xl shadow-2xl flex flex-col h-full relative overflow-hidden"
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
              <h3 className="font-black text-xl text-bone uppercase tracking-widest">
                Missões do Esquadrão
              </h3>
              <p className="text-[10px] text-ash-500 font-bold uppercase tracking-widest mt-1">
                Grupo: <span className="text-primary">{group.name}</span>
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={busy}
              className="p-2 text-ash-600 hover:text-bone transition material-symbols-outlined rounded-sm disabled:opacity-40"
            >
              close
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 bg-black/10 relative z-10 custom-scrollbar space-y-8">
            <p className="text-[9px] font-display font-bold text-ash-600 uppercase tracking-widest border border-border-subtle bg-black/20 px-4 py-3 rounded-sm">
              {t('groupMissions.authorizedHint')}{' '}
              {t('groupMissions.inFieldHint')}
            </p>

            <div className="space-y-2">
              <p className="text-[9px] text-ash-600 font-display font-bold uppercase tracking-widest">
                Autorizar Missão
              </p>
              <select
                className="w-full bg-surface-container-lowest border border-border-subtle text-[10px] font-display font-bold text-primary p-3 outline-none rounded-sm focus:border-primary/40 transition appearance-none cursor-pointer shadow-inner disabled:opacity-40"
                disabled={busy || availableToUnlock.length === 0}
                onChange={(e) => {
                  if (!e.target.value) return;
                  handleUnlock(e.target.value, true);
                  e.target.value = '';
                }}
                value=""
              >
                <option value="">
                  {availableToUnlock.length === 0
                    ? t('groupMissions.allAuthorized')
                    : t('groupMissions.authorizePlaceholder')}
                </option>
                {availableToUnlock.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-4">
              <p className="text-[9px] text-ash-600 font-display font-bold uppercase tracking-widest border-b border-border-subtle pb-2">
                Missões Autorizadas
              </p>
              <div className="flex flex-wrap gap-2">
                {unlocked.map((campaignId) => (
                  <div
                    key={campaignId}
                    className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-sm pr-1"
                  >
                    <span className="text-[9px] font-display font-bold text-primary/80 px-2 py-1 uppercase tracking-wider">
                      {campaignLabel(campaignId, campaigns)}
                    </span>
                    <button
                      disabled={busy}
                      onClick={() => handleUnlock(campaignId, false)}
                      className="p-1 text-primary/40 hover:text-red-500 material-symbols-outlined text-xs disabled:opacity-40"
                      title={t('groupMissions.removeAuth')}
                    >
                      close
                    </button>
                  </div>
                ))}
                {unlocked.length === 0 && (
                  <p className="text-[9px] text-ash-600 uppercase tracking-widest">
                    Nenhuma missão autorizada
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-[9px] text-phosphor-500/50 font-display font-bold uppercase tracking-widest border-b border-phosphor-500/10 pb-2">
                Missão Ativa (Em Campo)
              </p>
              <select
                className="w-full bg-phosphor-500/5 border border-phosphor-500/20 text-[10px] font-display font-bold text-phosphor-500 p-3 outline-none rounded-sm focus:border-phosphor-500/40 transition appearance-none cursor-pointer disabled:opacity-40"
                disabled={busy || availableToAssign.length === 0}
                onChange={(e) => {
                  if (!e.target.value) return;
                  handleAssign(e.target.value);
                  e.target.value = '';
                }}
                value=""
              >
                <option value="">
                  {availableToAssign.length === 0
                    ? t('groupMissions.noneAvailable')
                    : t('groupMissions.assignPlaceholder')}
                </option>
                {availableToAssign.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {!unlocked.includes(c.id) ? t('groupMissions.willAuthorize') : ''}
                  </option>
                ))}
              </select>

              {group.campaignId ? (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 bg-phosphor-500/10 text-phosphor-500 border border-phosphor-500/30 rounded-sm pr-1 animate-pulse">
                    <span className="text-[9px] font-display font-bold px-3 py-1 uppercase tracking-wider">
                      OPERANDO: {campaignLabel(group.campaignId, campaigns)}
                    </span>
                    <button
                      disabled={busy}
                      onClick={handleUnassign}
                      className="p-1 text-phosphor-500/40 hover:text-red-500 material-symbols-outlined text-xs disabled:opacity-40"
                      title="Remover do campo"
                    >
                      close
                    </button>
                  </div>
                  {onNavigateToMission && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onNavigateToMission(group.campaignId!)}
                      className="text-[9px] font-black uppercase tracking-widest text-black bg-phosphor-500 hover:bg-phosphor-400 px-4 py-2 rounded-sm transition-colors disabled:opacity-40"
                    >
                      Abrir comando da missão →
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-[9px] text-ash-600 uppercase tracking-widest">
                  Nenhuma missão em campo
                </p>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </OverlayPortal>
  );
}
