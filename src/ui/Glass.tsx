import type { HTMLAttributes } from 'react';
import { cx } from './cx';
import s from './Glass.module.css';

export const glassClass = s.glass;

interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical';
}

/** Плавающая стеклянная панель: ракурсы над сценой, нижняя панель инструментов. */
export function GlassPanel({ orientation = 'horizontal', className, ...rest }: GlassPanelProps) {
  return (
    <div
      role="toolbar"
      aria-orientation={orientation}
      className={cx(s.glass, s.panel, orientation === 'vertical' && s.vertical, className)}
      {...rest}
    />
  );
}
