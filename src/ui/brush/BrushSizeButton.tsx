import { IconCheck } from '../icons';
import s from './BrushSizeButton.module.css';

interface BrushSizeButtonProps {
  label: string;
  meta: string;
  color: string;
  hotkey?: string;
  pressed: boolean;
  onClick: () => void;
}

/** Крупная кнопка размера ёршика: цвет, обозначение, диаметр прохода, клавиша быстрого ввода. */
export function BrushSizeButton({ label, meta, color, hotkey, pressed, onClick }: BrushSizeButtonProps) {
  return (
    <button type="button" aria-pressed={pressed} className={s.button} onClick={onClick}>
      <span className={s.dot} style={{ background: color }} aria-hidden="true" />
      <span className={s.text}>
        <span className={s.label}>{label}</span>
        <span className={s.meta}>{meta}</span>
      </span>
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
