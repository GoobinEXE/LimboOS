import { useCallback, useMemo, useState } from 'react';

export interface Selection<K> {
  selected: ReadonlySet<K>;
  count: number;
  isSelected: (id: K) => boolean;
  toggle: (id: K) => void;
  /** Marca todos os `ids` (a lista visível). */
  selectAll: (ids: readonly K[]) => void;
  /** Todos marcados vira nenhum; senão marca todos. */
  toggleAll: (ids: readonly K[]) => void;
  /** Verdadeiro quando `ids` não é vazio e todos estão marcados. */
  allSelected: (ids: readonly K[]) => boolean;
  clear: () => void;
  /** Descarta marcados que não estão mais em `ids` (após filtro, remoção ou troca de pasta). */
  prune: (ids: readonly K[]) => void;
}

/** Seleção em massa: selecionar todos, limpar e contagem. */
export function useSelection<K = string>(): Selection<K> {
  const [selected, setSelected] = useState<ReadonlySet<K>>(() => new Set());

  const toggle = useCallback((id: K) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);
  const selectAll = useCallback((ids: readonly K[]) => setSelected(new Set(ids)), []);
  const clear = useCallback(() => setSelected((prev) => (prev.size ? new Set() : prev)), []);
  const prune = useCallback((ids: readonly K[]) => {
    setSelected((prev) => {
      if (!prev.size) return prev;
      const keep = new Set(ids);
      const next = new Set([...prev].filter((id) => keep.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, []);
  const allSelected = useCallback(
    (ids: readonly K[]) => ids.length > 0 && ids.every((id) => selected.has(id)),
    [selected],
  );
  const toggleAll = useCallback(
    (ids: readonly K[]) => {
      if (allSelected(ids)) setSelected(new Set());
      else setSelected(new Set(ids));
    },
    [allSelected],
  );
  const isSelected = useCallback((id: K) => selected.has(id), [selected]);

  return useMemo(
    () => ({ selected, count: selected.size, isSelected, toggle, selectAll, toggleAll, allSelected, clear, prune }),
    [selected, isSelected, toggle, selectAll, toggleAll, allSelected, clear, prune],
  );
}
