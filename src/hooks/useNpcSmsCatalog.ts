import { useEffect, useState } from 'react';
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

  const enabledContacts = snap.contacts.filter((c) => c.enabled !== false);
  const enabledDialogues = snap.dialogues.filter((d) => d.enabled !== false);

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
