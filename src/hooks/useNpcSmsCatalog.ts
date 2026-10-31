import { useEffect, useMemo, useState } from 'react';
import type { NpcContact, NpcDialogue } from '../types/npcSms';
import {
  npcSmsCatalogService,
  type NpcSmsCatalogSnapshot,
} from '../services/NpcSmsCatalogService';

export function useNpcSmsCatalog() {
  const [snap, setSnap] = useState<NpcSmsCatalogSnapshot>(() =>
    npcSmsCatalogService.getSnapshot(),
  );

  useEffect(() => {
    return npcSmsCatalogService.subscribe(setSnap);
  }, []);

  // Memoizado: consumidores usam estas listas como dependência de efeitos
  const enabledContacts = useMemo(
    () => snap.contacts.filter((c) => c.enabled !== false),
    [snap.contacts],
  );
  const enabledDialogues = useMemo(
    () => snap.dialogues.filter((d) => d.enabled !== false),
    [snap.dialogues],
  );

  return {
    contacts: snap.contacts,
    dialogues: snap.dialogues,
    enabledContacts,
    enabledDialogues,
    isRemote: snap.isRemote,
    hasRemoteContacts: npcSmsCatalogService.hasRemoteContacts(),
    hasRemoteDialogues: npcSmsCatalogService.hasRemoteDialogues(),
    getContact: (id: string): NpcContact | undefined =>
      snap.contacts.find((c) => c.id === id),
    getDialoguesForNpc: (npcId: string): NpcDialogue[] =>
      snap.dialogues.filter((d) => d.npcId === npcId),
  };
}
