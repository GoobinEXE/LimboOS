import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Group } from '../../types/player';
import { Campaign } from '../../data/campaigns';
import { campaignAdminService } from '../../services/CampaignAdminService';
import { campaignLabel } from '../lib/entityLabels';
import Screw from '../../components/player/Screw';
import OverlayPortal from './OverlayPortal';

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
          unlock ? 'Missão autorizada para o esquadrão.' : 'Autorização removida.'
        );
      } catch (err) {
        console.error(err);
        await showAlert('Erro', 'Falha ao gerenciar autorização.');
      }
    });

  const handleAssign = (campaignId: string) =>
    withBusy(async () => {
      try {
        if (!unlocked.includes(campaignId)) {
          await campaignAdminService.unlockForGroup(group.id, campaignId, true);
        }
        await campaignAdminService.assignToGroup(group.id, campaignId);
        await showAlert('Sucesso', 'Esquadrão enviado para a missão (Ativa).');
      } catch (err) {
        console.error(err);
        await showAlert('Erro', 'Falha na atribuição.');
      }
    });

  const handleUnassign = () =>
    withBusy(async () => {
      try {
        await campaignAdminService.unassignFromGroup(group.id);
        await showAlert('Sucesso', 'Esquadrão removido do campo.');
      } catch (err) {
        console.error(err);
        await showAlert('Erro', 'Falha ao remover designação.');
      }
    });

  return (
    <OverlayPortal open onClose={busy ? undefined : onClose}>
      <div
        className="fixed inset-0 z-[120] flex justify-end bg-black/80 backdrop-blur-sm animate-fade-in"
        onClick={() => {
          if (!busy) onClose();
        }}
      >
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="bg-[#222] border-l-8 border-[#1a1a1a] w-full max-w-xl shadow-2xl flex flex-col h-full relative overflow-hidden font-chakra"
          onClick={(e) => e.stopPropagation()}
        >
          <Screw className="top-4 left-4" />
          <Screw className="top-4 right-4 -rotate-90" />
          <Screw className="bottom-4 left-4 -rotate-90" />
          <Screw className="bottom-4 right-4" />
          <div className="noise-overlay" />
          <div className="scanlines" />

          <div className="p-8 border-b-4 border-[#1a1a1a] bg-black/40 relative z-10 flex justify-between items-center">
            <div>
              <h3 className="font-black text-xl text-white uppercase tracking-widest">
                Missões_do_Esquadrão
              </h3>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">
                Grupo: <span className="text-primary">{group.name}</span>
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={busy}
              className="p-2 text-zinc-600 hover:text-white transition-all material-symbols-outlined rounded-sm disabled:opacity-40"
            >
              close
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 bg-black/10 relative z-10 custom-scrollbar space-y-8">
            <p className="text-[9px] font-display font-bold text-industrial-silver/30 uppercase tracking-widest border border-white/5 bg-black/20 px-4 py-3 rounded-sm">
              <strong className="text-primary/80">Autorizado</strong> libera a missão na seleção do jogador.{' '}
              <strong className="text-emerald-500/80">Em campo</strong> define a missão ativa do esquadrão.
              Preferência: abrir o comando completo da missão para inventário e transmissão.
            </p>

            <div className="space-y-2">
              <p className="text-[8px] text-industrial-silver/30 font-display font-bold uppercase tracking-widest">
                Autorizar Missão
              </p>
              <select
                className="w-full bg-surface-container-lowest border border-white/5 text-[10px] font-display font-bold text-primary p-3 outline-none rounded-sm focus:border-primary/40 transition-all appearance-none cursor-pointer shadow-inner disabled:opacity-40"
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
                    ? 'Todas as missões já autorizadas'
                    : 'Autorizar missão...'}
                </option>
                {availableToUnlock.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-4">
              <p className="text-[8px] text-industrial-silver/30 font-display font-bold uppercase tracking-widest border-b border-white/5 pb-2">
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
                      title="Remover autorização"
                    >
                      close
                    </button>
                  </div>
                ))}
                {unlocked.length === 0 && (
                  <p className="text-[9px] text-industrial-silver/30 uppercase tracking-widest">
                    Nenhuma missão autorizada
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-[8px] text-emerald-500/50 font-display font-bold uppercase tracking-widest border-b border-emerald-500/10 pb-2">
                Missão Ativa (Em Campo)
              </p>
              <select
                className="w-full bg-emerald-500/5 border border-emerald-500/20 text-[10px] font-display font-bold text-emerald-500 p-3 outline-none rounded-sm focus:border-emerald-500/40 transition-all appearance-none cursor-pointer disabled:opacity-40"
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
                    ? 'Nenhuma missão disponível'
                    : 'Designar missão para campo...'}
                </option>
                {availableToAssign.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {!unlocked.includes(c.id) ? ' (autorizará)' : ''}
                  </option>
                ))}
              </select>

              {group.campaignId ? (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 rounded-sm pr-1 animate-pulse">
                    <span className="text-[9px] font-display font-bold px-3 py-1 uppercase tracking-wider">
                      OPERANDO: {campaignLabel(group.campaignId, campaigns)}
                    </span>
                    <button
                      disabled={busy}
                      onClick={handleUnassign}
                      className="p-1 text-emerald-500/40 hover:text-red-500 material-symbols-outlined text-xs disabled:opacity-40"
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
                      className="text-[9px] font-black uppercase tracking-widest text-black bg-emerald-500 hover:bg-emerald-400 px-4 py-2 rounded-sm transition-colors disabled:opacity-40"
                    >
                      Abrir comando da missão →
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-[9px] text-industrial-silver/30 uppercase tracking-widest">
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
