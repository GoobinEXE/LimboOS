import { doc, onSnapshot, query, where, type DocumentData } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getTenantScope, onTenantScopeChange, wsCollection } from '../lib/tenantScope';
import { Campaign, registerCampaigns } from '../data/campaigns';

/**
 * CampaignService: leitura das missões da pasta ativa.
 * Dono: a coleção inteira da pasta. Co-mestre e jogador: só as campanhas da lista
 * de acesso, lidas documento a documento (é o que as regras permitem).
 */
class CampaignService {
  private static instance: CampaignService;

  private constructor() {}

  public static getInstance(): CampaignService {
    if (!CampaignService.instance) {
      CampaignService.instance = new CampaignService();
    }
    return CampaignService.instance;
  }

  /** Todas as campanhas visíveis para a sessão, vivas. */
  public subscribeToScopedCampaigns(
    callback: (campaigns: Campaign[]) => void,
    onError?: (err: Error) => void,
  ): () => void {
    const scope = getTenantScope();
    if (!scope) {
      callback([]);
      return () => {};
    }
    const toCampaign = (id: string, data: DocumentData) => ({ id, ...data } as Campaign);
    const emit = (list: Campaign[]) => {
      registerCampaigns(list);
      callback(list);
    };

    if (scope.campaignIds === null) {
      return onSnapshot(
        wsCollection('campaigns'),
        (snap) => emit(snap.docs.map((d) => toCampaign(d.id, d.data()))),
        (err) => {
          console.warn('[CampaignService] campaigns listener error:', err.code || err);
          onError?.(err);
        },
      );
    }

    const ids = [...scope.campaignIds];
    if (ids.length === 0) {
      callback([]);
      return () => {};
    }
    const byId = new Map<string, Campaign | null>();
    const flush = () => {
      if (byId.size < ids.length) return;
      emit(ids.map((id) => byId.get(id)).filter((c): c is Campaign => !!c));
    };
    const unsubs = ids.map((id) =>
      onSnapshot(
        doc(db, 'workspaces', scope.wsId, 'campaigns', id),
        (snap) => {
          byId.set(id, snap.exists() ? toCampaign(snap.id, snap.data()) : null);
          flush();
        },
        (err) => {
          console.warn('[CampaignService] campaign listener error:', id, err.code || err);
          byId.set(id, null);
          flush();
          onError?.(err);
        },
      ),
    );
    return () => unsubs.forEach((u) => u());
  }

  /** Campanhas ativas ou bloqueadas (seleção do jogador), refeitas quando a pasta muda. */
  public subscribeToActiveCampaigns(callback: (campaigns: Campaign[]) => void): () => void {
    let stop = this.subscribeActiveOnce(callback);
    const stopScope = onTenantScopeChange(() => {
      stop();
      stop = this.subscribeActiveOnce(callback);
    });
    return () => {
      stop();
      stopScope();
    };
  }

  private subscribeActiveOnce(callback: (campaigns: Campaign[]) => void): () => void {
    const scope = getTenantScope();
    if (scope?.campaignIds === null) {
      return onSnapshot(
        query(wsCollection('campaigns'), where('status', 'in', ['Ativa', 'Bloqueada'])),
        (snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Campaign));
          registerCampaigns(list);
          callback(list);
        },
        (err) => {
          console.warn('[CampaignService] active campaigns error:', err.code || err);
          callback([]);
        },
      );
    }
    return this.subscribeToScopedCampaigns((list) =>
      callback(list.filter((c) => c.status === 'Ativa' || c.status === 'Bloqueada')),
    );
  }
}

export const campaignService = CampaignService.getInstance();
