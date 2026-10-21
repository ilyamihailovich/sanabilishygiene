import { useSyncExternalStore } from 'react';

// Маршрутизация прототипа в памяти: адрес страницы не меняется, история не ведётся
let path = '/';
const listeners = new Set<() => void>();

export function setInitialPath(p: string) {
  path = p;
}

export function navigate(to: string, _options?: { scroll?: boolean }) {
  const next = to.split(/[?#]/)[0] || '/';
  if (next === path) return;
  path = next;
  listeners.forEach((l) => l());
  window.scrollTo({ top: 0 });
}

export function usePath() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => path,
    () => path,
  );
}
