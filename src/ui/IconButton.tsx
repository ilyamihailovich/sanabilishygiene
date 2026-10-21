import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { cx } from './cx';
import s from './IconButton.module.css';

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  label: string;
  icon: ReactNode;
  variant?: 'surface' | 'muted' | 'accent' | 'ghost';
  size?: 36 | 40 | 44 | 52;
  active?: boolean;
}

export function IconButton({
  label,
  icon,
  variant = 'surface',
  size = 44,
  active = false,
  className,
  style,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cx(s.root, s[variant], active && s.active, className)}
      style={{ '--size': `${size}px`, ...style } as CSSProperties}
      {...rest}
    >
      {icon}
    </button>
  );
}
