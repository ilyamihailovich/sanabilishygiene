'use client';

import { MotionConfig } from 'motion/react';
import type { ReactNode } from 'react';

/** Учитывает prefers-reduced-motion во всех анимациях Motion. */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
