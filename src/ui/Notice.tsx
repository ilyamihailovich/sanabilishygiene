import type { ReactNode } from 'react';
import { glassClass } from './Glass';
import { cx } from './cx';
import { IconAlert } from './icons';
import s from './Notice.module.css';

/** Плашка-предупреждение в рабочем интерфейсе: «Каталог не проверен». */
export function Notice({ children, short, glass = false }: { children: ReactNode; short?: ReactNode; glass?: boolean }) {
  return (
    <span role="status" className={cx(s.notice, glass && s.glass, short !== undefined && s.adaptive)}>
      <IconAlert size={18} />
      <span className={s.full}>{children}</span>
      {short !== undefined && (
        <span className={s.short} aria-hidden="true">
          {short}
        </span>
      )}
    </span>
  );
}

/** Ненавязчивое уведомление поверх сцены. */
export function Toast({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div role="status" className={cx(glassClass, s.toast)}>
      <span>{children}</span>
      {action}
    </div>
  );
}
