import { useCallback, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { parseAdminLocation } from '../lib/adminNavigation';

/** Caminho de cada entrada de histórico desta carga do app, por `history.state.idx`. */
const pathByIdx = new Map<number, string>();

/** Rota tipada do admin a partir do URL atual. */
export function useAdminLocation() {
  const location = useLocation();
  const path = `${location.pathname}${location.search}`;

  useEffect(() => {
    const idx = (window.history.state as { idx?: number } | null)?.idx;
    if (typeof idx === 'number') pathByIdx.set(idx, path);
  }, [path, location.key]);

  const parsed = useMemo(
    () => parseAdminLocation(location.pathname, location.search),
    [location.pathname, location.search]
  );
  return {
    ...parsed,
    key: location.key,
    hash: location.hash,
    path,
  };
}

/**
 * Único ponto de navegação do admin. `go` empilha (ou substitui, para filtros).
 * `back(behind)` fecha um overlay revelando a tela atrás dele: desempilha quando
 * a entrada anterior é essa tela; senão (aberto pelo Spotlight, link direto) a
 * entrada do overlay é substituída por ela, e o destino não fica lembrando um
 * overlay já fechado.
 */
export function useAdminNavigate() {
  const navigate = useNavigate();

  const go = useCallback(
    (to: string, options?: { replace?: boolean }) => {
      // Mesmo destino da entrada atual substitui em vez de duplicar (como o <Link> faz)
      const { pathname, search, hash } = window.location;
      const same = to === `${pathname}${search}${hash}` || (!to.includes('#') && to === `${pathname}${search}`);
      void navigate(to, { replace: options?.replace ?? same });
    },
    [navigate]
  );

  const back = useCallback(
    (behind: string) => {
      const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
      if (idx > 0 && pathByIdx.get(idx - 1) === behind) void navigate(-1);
      else void navigate(behind, { replace: true });
    },
    [navigate]
  );

  return useMemo(() => ({ go, back }), [go, back]);
}
