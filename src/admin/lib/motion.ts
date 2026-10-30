import type { Transition } from 'motion/react';
import {
  FADE,
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

export {
  staggerDelay,
  panelEnter,
  listItem,
  overlayFade,
  staggerContainer,
  staggerItem,
  dialogPop,
  drawerRight,
} from '../../lib/motion';
