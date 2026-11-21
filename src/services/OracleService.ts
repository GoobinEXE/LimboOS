import {
  deleteDoc,
  serverTimestamp,
  setDoc,
  type DocumentData,
} from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../lib/firebase';
import { callFunction } from '../lib/functions';
import {
  listScopeFromFirestore,
  listScopeToFirestore,
  requireTenantScope,
  subscribeScoped,
  wsDoc,
} from '../lib/tenantScope';
import type {
  AllocationMode,
  OracleBatchMetrics,
  OracleDocumentAttachment,
  OracleSession,
  OracleTemplate,
  OracleTieBreakAudit,
  PublicOracleSlotResponse,
} from '../types/oracle';

const TEMPLATES_COL = 'oracleTemplates';
const SESSIONS_COL = 'oracleSessions';

function stripUndefined<T>(value: T): T {
  if (value === undefined) return null as T;
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(stripUndefined) as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v !== undefined) out[k] = stripUndefined(v);
  }
  return out as T;
}

function toMillis(ts: unknown): number {
  if (!ts) return 0;
  if (typeof (ts as { toMillis?: () => number }).toMillis === 'function') {
    return (ts as { toMillis: () => number }).toMillis();
  }
  if (ts instanceof Date) return ts.getTime();
  return 0;
}

function normalizeTemplate(id: string, data: DocumentData): OracleTemplate {
  const sr = data.scoringRules || {};
  return {
    id,
    name: String(data.name ?? id),
    rpgSystem: String(data.rpgSystem ?? ''),
    description: String(data.description ?? ''),
    campaignIds: listScopeFromFirestore(data),
    codePrefix: String(data.codePrefix ?? 'ORC'),
    sharedDocument: data.sharedDocument ?? null,
    scoringRules: {
      questionPrimaryPoints: Number(sr.questionPrimaryPoints ?? 2),
      questionSecondaryPoints: Number(sr.questionSecondaryPoints ?? 0.75),
      wordMatchPoints: Number(sr.wordMatchPoints ?? 1),
      wordPairSyncBonus: Number(sr.wordPairSyncBonus ?? 0.5),
      requiredWordCount: Number(sr.requiredWordCount ?? 0),
      specificityBonus: Number(sr.specificityBonus ?? 0.15),
      coherenceBonus: Number(sr.coherenceBonus ?? 0.35),
      normalizeScores: sr.normalizeScores !== false,
      unexpectedThreshold: Number(sr.unexpectedThreshold ?? 0),
    },
    intakeFields: Array.isArray(data.intakeFields) ? data.intakeFields : [],
    sheets: Array.isArray(data.sheets) ? data.sheets : [],
    questions: Array.isArray(data.questions) ? data.questions : [],
    syncWords: Array.isArray(data.syncWords) ? data.syncWords : [],
    copy: data.copy || {
      accessPrompt: '',
      intakePhaseTitle: '',
      quizPhaseTitle: '',
      wordsPhaseTitle: '',
      waitPhaseTitle: '',
      dossierPhaseTitle: '',
      unexpectedBadge: '',
    },
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

function normalizeSession(id: string, data: DocumentData): OracleSession {
  return {
    id,
    wsId: String(data.wsId ?? ''),
    title: String(data.title ?? id),
    campaignId: typeof data.campaignId === 'string' ? data.campaignId : null,
    templateId: String(data.templateId ?? ''),
    templateSnapshot: data.templateSnapshot,
    mode: data.mode === 'instant' ? 'instant' : 'batch',
    autoResolve: Boolean(data.autoResolve),
    maxPlayers: Number(data.maxPlayers ?? 0),
    codePrefix: String(data.codePrefix ?? 'ORC'),
    version: Number(data.version ?? 1),
    resolved: Boolean(data.resolved),
    resolvedAt: data.resolvedAt ?? null,
    resolutionMetrics: data.resolutionMetrics ?? null,
    availablePool: Array.isArray(data.availablePool) ? data.availablePool : [],
    slots: data.slots || {},
    auditLog: Array.isArray(data.auditLog) ? data.auditLog : [],
    createdBy: typeof data.createdBy === 'string' ? data.createdBy : undefined,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export function normalizeOracleCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
}

export function oracleSlotUrl(slotCode: string): string {
  return `${window.location.origin}/oraculo/${encodeURIComponent(normalizeOracleCode(slotCode))}`;
}

class OracleService {
  private static instance: OracleService;

  private constructor() {}

  public static getInstance(): OracleService {
    if (!OracleService.instance) {
      OracleService.instance = new OracleService();
    }
    return OracleService.instance;
  }

  // ── Mestre: Modelos e Documentos ──────────────────────────────────

  subscribeTemplates(
    onTemplates: (list: OracleTemplate[]) => void,
    onError?: (err: Error) => void,
  ): () => void {
    return subscribeScoped(
      TEMPLATES_COL,
      'list',
      [],
      (docs) => {
        const list = docs
          .map((d) => normalizeTemplate(d.id, d.data()))
          .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
        onTemplates(list);
      },
      onError,
    );
  }

  async saveTemplate(template: OracleTemplate): Promise<void> {
    const {
      id,
      campaignIds,
      createdAt,
      updatedAt: _upd,
      ...rest
    } = template;
    const docId = id.trim() || `oraculo-${Date.now()}`;
    const payload = stripUndefined({
      ...rest,
      ...listScopeToFirestore(campaignIds),
      createdAt: createdAt || serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await setDoc(wsDoc(TEMPLATES_COL, docId), payload, { merge: true });
  }

  async deleteTemplate(templateId: string): Promise<void> {
    await deleteDoc(wsDoc(TEMPLATES_COL, templateId));
  }

  async uploadDocument(
    file: File,
    templateId: string,
  ): Promise<OracleDocumentAttachment> {
    const { wsId } = requireTenantScope();
    const safeTemplate = templateId.replace(/[^a-zA-Z0-9_-]/g, '') || 'geral';
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'documento.pdf';
    const storagePath = `workspaces/${wsId}/oracle/${safeTemplate}/${Date.now()}-${safeName}`;

    let contentType = file.type;
    if (!contentType) {
      if (file.name.toLowerCase().endsWith('.pdf')) contentType = 'application/pdf';
      else if (file.name.toLowerCase().endsWith('.md')) contentType = 'text/markdown';
      else contentType = 'text/plain';
    }

    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, file, { contentType });
    const url = await getDownloadURL(storageRef);

    return {
      url,
      storagePath,
      fileName: file.name,
      mimeType: contentType,
      size: file.size,
      pageRange: '',
    };
  }

  async deleteDocument(storagePath: string): Promise<void> {
    if (!storagePath) return;
    try {
      await deleteObject(ref(storage, storagePath));
    } catch {
      /* arquivo já removido ou indisponível */
    }
  }

  // ── Mestre: Sessões ───────────────────────────────────────────────

  subscribeSessions(
    onSessions: (list: OracleSession[]) => void,
    onError?: (err: Error) => void,
  ): () => void {
    return subscribeScoped(
      SESSIONS_COL,
      'single',
      [],
      (docs) => {
        const list = docs
          .map((d) => normalizeSession(d.id, d.data()))
          .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
        onSessions(list);
      },
      onError,
    );
  }

  async createSession(input: {
    campaignId: string | null;
    templateId?: string;
    templateData?: OracleTemplate;
    title: string;
    mode: AllocationMode;
    slotCount: number;
    codePrefix?: string;
    autoResolve?: boolean;
    slotLabels?: string[];
  }): Promise<{ success: boolean; sessionId: string; slotCodes: string[] }> {
    const { wsId } = requireTenantScope();
    const cleanedTemplate = input.templateData
      ? stripUndefined({
          ...input.templateData,
          createdAt: undefined,
          updatedAt: undefined,
        })
      : undefined;
    return callFunction('oracleCreateSession', {
      wsId,
      campaignId: input.campaignId,
      templateId: input.templateId,
      templateData: cleanedTemplate,
      title: input.title,
      mode: input.mode,
      slotCount: input.slotCount,
      codePrefix: input.codePrefix,
      autoResolve: input.autoResolve,
      slotLabels: input.slotLabels,
    });
  }

  async resolveSession(sessionId: string): Promise<{
    success: boolean;
    metrics: OracleBatchMetrics;
    tieBreakAudit: OracleTieBreakAudit | null;
  }> {
    const { wsId } = requireTenantScope();
    return callFunction('oracleResolveSession', { wsId, sessionId });
  }

  async resetSlot(sessionId: string, slotCode: string): Promise<void> {
    const { wsId } = requireTenantScope();
    await callFunction('oracleResetSlot', { wsId, sessionId, slotCode });
  }

  async addSlot(sessionId: string, label?: string): Promise<{ success: boolean; slotCode: string }> {
    const { wsId } = requireTenantScope();
    return callFunction('oracleAddSlot', { wsId, sessionId, label });
  }

  async deleteSession(sessionId: string): Promise<void> {
    const { wsId } = requireTenantScope();
    await callFunction('oracleDeleteSession', { wsId, sessionId });
  }

  // ── Jogador (público por slotCode) ────────────────────────────────

  async getSlot(slotCode: string): Promise<PublicOracleSlotResponse> {
    return callFunction('oracleGetSlot', { slotCode: normalizeOracleCode(slotCode) });
  }

  async submitSlot(input: {
    slotCode: string;
    intakeData: Record<string, string>;
    answers: Record<string, string>;
    selectedWordIds: string[];
  }): Promise<PublicOracleSlotResponse> {
    return callFunction('oracleSubmitSlot', {
      ...input,
      slotCode: normalizeOracleCode(input.slotCode),
    });
  }

  async saveFlavor(
    slotCode: string,
    customFlavor: Record<string, string>,
  ): Promise<{ success: boolean; customFlavor: Record<string, string> }> {
    return callFunction('oracleSaveFlavor', {
      slotCode: normalizeOracleCode(slotCode),
      customFlavor,
    });
  }
}

export const oracleService = OracleService.getInstance();
