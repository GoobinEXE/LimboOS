import { Timestamp } from 'firebase/firestore';

export type MediaType = 'audio' | 'image' | 'video' | 'document' | 'other';

/** Pasta da biblioteca admin. Membership de assets usa `metadata.tags` = lista de folder IDs. */
export interface MediaFolder {
  id: string;
  name: string;
  /** Preenchido = pasta espelhada de uma campanha (não apagável enquanto a campanha existir). */
  campaignId?: string | null;
  createdAt: Timestamp | Date;
  updatedAt?: Timestamp | Date;
}

export interface MediaAsset {
  id: string;
  filename: string;
  originalName: string;
  url: string;
  storagePath: string;
  mimeType: string;
  size: number;
  type: MediaType;
  uploadedAt: Timestamp | Date;
  uploadedBy: string; // codename or uid
  metadata: {
    title?: string;
    description?: string;
    artist?: string;      // Artist/Creator
    duration?: number; // for audio/video
    width?: number;    // for images
    height?: number;   // for images
    category?: string;
    /** IDs de `mediaFolders` — uma mídia pode estar em várias pastas. */
    tags?: string[];
  };
}
