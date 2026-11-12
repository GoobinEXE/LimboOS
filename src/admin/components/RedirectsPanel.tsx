import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { subscribeToQrRedirects, saveQrRedirect, deleteQrRedirect } from '../../store/firestore';
import { activityLogger } from '../../services/ActivityLogger';
import { useModal } from './ConfirmModal';
import { format } from 'date-fns';
import Screw from '../../components/player/Screw';
import { intelService } from '../../services/IntelService';
import { intelRegistry } from '../../data/intel_registry';
import type { IntelItem } from '../../types/intel';
import { matchesIntelScope, type CampaignScope } from '../lib/campaignResources';

interface QrRedirect {
  sourceId: string;
  targetId: string;
  updatedAt: any;
  reason?: string;
}

export default function RedirectsPanel({
  embedded = false,
  campaignScope = 'all',
}: {
  embedded?: boolean;
  /** Filtro de missão de Conteúdo: vale pela intel de destino (destino inexistente só em "todas"). */
  campaignScope?: CampaignScope;
}) {
  const { t } = useTranslation('admin');
  const [redirects, setRedirects] = useState<QrRedirect[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [newSourceId, setNewSourceId] = useState('');
  const [newTargetId, setNewTargetId] = useState('');
  const [newReason, setNewReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { showAlert, modal } = useModal();
  const [intelItems, setIntelItems] = useState<IntelItem[]>(() => intelRegistry.getAll());

  useEffect(() => intelService.subscribeToIntelRegistry(setIntelItems), []);

  /** Destino do QR resolvido para o título da intel (o mestre não precisa decorar ids). */
  const intelById = useMemo(() => {
    const map = new Map<string, IntelItem>();
    intelItems.forEach((item) => map.set(item.id, item));
    return map;
  }, [intelItems]);
  const targetMatch = newTargetId.trim() ? intelById.get(newTargetId.trim()) : undefined;

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeToQrRedirects((data) => {
      setRedirects(data as QrRedirect[]);
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleAddRedirect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSourceId || !newTargetId) return;
    setIsSaving(true);
    try {
      // A campanha do redirect é a do item de destino (quem vê o QR vê o item).
      const targetCampaign = intelRegistry.get(newTargetId.trim())?.campaignId ?? null;
      await saveQrRedirect(newSourceId.trim(), newTargetId.trim(), newReason.trim(), targetCampaign);
      activityLogger.logAdmin('mestre', 'qr_redirect_add', `Criou redirecionamento: ${newSourceId} -> ${newTargetId}`, { sourceId: newSourceId, targetId: newTargetId });
      setNewSourceId('');
      setNewTargetId('');
      setNewReason('');
      showAlert('Sucesso', 'Mapeamento sintonizado.');
    } catch (err) {
      console.error('Error saving redirect:', err);
      showAlert('Erro', 'Falha ao salvar redirecionamento.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (sourceId: string) => {
    try {
      await deleteQrRedirect(sourceId);
      activityLogger.logAdmin('mestre', 'qr_redirect_remove', `Removeu redirecionamento: ${sourceId}`, { sourceId });
      // Real-time listener handles state update
    } catch (err) {
      console.error('Error deleting redirect:', err);
      showAlert('Erro', 'Falha ao remover redirecionamento.');
    }
  };

  const filteredRedirects = redirects.filter(r => {
    if (campaignScope !== 'all') {
      const target = intelById.get(r.targetId);
      if (!target || !matchesIntelScope(target, campaignScope)) return false;
    }
    return (r.sourceId || '').toLowerCase().includes(search.toLowerCase()) || 
    (r.targetId || '').toLowerCase().includes(search.toLowerCase()) ||
    (intelById.get(r.targetId)?.title || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.reason || '').toLowerCase().includes(search.toLowerCase());
  });

  return (
    <section className="space-y-8">
      {modal}
      {!embedded && (
      <div className="flex items-center gap-4">
        <div className="w-2 h-8 bg-phosphor-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(86,185,75,0.4)]" />
        <h2 className="font-black uppercase tracking-widest text-lg text-bone">
          Interface de Redirecionamento de Sinal QR
        </h2>
        <span className="text-[10px] font-bold text-ash-600 tracking-widest uppercase">
          {redirects.length} MAPEAMENTOS ATIVOS NO GRID
        </span>
      </div>
      )}
      {embedded && (
        <p className="text-[10px] font-display font-bold text-ash-500 uppercase tracking-widest">
          Mapear QR físico → intel · {redirects.length} mapeamentos ativos
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form Column */}
        <div className="lg:col-span-1">
          <div className="bg-seam p-8 rounded-card shadow-xl space-y-8 relative overflow-hidden">
            <div className="flex items-center gap-3 border-b border-border-subtle pb-6">
              <span className="material-symbols-outlined text-phosphor-500 text-2xl">add_link</span>
              <h3 className="font-black text-xs uppercase tracking-widest text-bone">{t('redirects.inject')}</h3>
            </div>
            
            <form onSubmit={handleAddRedirect} className="space-y-6 relative z-10">
              <div className="space-y-2">
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-ash-600">ID ORIGEM (QR FÍSICO)</label>
                <input
                  type="text"
                  required
                  value={newSourceId}
                  onChange={(e) => setNewSourceId(e.target.value)}
                  placeholder="EX: IJZ0IE..."
                  className="w-full bg-black/40 text-[11px] font-mono font-bold uppercase tracking-widest outline-none text-phosphor-400 px-4 py-3 rounded-sm transition"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-ash-600">ID DESTINO (DADO CORRETO)</label>
                <input
                  type="text"
                  required
                  value={newTargetId}
                  onChange={(e) => setNewTargetId(e.target.value)}
                  placeholder="EX: TAPE-ID-123..."
                  list="qr-intel-targets"
                  autoComplete="off"
                  className="w-full bg-black/40 text-[11px] font-mono font-bold tracking-widest outline-none text-primary px-4 py-3 rounded-sm transition focus:bg-accent-10"
                />
                <datalist id="qr-intel-targets">
                  {intelItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </datalist>
                {newTargetId.trim() ? (
                  <p
                    className={`flex items-center gap-1.5 text-[11px] ${
                      targetMatch ? 'text-phosphor-400' : 'text-amber-300/90'
                    }`}
                    role="status"
                  >
                    <span className="material-symbols-outlined text-sm" aria-hidden>
                      {targetMatch ? 'check_circle' : 'help'}
                    </span>
                    {targetMatch ? targetMatch.title : t('redirects.targetUnknown')}
                  </p>
                ) : (
                  <p className="text-[11px] text-ash-500">{t('redirects.targetHint')}</p>
                )}
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-ash-600">{t('redirects.notes')}</label>
                <textarea
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  placeholder="MOTIVO DO REDIRECIONAMENTO..."
                  rows={2}
                  className="w-full bg-black/40 text-[10px] font-bold text-bone px-4 py-3 outline-none rounded-sm resize-none transition"
                />
              </div>
              <button
                type="submit"
                disabled={isSaving}
                className="w-full bg-phosphor-600 hover:bg-phosphor-500 text-bone py-4 font-black text-[10px] uppercase tracking-[0.3em] transition rounded-sm active:scale-[0.97] disabled:opacity-40"
              >
                {isSaving ? 'SINC DADOS...' : t('redirects.linkAction')}
              </button>
            </form>

            <div className="bg-black/60 p-5 rounded-card">
              <p className="text-[10px] text-ash-600 leading-relaxed font-bold uppercase tracking-wide">
                <span className="text-phosphor-500 font-black">LOG:</span> {t('redirects.help')}
              </p>
            </div>
          </div>
        </div>

        {/* List Column */}
        <div className="lg:col-span-2">
          <div className="bg-seam rounded-card shadow-2xl flex flex-col min-h-[500px] overflow-hidden">
            <div className="p-6 border-b-4 border-seam bg-black/40 flex items-center justify-between">
              <h3 className="font-black text-[10px] uppercase tracking-[0.3em] text-ash-600">{t('redirects.activeGrid')}</h3>
              <div className="relative">
                 <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-ash-700 text-xs">search</span>
                 <input
                   type="text"
                   placeholder="LOCALIZAR VETOR..."
                   value={search}
                   onChange={(e) => setSearch(e.target.value)}
                   className="bg-black/60 text-[10px] font-black uppercase tracking-widest focus:ring-1 focus:ring-phosphor-500 placeholder:text-ash-900 text-bone px-10 py-2 w-56 rounded-sm transition"
                 />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto bg-black/20 custom-scrollbar">
              {loading ? (
                <div className="p-24 text-center">
                  <span className="material-symbols-outlined text-3xl text-phosphor-900 animate-spin block mb-4">sync</span>
                  <p className="font-black text-xs text-ash-700 tracking-[0.4em]">{t('redirects.loading')}</p>
                </div>
              ) : filteredRedirects.length === 0 ? (
                <div className="p-24 text-center text-ash-500">
                  <span className="material-symbols-outlined text-6xl block mb-4 text-ash-700" aria-hidden>link_off</span>
                  <p className="font-black text-sm uppercase tracking-[0.4em]">{t('redirects.empty')}</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {filteredRedirects.map((r) => (
                    <div key={r.sourceId} className="p-6 hover:bg-primary/5 transition group">
                      <div className="flex items-center justify-between gap-6">
                        <div className="flex items-center gap-8 flex-1">
                          <div className="flex flex-col gap-2">
                            <p className="text-[10px] font-black text-ash-700 uppercase tracking-widest">{t('redirects.origin')}</p>
                            <code className="text-[11px] font-mono bg-black px-4 py-2 text-phosphor-400 transition rounded-sm font-black">
                              {r.sourceId}
                            </code>
                          </div>
                          <div className="pt-4">
                             <span className="material-symbols-outlined text-ash-800 text-2xl group-hover:text-primary transition-colors">double_arrow</span>
                          </div>
                          <div className="flex flex-col gap-2">
                            <p className="text-[10px] font-black text-ash-700 uppercase tracking-widest">{t('redirects.destination')}</p>
                            <code className="text-[11px] font-mono bg-black px-4 py-2 text-primary transition rounded-sm font-black group-hover:bg-accent-10">
                              {r.targetId}
                            </code>
                            <p
                              className={`text-[11px] truncate max-w-[14rem] ${
                                intelById.has(r.targetId) ? 'text-ash-300' : 'text-amber-300/90'
                              }`}
                            >
                              {intelById.get(r.targetId)?.title || t('redirects.targetUnknown')}
                            </p>
                          </div>
                          <div className="flex-1 min-w-0 ml-4 pt-4">
                            {r.reason && (
                              <p className="text-[10px] text-ash-500 font-bold uppercase tracking-tight truncate group-hover:text-ash-300" title={r.reason}>"{r.reason}"</p>
                            )}
                            <p className="text-[10px] font-black text-ash-800 mt-2 uppercase tracking-widest">
                              SINC: {r.updatedAt?.toDate ? format(r.updatedAt.toDate(), 'dd/MM/yy HH:mm') : '---'}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDelete(r.sourceId)}
                          className="w-10 h-10 flex items-center justify-center text-ash-800 hover:text-red-500 hover:bg-red-500/10 transition opacity-0 group-hover:opacity-100 material-symbols-outlined rounded-sm"
                          title="ELIMINAR MAPEAMENTO"
                        >
                          delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="bg-black/40 border-t-4 border-seam p-6 px-10 flex justify-between items-center shrink-0">
               <div className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-phosphor-500 animate-pulse shadow-[0_0_5px_rgba(86,185,75,0.6)]" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-ash-600">{t('redirects.integrity')}</span>
               </div>
               <span className="text-[10px] font-black text-ash-800 uppercase tracking-widest">RM-REDIRECT-SYS-v4</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
