'use client';

import { useEffect, useRef } from 'react';
import type { NavKey } from '@/domain/navigation';

export type ViewKey = 'overview' | 'upper' | 'lower' | 'right' | 'front' | 'left';
export const VIEW_ORDER: ViewKey[] = ['overview', 'upper', 'lower', 'right', 'front', 'left'];

export interface MapKeyHandlers {
  navigate: (move: NavKey) => void;
  sizeByIndex: (index: number) => void;
  clearSize: () => void;
  toggle: (field: 'bleeding' | 'pain' | 'openContact' | 'floss' | 'none') => void;
  cycle: (field: 'approach' | 'method') => void;
  open: () => void;
  close: () => void;
  view: (view: ViewKey) => void;
  undo: () => void;
  redo: () => void;
  help: () => void;
}

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

/** Быстрый ввод с клавиатуры. Клавиши по event.code, поэтому работают в русской раскладке. */
export function useMapKeyboard(enabled: boolean, handlers: MapKeyHandlers) {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || document.querySelector('[aria-modal="true"]')) return;
      const h = ref.current;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.code === 'KeyZ') {
        e.preventDefault();
        if (e.shiftKey) h.redo();
        else h.undo();
        return;
      }
      if (mod && e.code === 'KeyY') {
        e.preventDefault();
        h.redo();
        return;
      }
      if (mod || e.altKey) return;

      const digit = /^Digit(\d)$/.exec(e.code)?.[1];
      if (digit !== undefined && e.shiftKey) {
        const v = VIEW_ORDER[Number(digit) - 1];
        if (v) {
          e.preventDefault();
          h.view(v);
        }
        return;
      }
      if (e.key === '?' || (e.shiftKey && e.code === 'Slash')) {
        e.preventDefault();
        h.help();
        return;
      }
      if (digit !== undefined) {
        e.preventDefault();
        h.sizeByIndex(digit === '0' ? 9 : Number(digit) - 1);
        return;
      }
      const map: Record<string, () => void> = {
        ArrowRight: () => h.navigate('next'),
        ArrowLeft: () => h.navigate('prev'),
        ArrowUp: () => h.navigate('up'),
        ArrowDown: () => h.navigate('down'),
        Backspace: h.clearSize,
        Delete: h.clearSize,
        KeyB: () => h.toggle('bleeding'),
        KeyP: () => h.toggle('pain'),
        KeyO: () => h.toggle('openContact'),
        KeyF: () => h.toggle('floss'),
        KeyN: () => h.toggle('none'),
        KeyV: () => h.cycle('approach'),
        KeyM: () => h.cycle('method'),
        Enter: h.open,
        Escape: h.close,
        KeyR: () => h.view('overview'),
      };
      const fn = map[e.code] ?? map[e.key];
      if (fn) {
        e.preventDefault();
        fn();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
