'use client';

import { useLayoutEffect, useState } from 'react';
import { ui } from '@/content/ui.ru';
import type { MapElement } from '@/domain/brushMap';
import { glassClass } from '@/ui/Glass';
import { cx } from '@/ui/cx';
import s from './editor.module.css';

/** Подсказка при наведении мышью: данные промежутка без клика. */
export function HoverCard({ element, target, sizeLabel }: { element: MapElement | null; target: Element | null; sizeLabel: string | null }) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    if (!target) return setPos(null);
    const r = target.getBoundingClientRect();
    setPos({ left: r.left + r.width / 2 + 16, top: r.top - 8 });
  }, [target]);
  if (!element || !pos) return null;
  const d = element.data;
  const marks = [d.bleeding && ui.interspace.bleeding].filter(Boolean);
  const alt = d.alternative === 'FLOSS' ? ui.interspace.floss : null;
  return (
    <div className={cx(glassClass, s.hover)} style={pos} role="tooltip">
      <span className={s.hoverTitle}>{element.label}</span>
      <span>{element.active ? (sizeLabel ?? alt ?? ui.map.hoverEmpty) : ui.map.edgeOff}</span>
      {marks.length > 0 && <span>{marks.join(', ')}</span>}
    </div>
  );
}
