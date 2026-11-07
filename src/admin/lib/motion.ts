import type { Transition } from 'motion/react';
import {
  DURATION,
  EASE_ENTER,
  FADE,
  FADE_FAST,
  SPRING_DRAWER,
  SPRING_INDICATOR,
  SPRING_SNAP,
  SPRING_TOAST,
} from '../../lib/motion';

/**
 * Aliases do painel admin sobre o vocabulário compartilhado (src/lib/motion.ts).
 * Mantidos para não espalhar renomeações pelos painéis.
 */

/** Drawers / slide panels */
export const ADMIN_SPRING: Transition = SPRING_DRAWER;

/** Modals / confirm dialogs */
export const ADMIN_SPRING_SNAP: Transition = SPRING_SNAP;

/** layoutId indicators (sidebar, sub-tabs) */
export const ADMIN_SPRING_INDICATOR: Transition = SPRING_INDICATOR;

/** Toasts */
export const ADMIN_SPRING_TOAST: Transition = SPRING_TOAST;

/** Panel / sub-tab content crossfade */
export const ADMIN_FADE: Transition = FADE;

/**
 * Direção da troca de tela no admin: `forward` entra pela direita (aprofundar,
 * aba à direita), `back` pela esquerda (voltar, aba à esquerda), `fade` sem
 * deslocamento (troca de destino, inclusive por ⌘1–5, que é frequente).
 */
export type AdminMotionHint = 'fade' | 'forward' | 'back';

const ROUTE_SHIFT_PX = 16;

/** Keyframes de entrada de um painel; com movimento reduzido, só opacidade. */
export function routeEnterKeyframes(hint: AdminMotionHint, reduceMotion: boolean) {
  if (reduceMotion || hint === 'fade') return { opacity: [0, 1] };
  const from = hint === 'forward' ? ROUTE_SHIFT_PX : -ROUTE_SHIFT_PX;
  return { opacity: [0, 1], transform: [`translateX(${from}px)`, 'translateX(0px)'] };
}

export function routeEnterTransition(hint: AdminMotionHint): Transition {
  return hint === 'fade' ? FADE_FAST : { duration: DURATION.base, ease: EASE_ENTER };
}

export {
  drawerLeft,
  staggerDelay,
  panelEnter,
  listItem,
  overlayFade,
  staggerContainer,
  staggerItem,
  dialogPop,
  drawerRight,
} from '../../lib/motion';
