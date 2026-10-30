import type { Transition, Variants } from 'motion/react';

/**
 * Vocabulário de movimento do LimboOS (Motion v12).
 * Espelha os tokens `--easing-*` / `--duration-*` de src/index.css para que
 * transições CSS e JS falem a mesma língua.
 *
 * Regras de uso:
 * - Entrada: ease-out forte (EASE_OUT/EASE_ENTER). Saída: mais curta que a entrada.
 * - Movimento em tela (morph, reposicionamento): EASE_MOVE.
 * - Gestos e indicadores interrompíveis: springs (mantêm velocidade ao reverter).
 * - Nada nasce de scale(0): o menor ponto de partida é 0.94.
 * - Ações de teclado frequentes (⌘K, ⌘1–5) não animam deslocamento.
 */

// ── Curvas ────────────────────────────────────────────────────────────
/** --easing-standard: resposta imediata, pouso suave */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;
/** --easing-enter: ainda mais decidida, para painéis que entram */
export const EASE_ENTER = [0.16, 1, 0.3, 1] as const;
/** --easing-exit: acelera para fora, sem cauda */
export const EASE_EXIT = [0.4, 0, 1, 1] as const;
/** --easing-move: deslocamento de elementos já visíveis */
export const EASE_MOVE = [0.77, 0, 0.175, 1] as const;
/** --easing-drawer: gavetas laterais (curva de sheet nativo) */
export const EASE_DRAWER = [0.32, 0.72, 0, 1] as const;

// ── Durações (segundos) ──────────────────────────────────────────────
export const DURATION = {
  instant: 0.08,
  press: 0.12,
  fast: 0.16,
  base: 0.22,
  slow: 0.32,
  deliberate: 0.6,
} as const;

// ── Transições prontas ───────────────────────────────────────────────
export const FADE: Transition = { duration: DURATION.base, ease: EASE_OUT };
export const FADE_FAST: Transition = { duration: DURATION.fast, ease: EASE_OUT };
export const EXIT_FAST: Transition = { duration: DURATION.fast, ease: EASE_EXIT };

/** Modais e diálogos centrados: assentam rápido, quase sem rebote */
export const SPRING_SNAP: Transition = { type: 'spring', visualDuration: 0.26, bounce: 0.08 };
/** Gavetas laterais: sem rebote, peso de sheet */
export const SPRING_DRAWER: Transition = { type: 'spring', visualDuration: 0.34, bounce: 0 };
/** Indicadores com layoutId (abas, sidebar) */
export const SPRING_INDICATOR: Transition = { type: 'spring', visualDuration: 0.24, bounce: 0.1 };
/** Toasts: chegam com leve inércia */
export const SPRING_TOAST: Transition = { type: 'spring', visualDuration: 0.3, bounce: 0.12 };
/** Peças físicas do aparelho (teclas, tampa do deck) */
export const SPRING_MECHANICAL: Transition = { type: 'spring', stiffness: 520, damping: 30, mass: 0.6 };

/** Transição padrão injetada via <MotionConfig> na raiz do app */
export const DEFAULT_TRANSITION: Transition = FADE;

/** Limita o atraso acumulado de listas escalonadas */
export function staggerDelay(index: number, step = 0.03, cap = 0.2): number {
  return Math.min(index * step, cap);
}

// ── Variantes ────────────────────────────────────────────────────────
export const overlayFade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: FADE_FAST },
  exit: { opacity: 0, transition: { duration: DURATION.fast, ease: EASE_EXIT } },
};

/** Diálogo centrado: origem no centro (modais não têm gatilho ancorado) */
export const dialogPop: Variants = {
  hidden: { opacity: 0, transform: 'translateY(8px) scale(0.96)' },
  visible: { opacity: 1, transform: 'translateY(0px) scale(1)', transition: SPRING_SNAP },
  exit: { opacity: 0, transform: 'translateY(4px) scale(0.98)', transition: EXIT_FAST },
};

/** Gaveta pela direita: percentuais acompanham qualquer largura */
export const drawerRight: Variants = {
  hidden: { transform: 'translateX(100%)' },
  visible: { transform: 'translateX(0%)', transition: SPRING_DRAWER },
  exit: { transform: 'translateX(100%)', transition: { duration: DURATION.base, ease: EASE_DRAWER } },
};

export const panelEnter: Variants = {
  hidden: { opacity: 0, transform: 'translateY(6px)' },
  visible: { opacity: 1, transform: 'translateY(0px)', transition: FADE },
};

/** Itens de lista com `layout`: usa x (não `transform`) para não brigar com a projeção de layout */
export const listItem: Variants = {
  hidden: { opacity: 0, x: -6 },
  visible: { opacity: 1, x: 0, transition: FADE },
  exit: { opacity: 0, x: 6, transition: EXIT_FAST },
};

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.03,
      delayChildren: 0.02,
    },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, transform: 'translateY(8px)' },
  visible: {
    opacity: 1,
    transform: 'translateY(0px)',
    transition: FADE,
  },
};
