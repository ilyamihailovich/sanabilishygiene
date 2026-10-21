'use client';

import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { IconAlert } from './icons';
import s from './Field.module.css';

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  hint?: ReactNode;
  error?: string;
}

export function TextField({ label, hint, error, ...rest }: TextFieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={s.field}>
      <label htmlFor={id} className={s.label}>
        {label}
      </label>
      <input id={id} className={s.input} aria-invalid={Boolean(error)} aria-describedby={describedBy} {...rest} />
      {error ? (
        <span id={`${id}-error`} className={s.error}>
          <IconAlert size={16} />
          {error}
        </span>
      ) : (
        hint && (
          <span id={`${id}-hint`} className={s.hint}>
            {hint}
          </span>
        )
      )}
    </div>
  );
}

interface SwitchProps {
  label: ReactNode;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
}

export function Switch({ label, checked, onCheckedChange }: SwitchProps) {
  const id = useId();
  return (
    <div className={s.switchRow} onClick={() => onCheckedChange(!checked)}>
      <span id={id}>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={id}
        className={s.switch}
        onClick={(e) => {
          e.stopPropagation();
          onCheckedChange(!checked);
        }}
      >
        <span className={s.knob} />
      </button>
    </div>
  );
}

interface TextAreaProps extends Omit<import('react').TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  label: string;
  hint?: ReactNode;
  error?: string;
}

export function TextArea({ label, hint, error, className, ...rest }: TextAreaProps) {
  const id = useId();
  return (
    <div className={s.field}>
      <label htmlFor={id} className={s.label}>
        {label}
      </label>
      <textarea
        id={id}
        className={`${s.input} ${s.textarea} ${className ?? ''}`}
        aria-invalid={Boolean(error)}
        aria-describedby={error || hint ? `${id}-d` : undefined}
        {...rest}
      />
      {(error || hint) && (
        <span id={`${id}-d`} className={error ? s.error : s.hint}>
          {error ?? hint}
        </span>
      )}
    </div>
  );
}

interface SelectProps extends Omit<import('react').SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  label: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  hint?: ReactNode;
}

export function Select({ label, options, hint, ...rest }: SelectProps) {
  const id = useId();
  return (
    <div className={s.field}>
      <label htmlFor={id} className={s.label}>
        {label}
      </label>
      <select id={id} className={`${s.input} ${s.select}`} {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <span className={s.hint}>{hint}</span>}
    </div>
  );
}
