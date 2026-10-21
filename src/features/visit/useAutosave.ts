'use client';

import { useEffect, useRef, useState } from 'react';
import { ApiError, api } from '@/ui/api';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error' | 'stale';

/**
 * Автосохранение документа: отправка через 700 мс после последнего изменения, оптимистичная блокировка по ревизии.
 * При уходе со страницы несохранённые изменения отправляются сразу.
 */
export function useAutosave<T>(documentId: string, initialRev: number, content: T) {
  const [state, setState] = useState<SaveState>('idle');
  const rev = useRef(initialRev);
  const first = useRef(true);
  const pending = useRef<T | null>(null);
  const inflight = useRef(false);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    pending.current = content;
    const t = setTimeout(flush, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  async function flush() {
    if (inflight.current || pending.current === null || state === 'stale') return;
    const body = pending.current;
    pending.current = null;
    inflight.current = true;
    setState('saving');
    try {
      const res = await api.patch<{ rev: number }>(`/api/v1/documents/${documentId}`, { content: body, rev: rev.current });
      rev.current = res.rev;
      setState(pending.current ? 'saving' : 'saved');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'stale') setState('stale');
      else {
        pending.current ??= body;
        setState('error');
      }
    } finally {
      inflight.current = false;
      if (pending.current !== null) setTimeout(flush, 300);
    }
  }

  useEffect(() => {
    const onHide = () => {
      if (pending.current === null) return;
      navigator.sendBeacon?.(
        `/api/v1/documents/${documentId}/beacon`,
        new Blob([JSON.stringify({ content: pending.current, rev: rev.current })], { type: 'application/json' }),
      );
    };
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
  }, [documentId]);

  return state;
}
