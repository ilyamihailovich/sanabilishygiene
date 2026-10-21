import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';
import s from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'surface' | 'ghost' | 'glass' | 'glassDark';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  leading,
  trailing,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(s.button, s[variant], size !== 'md' && s[size], block && s.block, className)}
      {...rest}
    >
      {leading && <span className={s.icon}>{leading}</span>}
      {children}
      {trailing && <span className={s.icon}>{trailing}</span>}
    </button>
  );
}
