import type { NpcContact, NpcDialogue, NpcSmsDialogueLegacy } from '../types/npcSms';

/** Pack de sugestões — importável pelo admin (não é catálogo obrigatório em runtime). */
/**
 * Sugestões de NPC importáveis por qualquer mestre. Os contatos e diálogos da
 * lore Last Rewind (Bocão, Mai, Jaden, Joe, Nil) saíram do bundle e ficam em
 * backend/scripts/legacy-seed/npc*.json, usados só na migração da pasta original.
 */
export const SUGGESTED_NPC_CONTACTS: NpcContact[] = [];

export const SUGGESTED_NPC_DIALOGUES: NpcDialogue[] = [];

/** Forma legada denormalizada para consumidores que ainda esperam npcName/npcNumber. */
export function toLegacyDialogue(
  dialogue: NpcDialogue,
  contact: Pick<NpcContact, 'name' | 'number'> | undefined,
): NpcSmsDialogueLegacy {
  return {
    id: dialogue.id,
    npcId: dialogue.npcId,
    npcName: contact?.name || dialogue.npcId,
    npcNumber: contact?.number || '',
    title: dialogue.title,
    messages: dialogue.messages,
  };
}

/** @deprecated use SUGGESTED_NPC_* + NpcSmsCatalogService */
export type NpcSmsMessage = { speaker: 'npc' | 'player'; text: string };
/** @deprecated */
export type NpcSmsDialogue = NpcSmsDialogueLegacy;

/** @deprecated snapshot estático — preferir catálogo remoto */
export const npcMessages: Record<string, NpcSmsDialogueLegacy[]> = (() => {
  const contacts = new Map(SUGGESTED_NPC_CONTACTS.map((c) => [c.id, c]));
  const map: Record<string, NpcSmsDialogueLegacy[]> = {};
  for (const d of SUGGESTED_NPC_DIALOGUES) {
    if (!map[d.npcId]) map[d.npcId] = [];
    map[d.npcId].push(toLegacyDialogue(d, contacts.get(d.npcId)));
  }
  return map;
})();
