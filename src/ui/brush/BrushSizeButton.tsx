import { IconCheck } from '../icons';
import s from './BrushSizeButton.module.css';

interface BrushSizeButtonProps {
  label: string;
  /** Подробности размера: в подсказке, на плитке только обозначение. */
  title?: string;
  /** null — свой размер без цвета: пунктирная метка. */
  color: string | null;
  hotkey?: string;
  pressed: boolean;
  onClick: () => void;
}

/** Крупная кнопка размера ёршика: цвет, обозначение, диаметр прохода, клавиша быстрого ввода. */
export function BrushSizeButton({ label, title, color, hotkey, pressed, onClick }: BrushSizeButtonProps) {
  return (
    <button type="button" aria-pressed={pressed} className={s.button} onClick={onClick} title={title}>
      <span className={s.dot} style={color ? { background: color } : undefined} data-free={color ? undefined : 'true'} aria-hidden="true" />
      <span className={s.label}>{label}</span>
      {pressed ? (
        <span className={s.check}>
          <IconCheck size={20} />
        </span>
      ) : (
        hotkey && (
          <kbd className={s.key} aria-label={`Клавиша ${hotkey}`}>
            {hotkey}
          </kbd>
        )
      )}
    </button>
  );
}
