import type { CSSProperties } from 'react';

/*
  Мягкий тон состояния для карточек BOIB и скрининга: зелёный, жёлтый, оранжевый. Красного нет намеренно.
  Пороги BOIB — ориентиры для оформления, не клиническая оценка: ≤ 10 % зелёный, около 20 % жёлтый, от 30 % оранжевый.
*/

type Rgb = [number, number, number];
const STOPS: Array<[number, Rgb]> = [
  [0, [196, 230, 204]],
  [0.5, [247, 230, 168]],
  [1, [250, 204, 162]],
];

function mix(t: number): Rgb {
  const x = Math.min(1, Math.max(0, t));
  for (let i = 1; i < STOPS.length; i++) {
    const [t1, c1] = STOPS[i]!;
    const [t0, c0] = STOPS[i - 1]!;
    if (x <= t1) {
      const k = (x - t0) / (t1 - t0);
      return [0, 1, 2].map((j) => Math.round(c0[j]! + (c1[j]! - c0[j]!) * k)) as Rgb;
    }
  }
  return STOPS[STOPS.length - 1]![1];
}

export const boibTone = (pct: number) => Math.min(1, Math.max(0, (pct - 10) / 20));
export const psrTone = (code: number) => [0, 0.3, 0.55, 0.85, 1][code] ?? 1;

/** Градиент из правого верхнего угла, к середине карточки сходит на нет. */
export function toneStyle(t: number, base = 'var(--color-surface)'): CSSProperties {
  const [r, g, b] = mix(t);
  return {
    background: `radial-gradient(85% 120% at 100% 0%, rgba(${r}, ${g}, ${b}, 0.85) 0%, rgba(${r}, ${g}, ${b}, 0.35) 38%, rgba(${r}, ${g}, ${b}, 0) 72%), ${base}`,
    printColorAdjust: 'exact',
    WebkitPrintColorAdjust: 'exact',
  };
}
