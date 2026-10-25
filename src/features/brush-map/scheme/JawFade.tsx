'use client';

import { AnimatePresence, motion } from 'motion/react';
import type { ReactNode } from 'react';

/** Плавная смена челюсти в схеме: верхняя уходит вверх, нижняя приходит снизу, и наоборот. */
export function JawFade({ jaw, children }: { jaw: 'upper' | 'lower'; children: ReactNode }) {
  const shift = jaw === 'upper' ? -18 : 18;
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={jaw}
        style={{ position: 'relative', width: '100%', height: '100%' }}
        initial={{ opacity: 0, y: shift }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -shift }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
