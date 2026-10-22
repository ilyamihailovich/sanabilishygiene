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

/**
 * Тон обтекает карточку: крупное пятно из правого верхнего угла, меньшее из левого нижнего
 * и лёгкое свечение по краю.
 */
export function toneStyle(t: number, base = 'var(--color-surface)'): CSSProperties {
  const [r, g, b] = mix(t);
  const c = (a: number) => `rgba(${r}, ${g}, ${b}, ${a})`;
  return {
    background: [
      `radial-gradient(75% 95% at 100% 0%, ${c(0.85)} 0%, ${c(0.38)} 38%, ${c(0)} 70%)`,
      `radial-gradient(48% 65% at 0% 100%, ${c(0.6)} 0%, ${c(0.22)} 42%, ${c(0)} 72%)`,
      base,
    ].join(', '),
    boxShadow: `inset 0 0 0 1px ${c(0.3)}, inset 0 0 32px ${c(0.2)}`,
    printColorAdjust: 'exact',
    WebkitPrintColorAdjust: 'exact',
  };
}
