import type { Transition } from 'motion/react';

/** Единая пружина интерфейса (ориентир из ТЗ). */
export const spring: Transition = { type: 'spring', stiffness: 300, damping: 30 };

/** Мягкая пружина для листов: длиннее ход, без отскока. */
export const sheetSpring: Transition = { type: 'spring', stiffness: 320, damping: 34, mass: 0.9 };

/** Смена вида карты (3D и схема): растворение с лёгким размытием и масштабом. */
export const modeFade = {
  initial: { opacity: 0, scale: 0.985, filter: 'blur(6px)' },
  animate: { opacity: 1, scale: 1, filter: 'blur(0px)' },
  exit: { opacity: 0, scale: 1.01, filter: 'blur(6px)' },
  transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
} as const;
