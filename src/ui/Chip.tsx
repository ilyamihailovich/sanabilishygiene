import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';
import { IconCheck } from './icons';
import s from './Chip.module.css';

/** Чип-счётчик рядом с заголовком: «14 промежутков». */
export function CounterChip({ children, onSurface = false }: { children: ReactNode; onSurface?: boolean }) {
  return <span className={cx(s.chip, onSurface && s.onSurface)}>{children}</span>;
}

interface ToggleChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  pressed: boolean;
  onPressedChange: (next: boolean) => void;
}

/** Переключаемый чип. Состояние дублируется галочкой, не только цветом. */
export function ToggleChip({ pressed, onPressedChange, children, className, ...rest }: ToggleChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cx(s.chip, s.toggle, className)}
      onClick={() => onPressedChange(!pressed)}
      {...rest}
    >
      {pressed && (
        <span className={s.check}>
          <IconCheck size={16} />
        </span>
      )}
      {children}
    </button>
  );
}
