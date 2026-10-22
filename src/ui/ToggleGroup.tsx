'use client';

import { motion } from 'motion/react';
import { useId, type CSSProperties, type ReactNode } from 'react';
import { cx } from './cx';
import { spring } from './motion';
import s from './ToggleGroup.module.css';

export interface ToggleGroupOption<T extends string> {
  value: T;
  label: string;
  content: ReactNode;
}

interface ToggleGroupProps<T extends string> {
  options: ReadonlyArray<ToggleGroupOption<T>>;
  value: T | null;
  onChange: (value: T | null) => void;
  label: string;
  /** accent: заливка акцентом (ракурсы); ring: белая подложка с кольцом (кисть с цветом размера); glow: акцент с радиальным градиентом. */
  thumb?: 'accent' | 'ring' | 'glow';
  /** Повторное нажатие снимает выбор. */
  deselectable?: boolean;
  size?: number;
}

/** Группа круглых кнопок с одним выбранным значением. Подложка выбора плавно переезжает между кнопками. */
export function ToggleGroup<T extends string>({
  options,
  value,
  onChange,
  label,
  thumb = 'accent',
  deselectable = false,
  size = 44,
}: ToggleGroupProps<T>) {
  const id = useId();
  return (
    <div role="group" aria-label={label} className={s.group} style={{ '--size': `${size}px` } as CSSProperties}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={selected}
            aria-label={o.label}
            title={o.label}
            className={cx(s.item, selected && (thumb === 'ring' ? s.selectedRing : s.selectedAccent))}
            onClick={() => onChange(selected && deselectable ? null : o.value)}
          >
            {selected && (
              <motion.span
                layoutId={`toggle-thumb-${id}`}
                className={cx(s.thumb, thumb === 'accent' ? s.thumbAccent : thumb === 'glow' ? s.thumbGlow : s.thumbRing)}
                transition={spring}
              />
            )}
            <span className={s.content}>{o.content}</span>
          </button>
        );
      })}
    </div>
  );
}
