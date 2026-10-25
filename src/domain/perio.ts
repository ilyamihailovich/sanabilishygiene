import { perioToothSchema, type FurcationSite, type PerioContent, type PerioTooth } from '@/schemas/perio';

export const UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
export const LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
export const ALL_TEETH = [...UPPER, ...LOWER];

export type Side = 'buccal' | 'oral';
/** Индексы точек в массивах зуба: вестибулярные 0–2, оральные 3–5. */
export const SIDE_SITES: Record<Side, [number, number, number]> = { buccal: [0, 1, 2], oral: [3, 4, 5] };

export function emptyTooth(): PerioTooth {
  return perioToothSchema.parse({});
}

export function emptyPerio(preset?: { missing?: number[]; implants?: number[] }): PerioContent {
  const teeth: PerioContent['teeth'] = {};
  for (const t of ALL_TEETH) {
    teeth[String(t)] = { ...emptyTooth(), missing: preset?.missing?.includes(t) ?? false, implant: preset?.implants?.includes(t) ?? false };
  }
  return { schema: 1, teeth };
}

export const toothOf = (c: PerioContent, t: number): PerioTooth => c.teeth[String(t)] ?? emptyTooth();

/** Слева на схеме — правая сторона пациента (квадранты 1 и 4): дистальная точка слева. */
export const leftHalf = (t: number) => Math.floor(t / 10) === 1 || Math.floor(t / 10) === 4;

/** Точки стороны в порядке слева направо на экране. */
export function screenSites(t: number, side: Side): [number, number, number] {
  const [d, mid, m] = SIDE_SITES[side];
  return leftHalf(t) ? [d, mid, m] : [m, mid, d];
}

/** Точки входа фуркаций: верхние моляры — вестибулярно, мезио- и дистально-нёбно; первые верхние премоляры — мезио- и дистально-нёбно; нижние моляры — вестибулярно и язычно. */
export function furcationSites(t: number): FurcationSite[] {
  const q = Math.floor(t / 10);
  const n = t % 10;
  if (q <= 2) {
    if (n >= 6) return ['b', 'mo', 'do'];
    if (n === 4) return ['mo', 'do'];
    return [];
  }
  return n >= 6 ? ['b', 'o'] : [];
}

/** Уровень прикрепления = глубина зондирования − десневой край. */
export const attachment = (pd: number, gm: number) => pd - gm;

export interface PerioSummary {
  teeth: number;
  sites: number;
  meanPd: number;
  meanAl: number;
  bopPct: number;
  plaquePct: number;
  /** Точки с глубиной 4, 5 и 6 мм и больше. */
  pd4: number;
  pd5: number;
  pd6: number;
}

const round1 = (x: number) => Math.round(x * 10) / 10;

/** Итоги по присутствующим зубам и имплантатам: среднее по всем шести точкам. */
export function summarizePerio(c: PerioContent): PerioSummary {
  let teeth = 0;
  let pdSum = 0;
  let alSum = 0;
  let bop = 0;
  let plaque = 0;
  let pd4 = 0;
  let pd5 = 0;
  let pd6 = 0;
  for (const t of ALL_TEETH) {
    const tooth = toothOf(c, t);
    if (tooth.missing) continue;
    teeth++;
    for (let i = 0; i < 6; i++) {
      const pd = tooth.pd[i]!;
      pdSum += pd;
      alSum += attachment(pd, tooth.gm[i]!);
      if (tooth.bop[i]) bop++;
      if (tooth.plaque[i]) plaque++;
      if (pd === 4) pd4++;
      else if (pd === 5) pd5++;
      else if (pd >= 6) pd6++;
    }
  }
  const sites = teeth * 6;
  return {
    teeth,
    sites,
    meanPd: sites ? round1(pdSum / sites) : 0,
    meanAl: sites ? round1(alSum / sites) : 0,
    bopPct: sites ? Math.round((bop / sites) * 100) : 0,
    plaquePct: sites ? Math.round((plaque / sites) * 100) : 0,
    pd4,
    pd5,
    pd6,
  };
}

export interface ProbeStep {
  tooth: number;
  site: number;
  field: 'gm' | 'pd';
}

/**
 * Порядок зондирования по стандарту Бернского университета: верх вестибулярно 18→28, верх нёбно 28→18,
 * низ вестибулярно 38→48, низ язычно 48→38. В каждой точке сначала десневой край, затем глубина. Отсутствующие зубы пропускаются.
 */
export function probeSequence(c: PerioContent): ProbeStep[] {
  const steps: ProbeStep[] = [];
  const pass = (teeth: number[], side: Side, leftToRight: boolean) => {
    const ordered = leftToRight ? teeth : [...teeth].reverse();
    for (const t of ordered) {
      if (toothOf(c, t).missing) continue;
      const sites = screenSites(t, side);
      for (const site of leftToRight ? sites : [...sites].reverse()) {
        steps.push({ tooth: t, site, field: 'gm' }, { tooth: t, site, field: 'pd' });
      }
    }
  };
  pass(UPPER, 'buccal', true);
  pass(UPPER, 'oral', false);
  pass(LOWER, 'buccal', false);
  pass(LOWER, 'oral', true);
  return steps;
}

export function updateTooth(c: PerioContent, t: number, patch: (tooth: PerioTooth) => PerioTooth): PerioContent {
  return { ...c, teeth: { ...c.teeth, [String(t)]: patch(toothOf(c, t)) } };
}

export function setSite<K extends 'gm' | 'pd' | 'bop' | 'plaque'>(c: PerioContent, t: number, field: K, site: number, value: PerioTooth[K][number]): PerioContent {
  return updateTooth(c, t, (tooth) => {
    const arr = [...tooth[field]] as PerioTooth[K];
    (arr as unknown[])[site] = value;
    return { ...tooth, [field]: arr };
  });
}
