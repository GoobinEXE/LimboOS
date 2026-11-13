import React from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Activity, Archive, ArrowLeft, ArrowRight, Compass, MapPin, Menu, MonitorSmartphone, Shuffle, ArrowDown, ArrowLeftRight, ArrowUp, ArrowUpFromLine, AudioLines, Award, Ban, Bell, Braces,
  CalendarCheck, Cast, Check, ChevronDown, ChevronRight, ChevronsRight, ChevronUp, Circle, CircleAlert,
  CircleCheck, CircleHelp, CirclePlay, CirclePlus, Clock, CloudCheck, CloudUpload, Contact, Copy, Crosshair,
  Disc3, Download, Ellipsis, Eraser, EyeOff, FileText, FileUp, Flag, Folder, FolderMinus, FolderOpen,
  FolderPlus, FolderX, Gamepad2, Globe, Grid2x2, Headphones, Heart, IdCard, Image, Images, Info, KeyRound,
  Laptop, LayoutGrid, Link2, List, ListChecks, ListFilter, ListMusic, Loader, Loader2, Lock, LockOpen, Map,
  Medal, MessageSquare, MessageSquareWarning, Minus, Moon, Music, Music2, Network, NotebookPen, Package, Pause,
  Pencil, Play, Plus, Pointer, QrCode, Radar, Radio, ReceiptText, RefreshCw, Repeat1, Rocket, Save, Search,
  SearchX, Settings, Shield, ShieldAlert, ShieldCheck, ShieldUser, Skull, SlidersHorizontal, Smartphone,
  Sparkles, Square, SquareCheck, SquarePlus, Table, Terminal, ToggleLeft, ToggleRight, Trash, Trash2, TrendingUp,
  TriangleAlert, Trophy, Unlink, UserCog, UserPlus, Users, UsersRound, UserX, Video, Wand2, Wifi, Wrench, X,
} from 'lucide-react';

/**
 * Ícones do admin: nomes do antigo Material Symbols mapeados para lucide.
 * O SVG mede 1em, então as classes text-* existentes continuam definindo o tamanho.
 */
const ICONS: Record<string, LucideIcon> = {
  add: Plus, add_box: SquarePlus, add_circle: CirclePlus, add_link: Link2, adjust: Crosshair, album: Disc3,
  analytics: Activity, apps: LayoutGrid, archive: Archive, arrow_downward: ArrowDown, arrow_forward_ios: ChevronRight,
  arrow_upward: ArrowUp, audiotrack: Music, auto_fix: Wand2, badge: IdCard, bedtime: Moon, block: Ban, build: Wrench,
  cast: Cast, check: Check, check_box: SquareCheck, check_box_outline_blank: Square, check_circle: CircleCheck,
  checklist: ListChecks, close: X, cloud_done: CloudCheck, cloud_upload: CloudUpload, contacts: Contact,
  content_copy: Copy, create_new_folder: FolderPlus, data_object: Braces, delete: Trash2, delete_forever: Trash,
  delete_sweep: Eraser, description: FileText, double_arrow: ChevronsRight, download: Download, downloading: Loader,
  edit: Pencil, edit_note: NotebookPen, eject: ArrowUpFromLine, emoji_events: Trophy, equalizer: AudioLines,
  error: CircleAlert, event_available: CalendarCheck, expand_less: ChevronUp, expand_more: ChevronDown,
  favorite: Heart, filter_list: ListFilter, flag: Flag, folder: Folder, folder_delete: FolderX, folder_off: FolderMinus,
  folder_open: FolderOpen, grid_view: Grid2x2, group: Users, group_add: UserPlus, group_off: UserX, groups: UsersRound,
  groups_2: UsersRound, headphones: Headphones, help: CircleHelp, hub: Network, image: Image, info: Info,
  inventory_2: Package, key: KeyRound, vpn_key: KeyRound, laptop_mac: Laptop, leaderboard: Award, library_music: ListMusic,
  link_off: Unlink, list: List, lock: Lock, lock_open: LockOpen, manage_accounts: UserCog, map: Map,
  military_tech: Medal, more_vert: Ellipsis, music_note: Music2, notifications: Bell, pause: Pause, perm_media: Images,
  person: Users, person_add: UserPlus, person_off: UserX, person_play: Gamepad2, photo_library: Images, play_arrow: Play,
  play_circle: CirclePlay, playlist_play: ListMusic, progress_activity: Loader2, public: Globe, qr_code: QrCode,
  qr_code_2: QrCode, queue_music: ListMusic, radar: Radar, radio_button_unchecked: Circle, receipt_long: ReceiptText,
  remove: Minus, repeat_one: Repeat1, report: MessageSquareWarning, rocket_launch: Rocket, save: Save, schedule: Clock,
  search: Search, search_off: SearchX, security: ShieldCheck, sensors: Radio, settings: Settings, shield: Shield,
  skull: Skull, smartphone: Smartphone, sms: MessageSquare, sports_esports: Gamepad2, stars: Sparkles, stop: Square,
  swap_horiz: ArrowLeftRight, sync: RefreshCw, table_chart: Table, terminal: Terminal, timeline: Activity,
  toggle_off: ToggleLeft, toggle_on: ToggleRight, touch_app: Pointer, trending_up: TrendingUp, tune: SlidersHorizontal,
  upload_file: FileUp, videocam: Video, warning: TriangleAlert, wifi_tethering: Wifi, workspace_premium: Award,
  keyboard_arrow_up: ChevronUp, keyboard_arrow_down: ChevronDown, chevron_right: ChevronRight, arrow_forward: ArrowRight,
  arrow_back: ArrowLeft, shuffle: Shuffle, travel_explore: Compass, location_on: MapPin, devices: MonitorSmartphone, menu: Menu,
  manage_search: Search, visibility_off: EyeOff, shield_person: ShieldUser, alert: ShieldAlert,
};

interface MIconProps extends Omit<React.SVGProps<SVGSVGElement>, 'ref' | 'fill'> {
  name: string;
  /** Equivalente ao FILL 1 do Material: preenche a forma com a cor do texto. */
  fill?: boolean;
  className?: string;
}

export default function MIcon({ name, fill, className = '', ...rest }: MIconProps) {
  const Icon = ICONS[name];
  if (!Icon) {
    if (import.meta.env.DEV) console.warn(`[MIcon] ícone sem correspondência: ${name}`);
    return <span aria-hidden className={`inline-block w-[1em] h-[1em] shrink-0 ${className}`} />;
  }
  return (
    <Icon
      aria-hidden
      width="1em"
      height="1em"
      strokeWidth={1.9}
      fill={fill ? 'currentColor' : 'none'}
      className={`inline-block shrink-0 ${className}`}
      {...rest}
    />
  );
}
