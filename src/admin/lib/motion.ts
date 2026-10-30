import type { Transition, Variants } from 'motion/react';

/** Drawers / slide panels */
export const ADMIN_SPRING: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 30,
};

/** Modals / confirm dialogs */
export const ADMIN_SPRING_SNAP: Transition = {
  type: 'spring',
  stiffness: 360,
  damping: 30,
};

/** layoutId indicators (sidebar, sub-tabs) */
export const ADMIN_SPRING_INDICATOR: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 32,
};

/** Toasts */
export const ADMIN_SPRING_TOAST: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 30,
};

/** Panel / sub-tab content crossfade */
export const ADMIN_FADE: Transition = {
  duration: 0.22,
};

/** Cap stagger delays for list mounts */
export function staggerDelay(index: number, step = 0.03, cap = 0.2): number {
  return Math.min(index * step, cap);
}

export const panelEnter: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
};

export const listItem: Variants = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 8, transition: { duration: 0.15 } },
};

export const overlayFade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
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
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: ADMIN_FADE,
  },
};
