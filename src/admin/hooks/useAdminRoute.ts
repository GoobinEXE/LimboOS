import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { parseAdminLocation } from '../lib/adminNavigation';

/** Rota tipada do admin a partir do URL atual. */
export function useAdminLocation() {
  const location = useLocation();
  const parsed = useMemo(
    () => parseAdminLocation(location.pathname, location.search),
    [location.pathname, location.search]
  );
  return {
    ...parsed,
    key: location.key,
    hash: location.hash,
    path: `${location.pathname}${location.search}`,
  };
}

/**
 * Único ponto de navegação do admin. `go` empilha (ou substitui, para filtros);
 * `back` volta uma entrada quando ela pertence a esta sessão do app e, se não,
 * substitui pela rota de reserva (link aberto direto numa aba nova).
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
    (fallback: string) => {
      const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
      if (idx > 0) void navigate(-1);
      else void navigate(fallback, { replace: true });
    },
    [navigate]
  );

  return useMemo(() => ({ go, back }), [go, back]);
}
