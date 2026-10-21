import type { ElementType, ReactNode } from 'react';
import { cx } from './cx';
import s from './Heading.module.css';

interface HeadingProps {
  as?: ElementType;
  level?: 'display' | 'title1' | 'title2' | 'title3';
  /** Начало заголовка основным цветом. */
  children: ReactNode;
  /** Продолжение заголовка серым. */
  rest?: ReactNode;
  className?: string;
  id?: string;
}

export function Heading({ as: Tag = 'h2', level = 'title2', children, rest, className, id }: HeadingProps) {
  return (
    <Tag id={id} className={cx(s.heading, s[level], className)}>
      {children}
      {rest && (
        <>
          {' '}
          <span className={s.rest}>{rest}</span>
        </>
      )}
    </Tag>
  );
}

/** Нумерация шагов «01 / 05». */
export function StepCounter({ current, total }: { current: number; total: number }) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <span className={s.step} aria-label={`Шаг ${current} из ${total}`}>
      <span className={s.stepCurrent}>{pad(current)}</span>
      <span aria-hidden="true">/</span>
      <span>{pad(total)}</span>
    </span>
  );
}
