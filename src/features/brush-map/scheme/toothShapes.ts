import { archOf, toothIndex } from '@/domain/teeth';

/*
  Линейные силуэты зубов в окклюзионной проекции, в локальных координатах:
  x — вдоль дуги, y — вестибулярно (наружу) положительно. w — ширина, d — глубина.
  Контуры строятся суперэллипсами с поправками формы по группам зубов.
*/

const f = (v: number) => (Math.round(v * 10) / 10).toString();

function polygon(points: Array<[number, number]>): string {
  return `M${points.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}Z`;
}

function superellipse(w: number, d: number, n: number, warp?: (x: number, y: number) => [number, number]): string {
  const pts: Array<[number, number]> = [];
  const steps = 56;
  for (let k = 0; k < steps; k++) {
    const t = (k / steps) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    let x = (w / 2) * Math.sign(c) * Math.abs(c) ** (2 / n);
    let y = (d / 2) * Math.sign(s) * Math.abs(s) ** (2 / n);
    if (warp) [x, y] = warp(x, y);
    pts.push([x, y]);
  }
  return polygon(pts);
}

export function toothOutline(tooth: number, w: number, d: number): string {
  const i = toothIndex(tooth);
  if (i >= 6) {
    // моляр: почти прямоугольный, вестибулярная сторона чуть шире оральной
    return superellipse(w, d, 3.4, (x, y) => [x * (1 + 0.06 * (y / d)), y]);
  }
  if (i >= 4) {
    // премоляр: овал, вытянутый вестибуло-орально
    return superellipse(w, d * 0.95, 2.4);
  }
  if (i === 3) {
    // клык: ромбовидно-округлый, сужение к вестибулярному бугру
    return superellipse(w, d, 2.0, (x, y) => [x * (1 - 0.22 * Math.max(0, y / (d / 2))), y]);
  }
  // резцы: режущий край вытянут вдоль дуги, оральная сторона сужается к бугорку
  const depth = archOf(tooth) === 'upper' ? d * 0.82 : d * 0.78;
  return superellipse(w, depth, 2.6, (x, y) => [x * (1 - 0.38 * Math.max(0, -y / (depth / 2))), y]);
}

/** Детали жевательной поверхности: одна мягкая линия фиссуры. */
export function toothFissure(tooth: number, w: number, d: number): string | null {
  const i = toothIndex(tooth);
  if (i >= 6) {
    const x = w * 0.3;
    return `M${f(-x)} ${f(d * 0.04)}C${f(-x * 0.3)} ${f(-d * 0.1)} ${f(x * 0.3)} ${f(d * 0.14)} ${f(x)} ${f(-d * 0.02)}M${f(0)} ${f(d * 0.04)}L${f(w * 0.02)} ${f(d * 0.3)}`;
  }
  if (i >= 4) return `M${f(-w * 0.24)} 0Q0 ${f(d * 0.06)} ${f(w * 0.24)} 0`;
  return null;
}
