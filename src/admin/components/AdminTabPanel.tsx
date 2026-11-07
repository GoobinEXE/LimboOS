import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAnimate, useReducedMotion } from 'motion/react';
import { routeEnterKeyframes, routeEnterTransition, type AdminMotionHint } from '../lib/motion';

/**
 * Falso quando algum painel ancestral está oculto. Overlays em portal
 * (modais, gavetas, menus) consultam o contexto para não ficarem sobre
 * outro destino depois de um Voltar ou de um atalho ⌘1–5.
 */
export const AdminPanelActiveContext = createContext(true);

export function useAdminPanelActive(): boolean {
  return useContext(AdminPanelActiveContext);
}

/** Direção da navegação em curso, calculada pelo Dashboard a cada troca de rota. */
export const AdminMotionHintContext = createContext<AdminMotionHint>('fade');

/**
 * Verdadeiro durante o commit em que um painel ancestral nasceu e já anima a
 * própria entrada: o filho que nasce junto não soma uma segunda animação.
 * Começa verdadeiro na raiz para a carga inicial da página não animar.
 */
const AdminPanelEnteringContext = createContext(true);

/**
 * Entrada direcional de um painel. Ao terminar, limpa o `transform` inline:
 * mesmo `translateX(0)` cria um bloco de contenção e prenderia modais
 * `position: fixed` renderizados dentro do painel.
 */
function useRouteEnter() {
  const hint = useContext(AdminMotionHintContext);
  const reduceMotion = Boolean(useReducedMotion());
  const [scope, animate] = useAnimate<HTMLDivElement>();

  const play = () => {
    const el = scope.current;
    if (!el) return;
    void animate(el, routeEnterKeyframes(hint, reduceMotion), routeEnterTransition(hint)).then(() => {
      el.style.transform = '';
    });
  };

  return { scope, play };
}

interface AdminTabPanelProps {
  active: boolean;
  children: React.ReactNode;
}

/**
 * Keep-alive tab wrapper: stays mounted (hidden when inactive) and plays
 * a one-shot enter animation whenever the tab becomes active — without
 * remounting children (Firestore listeners stay alive).
 */
export default function AdminTabPanel({ active, children }: AdminTabPanelProps) {
  const parentActive = useContext(AdminPanelActiveContext);
  const parentEntering = useContext(AdminPanelEnteringContext);
  const { scope, play } = useRouteEnter();
  const wasActive = useRef(active);
  const isFirst = useRef(true);
  // Este painel acabou de nascer: os filhos montados no mesmo commit não animam
  const [entering, setEntering] = useState(true);

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      wasActive.current = active;
      // Primeira visita a uma seção ou destino: nasce ativo e entra animado
      if (active && !parentEntering) play();
      setEntering(false);
      return;
    }
    if (active && !wasActive.current) play();
    wasActive.current = active;
    // play lê a direção do render em que o painel ficou ativo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return (
    <div className={active ? 'block' : 'hidden'} aria-hidden={!active}>
      <div ref={scope}>
        <AdminPanelActiveContext.Provider value={active && parentActive}>
          <AdminPanelEnteringContext.Provider value={entering || parentEntering}>
            {children}
          </AdminPanelEnteringContext.Provider>
        </AdminPanelActiveContext.Provider>
      </div>
    </div>
  );
}

/**
 * Libera as animações de entrada depois da primeira pintura do shell: a carga
 * inicial da página aparece de uma vez, as navegações seguintes animam.
 */
export function AdminPanelsRoot({ children }: { children: React.ReactNode }) {
  const [entering, setEntering] = useState(true);
  useEffect(() => setEntering(false), []);
  return <AdminPanelEnteringContext.Provider value={entering}>{children}</AdminPanelEnteringContext.Provider>;
}

/** Conteúdo que troca por remontagem (lista ↔ página da missão): anima ao montar. */
export function AdminRouteEnter({ children }: { children: React.ReactNode }) {
  const parentEntering = useContext(AdminPanelEnteringContext);
  const { scope, play } = useRouteEnter();
  const [entering, setEntering] = useState(true);

  useEffect(() => {
    if (!parentEntering) play();
    setEntering(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={scope}>
      <AdminPanelEnteringContext.Provider value={entering || parentEntering}>{children}</AdminPanelEnteringContext.Provider>
    </div>
  );
}
