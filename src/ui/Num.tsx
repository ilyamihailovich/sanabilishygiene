import type { ReactNode } from 'react';

/**
 * Табличные цифры без табличной пунктуации: в Relative Pro функция tnum расширяет и точки с двоеточиями,
 * поэтому разделители в датах и времени выводятся пропорционально.
 */
export function Num({ children }: { children: string }): ReactNode {
  return children.split(/(\d+)/).map((part, i) =>
    /^\d+$/.test(part) ? (
      <span key={i} style={{ fontVariantNumeric: 'tabular-nums' }}>
        {part}
      </span>
    ) : (
      <span key={i} style={{ fontVariantNumeric: 'normal', fontFeatureSettings: '"tnum" 0' }}>
        {part}
      </span>
    ),
  );
}
