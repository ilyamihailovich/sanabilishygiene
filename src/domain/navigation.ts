import type { MapElement } from './brushMap';

export type NavKey = 'next' | 'prev' | 'up' | 'down';

/**
 * Перемещение фокуса по активным элементам карты.
 * next/prev — порядок осмотра; up/down — ближайший по положению элемент другой челюсти.
 */
export function navigate(elements: MapElement[], currentKey: string | null, move: NavKey): string | null {
  const active = elements.filter((e) => e.active);
  if (!active.length) return null;
  const index = active.findIndex((e) => e.key === currentKey);
  const current = active[index];
  if (!current) return move === 'prev' ? active[active.length - 1]!.key : active[0]!.key;

  if (move === 'next') return active[(index + 1) % active.length]!.key;
  if (move === 'prev') return active[(index - 1 + active.length) % active.length]!.key;

  const targetArch = move === 'up' ? 'upper' : 'lower';
  if (current.arch === targetArch) return current.key;
  const candidates = active.filter((e) => e.arch === targetArch);
  let best: MapElement | undefined;
  for (const c of candidates) {
    if (!best || Math.abs(c.archPos - current.archPos) < Math.abs(best.archPos - current.archPos)) best = c;
  }
  return best?.key ?? current.key;
}
