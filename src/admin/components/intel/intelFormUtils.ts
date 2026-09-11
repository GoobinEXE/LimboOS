import type { IntelItem, IntelType, AccessLevel, VisualCategory, VideoFormat } from '../../../types/intel';
import { isYoutubeUrl } from '../../../lib/youtube';
import { INTEL_TYPE_OPTIONS } from '../../lib/intelDisplay';

export const TYPE_OPTIONS = INTEL_TYPE_OPTIONS;

export const LEVEL_OPTIONS: { value: AccessLevel; label: string }[] = [
  { value: 1, label: 'RESTRITO' },
  { value: 2, label: 'CONFIDENCIAL' },
  { value: 3, label: 'SIGILOSO' },
  { value: 4, label: 'TOP SECRET' },
];

export const CATEGORY_OPTIONS: VisualCategory[] = ['locais', 'pistas', 'pessoas', 'itens'];

export const EMPTY_ITEM: Omit<IntelItem, 'id'> = {
  type: 'TEXT',
  level: 2,
  title: '',
  description: '',
  textContent: '',
  mediaUrl: '',
  campaignId: undefined,
  metadata: {
    npc: '',
    artist: '',
    chapter: '',
    duration: 0,
    isSecret: false,
    videoFormat: 'VHS' as VideoFormat,
  },
};

export type IntelFormData = Omit<IntelItem, 'id'> & { id: string };

/** Gera um ID estável a partir do título (slug). */
export const slugifyIntelId = (title: string): string => {
  const base = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return base || `item_${Date.now()}`;
};

export const detectTypeFromUrl = (url: string): IntelType => {
  const cleanUrl = url.split('?')[0];
  const ext = cleanUrl.split('.').pop()?.toLowerCase();
  if (!ext) return 'TEXT';
  if (['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext)) return 'AUDIO';
  if (['mp4', 'webm', 'mov', 'mkv'].includes(ext)) return 'VIDEO';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'VISUAL';
  if (['txt'].includes(ext)) return 'TEXT';
  return 'TEXT';
};

export const detectTypeFromUrlWithYoutube = (url: string): IntelType => {
  if (isYoutubeUrl(url)) return 'VIDEO';
  return detectTypeFromUrl(url);
};
