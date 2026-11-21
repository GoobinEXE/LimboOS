export type AllocationMode = 'batch' | 'instant';
export type SlotStatus = 'pending' | 'submitted' | 'revealed';
export type SheetContentFormat = 'markdown' | 'plain';
export type TieBreakResolutionKind = 'word_order' | 'crypto_random';

export interface OracleScoringRules {
  questionPrimaryPoints: number;
  questionSecondaryPoints: number;
  wordMatchPoints: number;
  wordPairSyncBonus: number;
  requiredWordCount: number;
  specificityBonus: number;
  coherenceBonus: number;
  normalizeScores: boolean;
  unexpectedThreshold: number;
}

export interface OracleIntakeField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'number';
  required: boolean;
  placeholder: string;
  maxLength?: number;
}

export interface OracleStatEntry {
  id: string;
  label: string;
  value: string;
  note?: string;
}

export interface OracleTrait {
  name: string;
  description: string;
}

export interface OracleAbility {
  id: string;
  name: string;
  category: string;
  cost: string;
  description: string;
}

export interface OracleFlavorField {
  id: string;
  label: string;
  placeholder: string;
  hint?: string;
}

export interface OracleDocumentAttachment {
  url: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  size?: number;
  pageRange?: string;
}

export interface OracleSheet {
  id: string;
  name: string;
  origin?: string;
  subtitle?: string;
  summary?: string;
  revealNarrative?: string;
  unexpectedNarrative?: string;
  themeColor?: string;
  /** Formato do texto livre da ficha (Markdown ou texto simples). */
  contentFormat?: SheetContentFormat;
  /** Corpo livre em texto simples ou Markdown (.md). */
  body?: string;
  /** PDF ou arquivo anexado individualmente a esta ficha. */
  attachment?: OracleDocumentAttachment | null;
  /** Quando true, exibe também o PDF compartilhado do modelo (com pageRange opcional). */
  useSharedDocument?: boolean;
  /** Indicação opcional de páginas/seção dentro do PDF (ex.: "Págs. 4–6"). */
  sharedPageRange?: string;
  /** Blocos estruturados opcionais — só aparecem na ficha se preenchidos. */
  attributes: OracleStatEntry[];
  derivedStats: { id: string; label: string; value: string }[];
  traits: OracleTrait[];
  abilities: OracleAbility[];
  flavorFields: OracleFlavorField[];
}

export interface OracleQuestionOption {
  id: string;
  text: string;
  primary?: string | null;
  secondary?: string | null;
  /** Pesos decimais explícitos por ficha (até 4 casas). Quando preenchido, substitui primary/secondary. */
  weights?: Record<string, number> | null;
}

export interface OracleQuestion {
  id: string;
  prompt: string;
  /** Multiplicador decimal da pergunta (até 4 casas; padrão 1.0000). */
  weight?: number;
  options: OracleQuestionOption[];
}

export interface OracleSyncWord {
  id: string;
  label: string;
  sheetId: string;
  /** Peso decimal opcional da palavra (até 4 casas; padrão = scoringRules.wordMatchPoints). */
  weight?: number | null;
}

export interface OracleCopy {
  accessPrompt: string;
  intakePhaseTitle: string;
  quizPhaseTitle: string;
  wordsPhaseTitle: string;
  waitPhaseTitle: string;
  dossierPhaseTitle: string;
  unexpectedBadge: string;
}

export interface OracleTemplate {
  id: string;
  name: string;
  rpgSystem: string;
  description: string;
  campaignIds: string[] | 'global';
  codePrefix: string;
  scoringRules: OracleScoringRules;
  sharedDocument?: OracleDocumentAttachment | null;
  intakeFields: OracleIntakeField[];
  sheets: OracleSheet[];
  questions: OracleQuestion[];
  syncWords: OracleSyncWord[];
  copy: OracleCopy;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface OracleTieBreakContender {
  slotCode: string;
  sheetId: string;
  score: number;
  wordHits: number;
  wordPositions: number[];
  won: boolean;
}

export interface OracleTieBreakAudit {
  resolution: TieBreakResolutionKind;
  reason: string;
  contenders?: OracleTieBreakContender[];
  candidates?: string[];
  winnerId?: string;
}

export interface OracleAuditEntry {
  at: string;
  kind:
    | 'session_created'
    | 'slot_submitted'
    | 'instant_assigned'
    | 'batch_resolved'
    | 'tie_break'
    | 'slot_reset'
    | 'slot_added';
  slotCode?: string;
  actorUid?: string;
  message: string;
  details?: OracleTieBreakAudit | null;
}

export interface OracleSlot {
  slotCode: string;
  label?: string | null;
  status: SlotStatus;
  locked: boolean;
  linkedUid?: string | null;
  intakeData: Record<string, string> | null;
  answers: Record<string, string> | null;
  /** Palavras selecionadas na ordem exata de clique (1ª, 2ª, 3ª...). */
  selectedWordIds: string[];
  scores: Record<string, number> | null;
  ranking: string[] | null;
  wordHits?: Record<string, number> | null;
  wordPositions?: Record<string, number[]> | null;
  matchedPairs?: string[];
  assignedSheetId: string | null;
  affinityScore: number | null;
  isUnexpectedAssignment: boolean;
  customFlavor: Record<string, string>;
  submittedAt: string | null;
  flavorUpdatedAt?: string | null;
}

export interface OracleBatchMetrics {
  totalScore: number;
  minScore: number;
  firstChoicesHit: number;
  totalWordHits: number;
}

export interface OracleSession {
  id: string;
  wsId: string;
  title: string;
  campaignId: string | null;
  templateId: string;
  templateSnapshot: OracleTemplate;
  mode: AllocationMode;
  autoResolve: boolean;
  maxPlayers: number;
  codePrefix: string;
  version: number;
  resolved: boolean;
  resolvedAt?: unknown;
  resolutionMetrics?: OracleBatchMetrics | null;
  availablePool: string[];
  slots: Record<string, OracleSlot>;
  auditLog: OracleAuditEntry[];
  createdBy?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PublicOracleQuestion {
  id: string;
  prompt: string;
  options: { id: string; text: string }[];
}

export interface PublicOracleWord {
  id: string;
  label: string;
}

export interface PublicOracleSlotResponse {
  found: boolean;
  slotCode?: string;
  slotLabel?: string | null;
  sessionTitle?: string;
  rpgSystem?: string;
  mode?: AllocationMode;
  status?: SlotStatus;
  locked?: boolean;
  resolved?: boolean;
  submittedCount?: number;
  totalSlots?: number;
  requiredWordCount?: number;
  copy?: OracleCopy;
  intakeFields?: OracleIntakeField[];
  intakeData?: Record<string, string> | null;
  submittedAt?: string | null;
  // Quando pending (100% cego — sem gabarito, sem pesos, sem anexos)
  questions?: PublicOracleQuestion[];
  syncWords?: PublicOracleWord[];
  // Quando revealed
  sheet?: OracleSheet | null;
  sharedDocument?: OracleDocumentAttachment | null;
  affinityScore?: number;
  isUnexpectedAssignment?: boolean;
  customFlavor?: Record<string, string>;
  matchedPairs?: string[];
}
