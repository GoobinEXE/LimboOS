export type NpcSmsSpeaker = 'npc' | 'player';

export interface NpcSmsTurn {
  speaker: NpcSmsSpeaker;
  text: string;
}

export type NpcDefSource = 'custom' | 'suggestion';

/** Contato NPC persistido em `npcContacts/{id}`. */
export interface NpcContact {
  id: string;
  name: string;
  number: string;
  avatarUrl?: string;
  campaignIds: string[] | 'global';
  enabled: boolean;
  source: NpcDefSource;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type NpcContactInput = Omit<NpcContact, 'createdAt' | 'updatedAt'>;

/** Diálogo SMS persistido em `npcDialogues/{id}`. */
export interface NpcDialogue {
  id: string;
  npcId: string;
  title: string;
  messages: NpcSmsTurn[];
  enabled: boolean;
  source: NpcDefSource;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type NpcDialogueInput = Omit<NpcDialogue, 'createdAt' | 'updatedAt'>;

/** Mensagem em `groups/{groupId}/messages/{messageId}`. */
export interface GroupMessage {
  id: string;
  senderId: string;
  senderName?: string;
  senderNumber?: string;
  text: string;
  recipientId?: string;
  recipientName?: string;
  recipientNumber?: string;
  createdAt: unknown;
  /** ID do diálogo do catálogo (distribuição scripted). */
  dialogueId?: string;
  /** ID do NPC (quando a mensagem faz parte de um script). */
  npcId?: string;
  /** Preenchido no client ao agregar inbox. */
  _groupId?: string;
}

/** Forma legada usada em distribuição (nome/número denormalizados). */
export interface NpcSmsDialogueLegacy {
  id: string;
  npcId: string;
  npcName: string;
  npcNumber: string;
  title: string;
  messages: NpcSmsTurn[];
}
