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
  /** Значение, при смене которого поповер плавно переезжает к новому якорю (например, ключ выбранного маркера). */
  track?: unknown;
  /** Узкий поповер для коротких подсказок, например плашки промежутка у пациента. */
  narrow?: boolean;
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
export function Popover({ open, onClose, anchor, label, children, track, narrow }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; origin: string; animate: boolean } | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    // сторона (снизу, сверху, справа, слева) выбирается при открытии и при смене якоря; пока якорь движется, она не меняется
    let side: 'below' | 'above' | 'right' | 'left' | null = null;
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
      if (following && side) {
        // следование за якорем: пишем позицию прямо в стиль в том же кадре, без перерисовки React и без анимации
        const x = side === 'below' || side === 'above' ? clampX(a.left + a.width / 2 - width / 2) : side === 'right' ? a.right + GAP : a.left - GAP - width;
        const y = side === 'below' ? a.bottom + GAP : side === 'above' ? a.top - GAP - height : clampY(a.top + a.height / 2 - height / 2);
        el.style.transition = 'none';
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        return;
      }
      if (a.bottom + GAP + height <= vh - MARGIN) {
        side = 'below';
        placed = { left: clampX(a.left + a.width / 2 - width / 2), top: a.bottom + GAP, origin: 'top center' };
      } else if (a.top - GAP - height >= MARGIN) {
        side = 'above';
        placed = { left: clampX(a.left + a.width / 2 - width / 2), top: a.top - GAP - height, origin: 'bottom center' };
      } else if (a.right + GAP + width <= vw - MARGIN) {
        side = 'right';
        placed = { left: a.right + GAP, top: clampY(a.top + a.height / 2 - height / 2), origin: 'center left' };
      } else {
        side = 'left';
        placed = { left: Math.max(MARGIN, a.left - GAP - width), top: clampY(a.top + a.height / 2 - height / 2), origin: 'center right' };
      }
      setPos((prev) => ({ ...placed, animate: prev !== null }));
    };
    // якорь может двигаться сам (поворот 3D-модели): поповер следует за ним без задержки и не уходит за край экрана
    let following = false;
    let moving = false;
    let last = '';
    let raf = 0;
    const follow = () => {
      const a = anchorRect(anchor);
      const key = `${a.left.toFixed(1)}:${a.top.toFixed(1)}`;
      if (last && key !== last) {
        following = true;
        place();
        following = false;
        moving = true;
      } else if (moving) {
        // якорь остановился: состояние React догоняет фактическую позицию, чтобы следующая перерисовка не откатила поповер
        moving = false;
        const el = ref.current;
        if (el) setPos((prev) => (prev ? { ...prev, left: parseFloat(el.style.left), top: parseFloat(el.style.top), animate: false } : prev));
      }
      last = key;
      raf = requestAnimationFrame(follow);
    };
    place();
    raf = requestAnimationFrame(follow);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, anchor, track]);

  useEffect(() => {
    if (!open) setPos(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    // закрывается касанием вне поповера; перетаскивание (поворот модели) его не закрывает
    let down: { x: number; y: number } | null = null;
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      if ('current' in anchor && anchor.current?.contains(target)) return;
      down = { x: e.clientX, y: e.clientY };
    };
    const onUp = (e: PointerEvent) => {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6) onClose();
      down = null;
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('pointerup', onUp);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('pointerup', onUp);
    };
  }, [open, onClose, anchor]);

  const style: CSSProperties = pos
    ? ({
        left: pos.left,
        top: pos.top,
        '--origin': pos.origin,
        transition: pos.animate ? 'left 280ms cubic-bezier(0.22, 1, 0.36, 1), top 280ms cubic-bezier(0.22, 1, 0.36, 1)' : 'none',
      } as CSSProperties)
    : { left: -9999, top: -9999 };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          role="dialog"
          aria-label={label}
          className={cx(glassClass, s.popover, narrow && s.narrow)}
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
