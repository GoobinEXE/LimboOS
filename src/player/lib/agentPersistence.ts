/**
 * F5: persistência por agente (uid + characterId) no navegador.
 * Chave: `limboos.agent.<uid>.<characterId>.<nome>`. Trocar de agente muda a chave,
 * então nada vaza entre agentes na mesma aba. Toda leitura tolera storage indisponível
 * (modo privado, quota) e JSON inválido: devolve o fallback sem lançar.
 */

export type AgentStorageScope = 'local' | 'session';

export interface AgentRef {
  uid: string;
  characterId: string;
}

const PREFIX = 'limboos.agent';

function store(scope: AgentStorageScope): Storage | null {
  try {
    return scope === 'session' ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

export function agentKey(agent: AgentRef, name: string): string {
  return `${PREFIX}.${agent.uid}.${agent.characterId}.${name}`;
}

/** Valor JSON guardado, ou `fallback` se ausente, inválido ou sem acesso ao storage. */
export function readAgentValue<T>(agent: AgentRef | null, name: string, fallback: T, scope: AgentStorageScope = 'local'): T {
  if (!agent) return fallback;
  try {
    const raw = store(scope)?.getItem(agentKey(agent, name));
    if (raw == null) return fallback;
    const parsed = JSON.parse(raw) as unknown;
    return parsed === null || parsed === undefined ? fallback : (parsed as T);
  } catch {
    return fallback;
  }
}

export function writeAgentValue<T>(agent: AgentRef | null, name: string, value: T, scope: AgentStorageScope = 'local'): void {
  if (!agent) return;
  try {
    store(scope)?.setItem(agentKey(agent, name), JSON.stringify(value));
  } catch {
    /* quota cheia ou storage bloqueado: a persistência é só conveniência */
  }
}

export function removeAgentValue(agent: AgentRef | null, name: string, scope: AgentStorageScope = 'local'): void {
  if (!agent) return;
  try {
    store(scope)?.removeItem(agentKey(agent, name));
  } catch {
    /* ignora */
  }
}

/** Nomes usados pelos pacotes (evita string solta). */
export const AGENT_KEYS = {
  tape: 'walkman.tape',
  position: 'walkman.position',
  nokiaTab: 'nokia.activeTab',
  nokiaConv: 'nokia.activeConv',
} as const;

export interface TapePosition {
  intelId: string;
  t: number;
  savedAt: number;
}

export function readTapeId(agent: AgentRef | null): string | null {
  const id = readAgentValue<unknown>(agent, AGENT_KEYS.tape, null);
  return typeof id === 'string' && id ? id : null;
}

export function writeTapeId(agent: AgentRef | null, intelId: string): void {
  writeAgentValue(agent, AGENT_KEYS.tape, intelId);
}

export function clearTapeId(agent: AgentRef | null): void {
  removeAgentValue(agent, AGENT_KEYS.tape);
}

export function readTapePosition(agent: AgentRef | null): TapePosition | null {
  const p = readAgentValue<Partial<TapePosition> | null>(agent, AGENT_KEYS.position, null);
  if (!p || typeof p.intelId !== 'string' || typeof p.t !== 'number' || !Number.isFinite(p.t)) return null;
  return { intelId: p.intelId, t: p.t, savedAt: typeof p.savedAt === 'number' ? p.savedAt : 0 };
}

export function writeTapePosition(agent: AgentRef | null, intelId: string, t: number): void {
  writeAgentValue<TapePosition>(agent, AGENT_KEYS.position, { intelId, t, savedAt: Date.now() });
}

export function clearTapePosition(agent: AgentRef | null): void {
  removeAgentValue(agent, AGENT_KEYS.position);
}
