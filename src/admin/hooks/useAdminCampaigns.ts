import { useEffect, useMemo, useState } from 'react';
import type { Campaign } from '../../data/campaigns';
import { campaignService } from '../../services/CampaignService';

/**
 * Lista viva das campanhas da pasta ativa para seletores e filtros do admin.
 * Co-mestre recebe só as campanhas para as quais foi convidado.
 */
export function useAdminCampaigns() {
  const [remote, setRemote] = useState<Campaign[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    return campaignService.subscribeToScopedCampaigns(
      (list) => {
        setRemote(list);
        setFailed(false);
      },
      () => setFailed(true),
    );
  }, []);

  const campaigns = useMemo(() => {
    const source = remote ?? [];
    return [...source].sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id, 'pt-BR'));
  }, [remote]);

  return {
    campaigns,
    ready: remote !== null || failed,
  };
}
