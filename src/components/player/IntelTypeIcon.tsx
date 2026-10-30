import { CassetteTape, Camera, FileText, Save, Trophy, Tv, type LucideIcon } from 'lucide-react';

// Ícone vetorial por tipo de intel: emoji muda de desenho a cada sistema operacional
const ICONS: Record<string, LucideIcon> = {
  AUDIO: CassetteTape,
  TEXT: Save,
  VISUAL: Camera,
  META: Trophy,
  VIDEO: Tv,
};

export default function IntelTypeIcon({
  type,
  size = 16,
  className,
}: {
  type: string;
  size?: number;
  className?: string;
}) {
  const Icon = ICONS[type] ?? FileText;
  return <Icon size={size} strokeWidth={1.75} className={className} aria-hidden />;
}
