import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Campaign, campaigns as seedCampaigns } from '../../data/campaigns';

/**
 * Lista viva de campanhas para seletores e filtros do admin.
 *
 * O Firestore é a fonte de verdade: o seed local só entra quando a coleção
 * ainda está vazia ou o listener falhou. Mesclar os dois sempre (como os
 * seletores antigos faziam) ressuscitava missões apagadas pelo mestre.
 */
export function useAdminCampaigns() {
  const [remote, setRemote] = useState<Campaign[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    return onSnapshot(
      collection(db, 'campaigns'),
      (snap) => {
        setRemote(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Campaign)));
        setFailed(false);
      },
      (err) => {
        console.warn('[useAdminCampaigns] campaigns listener error:', err);
        setFailed(true);
      },
    );
  }, []);

  const campaigns = useMemo(() => {
    const source = remote && remote.length > 0 ? remote : seedCampaigns;
    return [...source].sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id, 'pt-BR'));
  }, [remote]);

  return {
    campaigns,
    ready: remote !== null || failed,
    usingSeed: !remote || remote.length === 0,
  };
}
