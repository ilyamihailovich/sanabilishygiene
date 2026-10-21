import s from './BrushSwatch.module.css';

interface BrushSwatchProps {
  color: string;
  label: string;
  pressed: boolean;
  onClick: () => void;
}

/** Круглая кнопка-кисть с цветом размера для нижней панели. */
export function BrushSwatch({ color, label, pressed, onClick }: BrushSwatchProps) {
  return (
    <button type="button" aria-pressed={pressed} aria-label={label} title={label} className={s.button} onClick={onClick}>
      <span className={s.dot} style={{ background: color }} />
    </button>
  );
}
