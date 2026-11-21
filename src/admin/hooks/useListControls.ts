import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOptionalAdminScope } from '../context/AdminScopeContext';

const PREFIX = 'limboos.admin.list.';

interface Persisted {
  query: string;
  sort: string;
  filters: Record<string, string>;
}

export interface ListControlsOptions<T, K extends string> {
  /** Nome do painel (ex.: 'achievements'). A chave final inclui a pasta ativa. */
  storageKey: string;
  defaultSort: K;
  /** Comparadores por chave de ordenação. Chave sem comparador mantém a ordem original. */
  sorters: Record<K, ((a: T, b: T) => number) | null>;
  /** Filtros extras persistidos (ex.: { category: 'all' }). */
  defaultFilters?: Record<string, string>;
}

export interface ListControls<T, K extends string> {
  query: string;
  setQuery: (q: string) => void;
  sortKey: K;
  setSortKey: (k: K) => void;
  filters: Record<string, string>;
  setFilter: (name: string, value: string) => void;
  /** Volta busca, ordem e filtros ao padrão. */
  reset: () => void;
  /** `match(item, queryEmMinusculas)` filtra pela busca (omitido: não filtra); depois ordena. Não muta a lista. */
  apply: (items: T[], match?: (item: T, query: string) => boolean) => T[];
}

function storageName(storageKey: string, wsId: string | undefined): string {
  return `${PREFIX}${wsId ?? 'none'}.${storageKey}`;
}

function read(name: string): Partial<Persisted> | null {
  try {
    const raw = window.sessionStorage.getItem(name);
    return raw ? (JSON.parse(raw) as Partial<Persisted>) : null;
  } catch {
    return null;
  }
}

/**
 * Busca, ordenação e filtros simples de uma lista do admin, guardados em
 * sessionStorage por painel e por pasta (`limboos.admin.list.<wsId>.<painel>`):
 * sobrevivem a reload e cada pasta tem o seu estado.
 */
export function useListControls<T, K extends string = string>(
  options: ListControlsOptions<T, K>,
): ListControls<T, K> {
  const { storageKey, defaultSort, sorters } = options;
  const wsId = useOptionalAdminScope()?.scope.wsId;
  const name = storageName(storageKey, wsId);
  const defaultsRef = useRef({ filters: options.defaultFilters ?? {}, sort: defaultSort });
  defaultsRef.current = { filters: options.defaultFilters ?? {}, sort: defaultSort };

  const load = useCallback((n: string): Persisted => {
    const saved = read(n);
    const d = defaultsRef.current;
    return {
      query: typeof saved?.query === 'string' ? saved.query : '',
      sort: typeof saved?.sort === 'string' ? saved.sort : d.sort,
      filters: { ...d.filters, ...(saved?.filters ?? {}) },
    };
  }, []);

  const [state, setState] = useState<Persisted>(() => load(name));
  const nameRef = useRef(name);

  // Troca de pasta sem remontar: recarrega o estado da nova chave.
  useEffect(() => {
    if (nameRef.current === name) return;
    nameRef.current = name;
    setState(load(name));
  }, [name, load]);

  useEffect(() => {
    if (nameRef.current !== name) return;
    try {
      window.sessionStorage.setItem(name, JSON.stringify(state));
    } catch {
      /* armazenamento indisponível: o estado vale só na memória */
    }
  }, [name, state]);

  const setQuery = useCallback((query: string) => setState((s) => ({ ...s, query })), []);
  const setSortKey = useCallback((sort: K) => setState((s) => ({ ...s, sort })), []);
  const setFilter = useCallback(
    (f: string, value: string) => setState((s) => ({ ...s, filters: { ...s.filters, [f]: value } })),
    [],
  );
  const reset = useCallback(() => {
    const d = defaultsRef.current;
    setState({ query: '', sort: d.sort, filters: { ...d.filters } });
  }, []);

  const sortKey = (state.sort in sorters ? state.sort : defaultSort) as K;
  const sortersRef = useRef(sorters);
  sortersRef.current = sorters;

  const apply = useCallback(
    (items: T[], match?: (item: T, query: string) => boolean): T[] => {
      const q = state.query.trim().toLowerCase();
      let out = q && match ? items.filter((item) => match(item, q)) : items;
      const cmp = sortersRef.current[sortKey];
      if (cmp) out = [...out].sort(cmp);
      return out;
    },
    [state.query, sortKey],
  );

  return useMemo(
    () => ({ query: state.query, setQuery, sortKey, setSortKey, filters: state.filters, setFilter, reset, apply }),
    [state.query, state.filters, sortKey, setQuery, setSortKey, setFilter, reset, apply],
  );
}
