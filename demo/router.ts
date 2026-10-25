import { useSyncExternalStore } from 'react';

// Маршрутизация прототипа в памяти: адрес страницы не меняется, история не ведётся.
// Строка запроса сохраняется (шаг визита ?step=psr), якорь отбрасывается.
let path = '/';
const listeners = new Set<() => void>();

export function setInitialPath(p: string) {
  path = p;
}

export function navigate(to: string, _options?: { scroll?: boolean }) {
  const next = to.split('#')[0] || '/';
  if (next === path) return;
  const samePage = next.split('?')[0] === path.split('?')[0];
  path = next;
  listeners.forEach((l) => l());
  // смена шага внутри визита не прокручивает страницу наверх
  if (!samePage) window.scrollTo({ top: 0 });
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
