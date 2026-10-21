'use client';

import { useSyncExternalStore } from 'react';

export function useMediaQuery(query: string, serverFallback = false): boolean {
  return useSyncExternalStore(
    (notify) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', notify);
      return () => mql.removeEventListener('change', notify);
    },
    () => window.matchMedia(query).matches,
    () => serverFallback,
  );
}

/** Смартфонная раскладка: нижние листы вместо поповеров. */
export function useTouchLayout(): boolean {
  return useMediaQuery('(max-width: 720px), (pointer: coarse) and (max-width: 1024px)');
}
