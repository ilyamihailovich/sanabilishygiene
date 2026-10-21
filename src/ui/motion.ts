import type { Transition } from 'motion/react';

/** Единая пружина интерфейса (ориентир из ТЗ). */
export const spring: Transition = { type: 'spring', stiffness: 300, damping: 30 };

/** Мягкая пружина для листов: длиннее ход, без отскока. */
export const sheetSpring: Transition = { type: 'spring', stiffness: 320, damping: 34, mass: 0.9 };
