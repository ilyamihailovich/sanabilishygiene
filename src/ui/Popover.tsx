'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { glassClass } from './Glass';
import { cx } from './cx';
import { spring } from './motion';
import s from './Popover.module.css';

interface Point {
  x: number;
  y: number;
}

interface PopoverProps {
  open: boolean;
  onClose: () => void;
  /** Якорь: DOM-элемент или экранная точка (например, проекция маркера 3D-сцены). */
  anchor: RefObject<HTMLElement | null> | Point;
  label: string;
  children: ReactNode;
}

const GAP = 12;
const MARGIN = 16;

function anchorRect(anchor: PopoverProps['anchor']): DOMRect {
  if ('current' in anchor) {
    return anchor.current?.getBoundingClientRect() ?? new DOMRect();
  }
  return new DOMRect(anchor.x, anchor.y, 0, 0);
}

/** Поповер на десктопе: стекло, лёгкое масштабирование, закрытие по Esc и клику вне. */
export function Popover({ open, onClose, anchor, label, children }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; origin: string } | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const el = ref.current;
      if (!el) return;
      const a = anchorRect(anchor);
      const { width, height } = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const clampX = (x: number) => Math.min(Math.max(MARGIN, x), vw - width - MARGIN);
      const clampY = (y: number) => Math.min(Math.max(MARGIN, y), vh - height - MARGIN);
      let placed: { left: number; top: number; origin: string };
      if (a.bottom + GAP + height <= vh - MARGIN) {
        placed = { left: clampX(a.left + a.width / 2 - width / 2), top: a.bottom + GAP, origin: 'top center' };
      } else if (a.top - GAP - height >= MARGIN) {
        placed = { left: clampX(a.left + a.width / 2 - width / 2), top: a.top - GAP - height, origin: 'bottom center' };
      } else if (a.right + GAP + width <= vw - MARGIN) {
        placed = { left: a.right + GAP, top: clampY(a.top + a.height / 2 - height / 2), origin: 'center left' };
      } else {
        placed = { left: Math.max(MARGIN, a.left - GAP - width), top: clampY(a.top + a.height / 2 - height / 2), origin: 'center right' };
      }
      setPos(placed);
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, anchor]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      if ('current' in anchor && anchor.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open, onClose, anchor]);

  const style: CSSProperties = pos
    ? ({ left: pos.left, top: pos.top, '--origin': pos.origin } as CSSProperties)
    : { left: -9999, top: -9999 };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          role="dialog"
          aria-label={label}
          className={cx(glassClass, s.popover)}
          style={style}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.15 } }}
          transition={spring}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
