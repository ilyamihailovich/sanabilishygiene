import type { CSSProperties } from 'react';

/*
  Тон состояния для карточек BOIB и скрининга в палитре клиники: чем хуже показатель, тем гуще лавандовое
  свечение и тем ближе оно к индиго. Пороги BOIB — ориентиры для оформления, не клиническая оценка.
*/

type Rgb = [number, number, number];
const STOPS: Array<[number, Rgb]> = [
  [0, [167, 140, 213]],
  [1, [70, 44, 108]],
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
export function toneStyle(t: number, base = 'var(--card-bg)'): CSSProperties {
  const [r, g, b] = mix(t * 0.6);
  // насыщенность свечения растёт с тоном: спокойный показатель — лёгкая лаванда
  const k = 0.45 + 0.55 * Math.min(1, Math.max(0, t));
  const c = (a: number) => `rgba(${r}, ${g}, ${b}, ${(a * k).toFixed(3)})`;
  return {
    background: [
      `radial-gradient(75% 95% at 100% 0%, ${c(0.55)} 0%, ${c(0.22)} 40%, ${c(0)} 70%)`,
      `radial-gradient(48% 65% at 0% 100%, ${c(0.35)} 0%, ${c(0.12)} 42%, ${c(0)} 72%)`,
      base,
    ].join(', '),
    boxShadow: `inset 0 0 0 1px rgba(255, 255, 255, 0.85), 0 0 0 1px ${c(0.25)}, 0 10px 32px rgba(70, 44, 108, 0.07)`,
    backdropFilter: 'blur(24px) saturate(1.6)',
    WebkitBackdropFilter: 'blur(24px) saturate(1.6)',
    printColorAdjust: 'exact',
    WebkitPrintColorAdjust: 'exact',
  };
}
