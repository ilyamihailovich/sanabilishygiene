import { useSyncExternalStore } from 'react';

// Маршрутизация прототипа в памяти: адрес страницы не меняется, но каждый переход записывается в историю браузера,
// поэтому «назад» (жест двумя пальцами, кнопка браузера) возвращает на прошлый экран.
// Строка запроса сохраняется (шаг визита ?step=psr), якорь отбрасывается.
let path = '/';
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const canHistory = () => {
  try {
    return typeof window !== 'undefined' && typeof window.history?.pushState === 'function';
  } catch {
    return false;
  }
};

export function setInitialPath(p: string) {
  path = p;
  if (!canHistory()) return;
  try {
    window.history.replaceState({ demoPath: p }, '');
  } catch {
    /* песочница запретила историю: работаем без неё */
  }
  window.addEventListener('popstate', (e) => {
    const next = (e.state as { demoPath?: string } | null)?.demoPath;
    if (!next || next === path) return;
    path = next;
    emit();
  });
}

function go(to: string, replace: boolean) {
  const next = to.split('#')[0] || '/';
  if (next === path) return;
  const samePage = next.split('?')[0] === path.split('?')[0];
  path = next;
  if (canHistory()) {
    try {
      // смена шага внутри визита заменяет запись, переход на другой экран добавляет новую
      if (replace || samePage) window.history.replaceState({ demoPath: next }, '');
      else window.history.pushState({ demoPath: next }, '');
    } catch {
      /* без истории переход всё равно состоится */
    }
  }
  emit();
  // смена шага внутри визита не прокручивает страницу наверх
  if (!samePage) window.scrollTo({ top: 0 });
}

export function navigate(to: string, _options?: { scroll?: boolean }) {
  go(to, false);
}

export function replace(to: string, _options?: { scroll?: boolean }) {
  go(to, true);
}

export function back() {
  if (canHistory()) window.history.back();
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
