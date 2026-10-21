/** Зубная формула FDI: позиции, дуги, стороны. */

export type Arch = 'upper' | 'lower';
export type Side = 'right' | 'left';
export type ToothState = 'PRESENT' | 'MISSING' | 'IMPLANT' | 'PONTIC';

/** Порядок по дуге справа налево от пациента. */
export const ARCH_ORDER: Record<Arch, readonly number[]> = {
  upper: [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28],
  lower: [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38],
};

export const ALL_TEETH: readonly number[] = [...ARCH_ORDER.upper, ...ARCH_ORDER.lower];

export const quadrant = (tooth: number) => Math.floor(tooth / 10);
export const archOf = (tooth: number): Arch => (quadrant(tooth) <= 2 ? 'upper' : 'lower');
export const sideOf = (tooth: number): Side => (quadrant(tooth) === 1 || quadrant(tooth) === 4 ? 'right' : 'left');
/** Номер зуба в квадранте: 1 — центральный резец, 8 — третий моляр. */
export const toothIndex = (tooth: number) => tooth % 10;

export const isThirdMolar = (tooth: number) => toothIndex(tooth) === 8;

/** Многокорневые зубы, где возможна фуркация. */
export const isMultiRooted = (tooth: number) =>
  toothIndex(tooth) >= 6 || (archOf(tooth) === 'upper' && toothIndex(tooth) === 4);

/** Зеркальный зуб на другой стороне той же челюсти: 16 → 26, 34 → 44. */
export function mirrorTooth(tooth: number): number {
  const q = quadrant(tooth);
  const mirrored = { 1: 2, 2: 1, 3: 4, 4: 3 }[q];
  if (!mirrored) throw new Error(`Неизвестный зуб ${tooth}`);
  return mirrored * 10 + toothIndex(tooth);
}

/** Соответствующий зуб противоположной челюсти: 16 → 46. */
export function opposingTooth(tooth: number): number {
  const q = quadrant(tooth);
  const opposing = { 1: 4, 4: 1, 2: 3, 3: 2 }[q];
  if (!opposing) throw new Error(`Неизвестный зуб ${tooth}`);
  return opposing * 10 + toothIndex(tooth);
}

export const toothStateLabels: Record<ToothState, string> = {
  PRESENT: 'Присутствует',
  MISSING: 'Отсутствует',
  IMPLANT: 'Имплантат',
  PONTIC: 'Промежуточная часть протеза',
};

export function defaultTeeth(): Record<string, { state: ToothState; furcation: boolean }> {
  return Object.fromEntries(
    ALL_TEETH.map((t) => [String(t), { state: isThirdMolar(t) ? 'MISSING' : 'PRESENT', furcation: false }]),
  );
}
