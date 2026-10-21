import type { ReactNode } from 'react';
import { glassClass } from './Glass';
import { cx } from './cx';
import { IconAlert } from './icons';
import s from './Notice.module.css';

/** Плашка-предупреждение в рабочем интерфейсе: «Каталог не проверен». */
export function Notice({ children }: { children: ReactNode }) {
  return (
    <span role="status" className={s.notice}>
      <IconAlert size={18} />
      {children}
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
