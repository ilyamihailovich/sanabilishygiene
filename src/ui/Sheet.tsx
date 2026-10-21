'use client';

import { AnimatePresence, motion, useDragControls, type PanInfo } from 'motion/react';
import { useEffect, useId, type ReactNode } from 'react';
import { IconButton } from './IconButton';
import { IconClose } from './icons';
import { sheetSpring } from './motion';
import s from './Sheet.module.css';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  closeLabel: string;
  children: ReactNode;
  /** Без затемнения: лист ввода, под которым остаётся видна карта. */
  modal?: boolean;
}

/** Нижний лист на смартфоне: выезжает снизу, закрывается свайпом вниз, по Esc и по фону. */
export function Sheet({ open, onClose, title, closeLabel, children, modal = true }: SheetProps) {
  const titleId = useId();
  const drag = useDragControls();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 80 || info.velocity.y > 600) onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {modal && (
            <motion.div
              className={s.backdrop}
              onClick={onClose}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            />
          )}
          <motion.div
            role="dialog"
            aria-modal={modal}
            aria-labelledby={titleId}
            className={modal ? s.sheet : `${s.sheet} ${s.inline}`}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={sheetSpring}
            drag="y"
            dragListener={false}
            dragControls={drag}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={onDragEnd}
          >
            <div className={s.handleZone} onPointerDown={(e) => drag.start(e)}>
              <span className={s.handle} />
            </div>
            <div className={s.header} onPointerDown={(e) => drag.start(e)}>
              <h2 id={titleId} className={s.title}>
                {title}
              </h2>
              <IconButton label={closeLabel} icon={<IconClose size={18} />} variant="muted" size={36} onClick={onClose} />
            </div>
            <div className={s.body}>{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
