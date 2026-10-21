import type { MapElement } from '@/domain/brushMap';
import { ARCH_ORDER, archOf, toothIndex, type Arch } from '@/domain/teeth';

/*
  Геометрия схемы: две дуги в окклюзионной проекции, правая сторона пациента слева на экране.
  Ширина и глубина зубов — усреднённые пропорции для рисунка, не клинические данные.
*/

export const VIEW_W = 1000;
export const VIEW_H = 880;

interface ArchSpec {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  /** +1 верхняя (выпуклостью вверх), −1 нижняя. */
  dir: 1 | -1;
  widths: number[];
  depths: number[];
}

const ARCHES: Record<Arch, ArchSpec> = {
  upper: {
    cx: 500,
    cy: 330,
    rx: 420,
    ry: 255,
    dir: 1,
    widths: [8.5, 6.6, 7.6, 7.0, 6.6, 10.2, 9.2, 8.6],
    depths: [7.0, 6.2, 8.0, 9.0, 9.0, 11.0, 10.8, 10.5],
  },
  lower: {
    cx: 500,
    cy: 560,
    rx: 400,
    ry: 245,
    dir: -1,
    widths: [5.2, 5.8, 6.8, 7.0, 7.1, 11.0, 10.4, 10.0],
    depths: [5.8, 6.0, 7.5, 7.6, 8.0, 10.4, 10.1, 9.8],
  },
};

const GAP_MM = 0.7;
const THETA_FROM = (200 * Math.PI) / 180;
const THETA_TO = (-20 * Math.PI) / 180;

export interface ToothGeom {
  tooth: number;
  arch: Arch;
  x: number;
  y: number;
  /** Угол касательной к дуге, градусы (для поворота силуэта). */
  angle: number;
  /** Единичная нормаль наружу (вестибулярно). */
  nx: number;
  ny: number;
  w: number;
  d: number;
  /** Позиция по длине дуги (px) центра и краёв зуба. */
  s: number;
}

/** Округление: тригонометрия на сервере и в браузере даёт расхождения в последних знаках (ошибка гидратации). */
const r2 = (v: number) => Math.round(v * 100) / 100;

function point(a: ArchSpec, t: number) {
  return { x: a.cx + a.rx * Math.cos(t), y: a.cy - a.dir * a.ry * Math.sin(t) };
}

function buildArch(arch: Arch): { teeth: ToothGeom[]; at: (s: number) => { x: number; y: number; nx: number; ny: number; angle: number } } {
  const a = ARCHES[arch];
  const N = 2000;
  const samples: Array<{ t: number; s: number; x: number; y: number }> = [];
  let s = 0;
  let prev = point(a, THETA_FROM);
  for (let i = 0; i <= N; i++) {
    const t = THETA_FROM + ((THETA_TO - THETA_FROM) * i) / N;
    const p = point(a, t);
    s += Math.hypot(p.x - prev.x, p.y - prev.y);
    samples.push({ t, s, ...p });
    prev = p;
  }
  const total = s;
  const at = (target: number) => {
    let lo = 0;
    let hi = samples.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (samples[mid]!.s < target) lo = mid;
      else hi = mid;
    }
    const p = samples[hi]!;
    const q = samples[Math.max(0, hi - 1)]!;
    const tx = p.x - q.x;
    const ty = p.y - q.y;
    const len = Math.hypot(tx, ty) || 1;
    // нормаль наружу: от центра эллипса
    let nx = ty / len;
    let ny = -tx / len;
    if ((p.x - a.cx) * nx + (p.y - a.cy) * ny < 0) {
      nx = -nx;
      ny = -ny;
    }
    return { x: r2(p.x), y: r2(p.y), nx: r2(nx), ny: r2(ny), angle: r2((Math.atan2(ty, tx) * 180) / Math.PI) };
  };

  const order = ARCH_ORDER[arch];
  const mm = order.map((t) => a.widths[toothIndex(t) - 1]! + GAP_MM);
  const sumMm = mm.reduce((x, y) => x + y, 0);
  const scale = total / sumMm;
  let cursor = 0;
  const teeth = order.map((tooth, i) => {
    const w = a.widths[toothIndex(tooth) - 1]! * scale;
    const d = a.depths[toothIndex(tooth) - 1]! * scale;
    const center = cursor + (mm[i]! * scale) / 2;
    cursor += mm[i]! * scale;
    const p = at(center);
    return { tooth, arch, x: p.x, y: p.y, angle: p.angle, nx: p.nx, ny: p.ny, w: r2(w), d: r2(d), s: r2(center) };
  });
  return { teeth, at };
}

const built = { upper: buildArch('upper'), lower: buildArch('lower') };

export const TEETH: ToothGeom[] = [...built.upper.teeth, ...built.lower.teeth];
const byTooth = new Map(TEETH.map((t) => [t.tooth, t]));
export const toothGeom = (tooth: number) => byTooth.get(tooth)!;

export interface Anchor {
  x: number;
  y: number;
  nx: number;
  ny: number;
}

/** Точка маркера элемента: контакт соседних зубов, со сдвигом вестибулярно. */
export function elementAnchor(el: Pick<MapElement, 'kind' | 'teeth' | 'surface' | 'arch'>): Anchor {
  const arch = built[el.arch];
  if (el.kind === 'edge') {
    const t = toothGeom(el.teeth[0]!);
    const order = ARCH_ORDER[el.arch];
    const idx = order.indexOf(t.tooth);
    // поверхность в сторону большего индекса по дуге: мезиальная справа, дистальная слева
    const towardNext = (el.surface === 'm') === (idx < 8);
    const p = arch.at(t.s + (towardNext ? 1 : -1) * (t.w / 2 + 6));
    return { x: r2(p.x + p.nx * 4), y: r2(p.y + p.ny * 4), nx: p.nx, ny: p.ny };
  }
  const [a, b] = el.teeth.map(toothGeom) as [ToothGeom, ToothGeom];
  const mid = (a.s + b.s) / 2 + (el.kind === 'extra' ? 0 : 0);
  const p = arch.at(mid);
  const offset = el.kind === 'extra' ? -Math.min(a.d, b.d) * 0.42 : 4;
  return { x: r2(p.x + p.nx * offset), y: r2(p.y + p.ny * offset), nx: p.nx, ny: p.ny };
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Область квадранта для мобильного вида. */
export function quadrantBox(q: 1 | 2 | 3 | 4): Box {
  const teeth = TEETH.filter((t) => Math.floor(t.tooth / 10) === q);
  const pad = 70;
  const xs = teeth.flatMap((t) => [t.x - t.d, t.x + t.d]);
  const ys = teeth.flatMap((t) => [t.y - t.d, t.y + t.d]);
  const x = Math.min(...xs) - pad;
  const y = Math.min(...ys) - pad;
  return { x, y, w: Math.max(...xs) - x + pad, h: Math.max(...ys) - y + pad };
}

export const archBox = (arch: Arch): Box => {
  const teeth = TEETH.filter((t) => archOf(t.tooth) === arch);
  const pad = 60;
  const xs = teeth.flatMap((t) => [t.x - t.d, t.x + t.d]);
  const ys = teeth.flatMap((t) => [t.y - t.d, t.y + t.d]);
  const x = Math.min(...xs) - pad;
  const y = Math.min(...ys) - pad;
  return { x, y, w: Math.max(...xs) - x + pad, h: Math.max(...ys) - y + pad };
};
