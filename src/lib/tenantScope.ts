import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  type CollectionReference,
  type DocumentData,
  type DocumentReference,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';

/**
 * Pasta ativa da sessão. O painel define a pasta do mestre (dono ou co-mestre);
 * o jogador define a pasta do agente ativo. Todos os serviços que leem ou gravam
 * conteúdo de mesa passam por aqui, nunca por coleções globais.
 */
export interface TenantScope {
  wsId: string;
  role: 'owner' | 'cogm' | 'player';
  /** Campanhas acessíveis: null = todas (dono). Co-mestre e jogador têm lista. */
  campaignIds: string[] | null;
  workspaceName?: string;
  /** Jogador: agente ativo (as Functions descobrem a pasta por ele). */
  characterId?: string;
  /** Jogador: campanha ativa do agente (playEvents e logs levam essa campanha). */
  activeCampaignId?: string;
  /** Quem está agindo (para logs). */
  actorUid?: string;
  actorName?: string;
}

let current: TenantScope | null = null;
const listeners = new Set<(scope: TenantScope | null) => void>();

export function setTenantScope(scope: TenantScope | null): void {
  const same =
    current?.wsId === scope?.wsId
    && current?.role === scope?.role
    && current?.characterId === scope?.characterId
    && JSON.stringify(current?.campaignIds ?? null) === JSON.stringify(scope?.campaignIds ?? null);
  current = scope;
  if (!same) listeners.forEach((fn) => fn(scope));
}

export function getTenantScope(): TenantScope | null {
  return current;
}

export function onTenantScopeChange(fn: (scope: TenantScope | null) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export class NoTenantScopeError extends Error {
  constructor() {
    super('Nenhuma pasta ativa nesta sessão.');
    this.name = 'NoTenantScopeError';
  }
}

export function requireTenantScope(): TenantScope {
  if (!current) throw new NoTenantScopeError();
  return current;
}

export function requireWsId(): string {
  return requireTenantScope().wsId;
}

export function isCoGmScope(scope: TenantScope | null = current): boolean {
  return scope?.role === 'cogm';
}

export function isOwnerScope(scope: TenantScope | null = current): boolean {
  return scope?.role === 'owner';
}

/** A sessão pode ver/editar a campanha? (dono: todas) */
export function scopeCoversCampaign(campaignId: string | null | undefined, scope = current): boolean {
  if (!scope) return false;
  if (scope.campaignIds === null) return true;
  return !!campaignId && scope.campaignIds.includes(campaignId);
}

/** Campanhas que entram nos filtros de consulta (null = sem filtro). */
export function scopeCampaignFilter(scope = current): string[] | null {
  return scope?.campaignIds ?? null;
}

/**
 * Contexto que as Cloud Functions de QR/mídia esperam: o agente ativo (jogador)
 * ou a pasta (mestre). Sem pasta ativa, nada.
 */
export function functionScopeArgs(scope = current): { characterId: string } | { wsId: string } | Record<string, never> {
  if (!scope) return {};
  if (scope.role === 'player') return scope.characterId ? { characterId: scope.characterId } : {};
  return { wsId: scope.wsId };
}

// ---------------------------------------------------------------------------
// Referências dentro da pasta
// ---------------------------------------------------------------------------

export function wsCollection(name: string, ...rest: string[]): CollectionReference<DocumentData> {
  return collection(db, 'workspaces', requireWsId(), name, ...rest);
}

export function wsDoc(name: string, id: string, ...rest: string[]): DocumentReference<DocumentData> {
  return doc(db, 'workspaces', requireWsId(), name, id, ...rest);
}

export function workspaceDoc(wsId = requireWsId()): DocumentReference<DocumentData> {
  return doc(db, 'workspaces', wsId);
}

/** `workspaces/{ws}/campaigns/{c}/state/{name}`: estado de sessão por campanha. */
export function campaignStateDoc(campaignId: string, name: 'live' | 'settings'): DocumentReference<DocumentData> {
  return doc(db, 'workspaces', requireWsId(), 'campaigns', campaignId, 'state', name);
}

// ---------------------------------------------------------------------------
// Consultas com escopo
// ---------------------------------------------------------------------------

/**
 * Forma do escopo de cada coleção (espelha backend/firestore.rules):
 * - 'list': campaignIds[] + global. Co-mestre: array-contains-any + global == true.
 * - 'single': campaignId único (null = só o dono). Co-mestre: campaignId in [...].
 * - 'owner': só o dono da pasta enxerga.
 */
export type ScopeKind = 'list' | 'single' | 'owner';

const MAX_IN = 30;

function chunk<T>(values: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < values.length; i += size) out.push(values.slice(i, i + size));
  return out;
}

/**
 * Consultas que a sessão pode fazer numa coleção da pasta. Dono: uma consulta com
 * as restrições pedidas. Co-mestre: uma consulta por fatia de campanhas (e uma para
 * os itens globais, em 'list'), sem orderBy, que o chamador aplica no cliente.
 */
export function scopedQueries(
  name: string,
  kind: ScopeKind,
  constraints: QueryConstraint[] = [],
  scope: TenantScope | null = current,
) {
  if (!scope) throw new NoTenantScopeError();
  const col = collection(db, 'workspaces', scope.wsId, name);
  if (scope.campaignIds === null) {
    return [query(col, ...constraints)];
  }
  if (kind === 'owner' || scope.campaignIds.length === 0) return [];
  const filters = constraints.filter((c) => c.type === 'where');
  const queries = chunk(scope.campaignIds, MAX_IN).map((ids) =>
    kind === 'list'
      ? query(col, where('campaignIds', 'array-contains-any', ids), ...filters)
      : query(col, where('campaignId', 'in', ids), ...filters),
  );
  if (kind === 'list') {
    queries.push(query(col, where('global', '==', true), ...filters));
  }
  return queries;
}

/**
 * onSnapshot sobre as consultas com escopo, juntando os resultados por id.
 * O callback recebe os documentos já deduplicados.
 */
export function subscribeScoped(
  name: string,
  kind: ScopeKind,
  constraints: QueryConstraint[],
  onDocs: (docs: QueryDocumentSnapshot<DocumentData>[]) => void,
  onError?: (err: Error) => void,
): () => void {
  let queries;
  try {
    queries = scopedQueries(name, kind, constraints);
  } catch (err) {
    onError?.(err as Error);
    onDocs([]);
    return () => {};
  }
  if (queries.length === 0) {
    onDocs([]);
    return () => {};
  }
  const parts: QueryDocumentSnapshot<DocumentData>[][] = queries.map(() => []);
  const ready = queries.map(() => false);
  const emit = () => {
    if (!ready.every(Boolean)) return;
    const byId = new Map<string, QueryDocumentSnapshot<DocumentData>>();
    parts.flat().forEach((d) => byId.set(d.id, d));
    onDocs(Array.from(byId.values()));
  };
  const unsubs = queries.map((q, i) =>
    onSnapshot(
      q,
      (snap) => {
        parts[i] = snap.docs;
        ready[i] = true;
        emit();
      },
      (err) => {
        ready[i] = true;
        parts[i] = [];
        onError?.(err);
        emit();
      },
    ),
  );
  return () => unsubs.forEach((u) => u());
}

/** Versão de leitura única de `subscribeScoped`. */
export async function getScopedDocs(
  name: string,
  kind: ScopeKind,
  constraints: QueryConstraint[] = [],
): Promise<QueryDocumentSnapshot<DocumentData>[]> {
  const { getDocs } = await import('firebase/firestore');
  const queries = scopedQueries(name, kind, constraints);
  const snaps = await Promise.all(queries.map((q) => getDocs(q)));
  const byId = new Map<string, QueryDocumentSnapshot<DocumentData>>();
  snaps.forEach((s) => s.docs.forEach((d) => byId.set(d.id, d)));
  return Array.from(byId.values());
}

// ---------------------------------------------------------------------------
// Conversão de escopo por lista ('global' no cliente ⇄ global: true no Firestore)
// ---------------------------------------------------------------------------

export function listScopeToFirestore(campaignIds: string[] | 'global'): { campaignIds: string[]; global: boolean } {
  return campaignIds === 'global'
    ? { campaignIds: [], global: true }
    : { campaignIds: [...campaignIds], global: false };
}

export function listScopeFromFirestore(data: DocumentData): string[] | 'global' {
  if (data.global === true || data.campaignIds === 'global') return 'global';
  return Array.isArray(data.campaignIds) ? data.campaignIds : [];
}
