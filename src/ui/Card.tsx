import type { CSSProperties, HTMLAttributes, ReactNode, Ref } from 'react';
import { cx } from './cx';
import s from './Card.module.css';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: 'surface' | 'muted' | 'dark' | 'accent';
  interactive?: boolean;
  padding?: number;
  ref?: Ref<HTMLDivElement>;
}

export function Card({ tone = 'surface', interactive = false, padding, className, style, ...rest }: CardProps) {
  const padStyle = padding === undefined ? undefined : ({ '--pad': `${padding}px` } as CSSProperties);
  return (
    <div
      className={cx(s.card, s[tone], interactive && s.interactive, className)}
      style={{ ...padStyle, ...style }}
      {...rest}
    />
  );
}

export function CardHeader({ title, meta, action }: { title: ReactNode; meta?: ReactNode; action?: ReactNode }) {
  return (
    <div className={s.header}>
      <h3 className={s.title}>{title}</h3>
      {(meta || action) && (
        <div className={s.headerSide}>
          {meta && <span className={s.meta}>{meta}</span>}
          {action}
        </div>
      )}
    </div>
  );
}

export function CardFooter({ children }: { children: ReactNode }) {
  return <div className={s.footer}>{children}</div>;
}
