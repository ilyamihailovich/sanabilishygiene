'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useId, useRef, type CSSProperties, type ReactNode } from 'react';
import { Button } from './Button';
import { IconButton } from './IconButton';
import { Sheet } from './Sheet';
import { useTouchLayout } from './hooks/useMediaQuery';
import { IconClose } from './icons';
import { spring } from './motion';
import s from './Dialog.module.css';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  width?: number;
}

/** Диалог: по центру на десктопе, нижний лист на смартфоне. */
export function Dialog({ open, onClose, title, children, actions, width }: DialogProps) {
  const touch = useTouchLayout();
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || touch) return;
    const prev = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => ref.current?.querySelector<HTMLElement>('input, select, textarea, button:not([data-close])')?.focus(), 50);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [open, touch, onClose]);

  if (touch) {
    return (
      <Sheet open={open} onClose={onClose} title={title} closeLabel="Закрыть">
        {children}
        {actions && <div className={s.actions}>{actions}</div>}
      </Sheet>
    );
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className={s.backdrop} onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <div className={s.wrap}>
            <motion.div
              ref={ref}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className={s.dialog}
              style={width ? ({ '--w': `${width}px` } as CSSProperties) : undefined}
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={spring}
            >
              <div className={s.head}>
                <h2 id={titleId} className={s.title}>
                  {title}
                </h2>
                <IconButton data-close label="Закрыть" icon={<IconClose size={18} />} variant="muted" size={36} onClick={onClose} />
              </div>
              {children}
              {actions && <div className={s.actions}>{actions}</div>}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

interface ConfirmProps {
  open: boolean;
  title: string;
  text?: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({ open, title, text, confirmLabel, onConfirm, onClose }: ConfirmProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {text && <div className={s.text}>{text}</div>}
    </Dialog>
  );
}
