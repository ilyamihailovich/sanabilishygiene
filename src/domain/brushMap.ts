import type { BrushMapContent, ElementData, Extra } from '@/schemas/brushMap';
import { ARCH_ORDER, archOf, defaultTeeth, mirrorTooth, sideOf, type Arch, type Side, type ToothState } from './teeth';

/*
  Элементы карты ёршиков:
  - interspace: промежуток между соседними занятыми позициями, ключ «16-15» (порядок по дуге);
  - edge: свободная проксимальная поверхность у дефекта или в конце ряда, ключ «16m», «17d», по умолчанию выключена;
  - extra: дополнительный промежуток, добавленный вручную, ключ «x:<id>».
*/

export type ElementKind = 'interspace' | 'edge' | 'extra';
export type Surface = 'm' | 'd';

export interface MapElement {
  key: string;
  kind: ElementKind;
  label: string;
  arch: Arch;
  /** Зубы, к которым привязан элемент (для edge — один зуб). */
  teeth: number[];
  surface?: Surface;
  /** Позиция по дуге в единицах «индекс зуба», для схемы и навигации. */
  archPos: number;
  data: ElementData;
  /** Входит ли в карту: свободные поверхности по умолчанию выключены. */
  active: boolean;
}

export const DEFAULT_ELEMENT: ElementData = {
  size: null,
  approach: 'VESTIBULAR',
  method: 'THROUGH',
  bleeding: null,
  pain: false,
  openContact: false,
  alternative: null,
};

export function emptyBrushMap(): BrushMapContent {
  return { schema: 1, teeth: defaultTeeth(), elements: {}, extras: [] };
}

export function toothState(content: BrushMapContent, tooth: number): ToothState {
  return content.teeth[String(tooth)]?.state ?? 'PRESENT';
}

const occupied = (content: BrushMapContent, tooth: number) => toothState(content, tooth) !== 'MISSING';

/** Поверхность зуба, обращённая к соседу с бо́льшим индексом по дуге (справа налево от пациента). */
function surfaceTowardsNext(tooth: number): Surface {
  return sideOf(tooth) === 'right' ? 'm' : 'd';
}

function surfaceTowardsPrev(tooth: number): Surface {
  return sideOf(tooth) === 'right' ? 'd' : 'm';
}

export const interspaceKey = (a: number, b: number) => `${a}-${b}`;
export const interspaceLabel = (a: number, b: number) => `${a}/${b}`;
export const edgeKey = (tooth: number, surface: Surface) => `${tooth}${surface}`;
export const edgeLabel = (tooth: number, surface: Surface) => `${tooth} ${surface === 'm' ? 'мезиальная' : 'дистальная'}`;

function withData(content: BrushMapContent, key: string): ElementData {
  const stored = content.elements[key];
  return stored ? { ...DEFAULT_ELEMENT, ...stored } : { ...DEFAULT_ELEMENT };
}

function archElements(content: BrushMapContent, arch: Arch): MapElement[] {
  const order = ARCH_ORDER[arch];
  const present = order.map((t, i) => ({ t, i })).filter(({ t }) => occupied(content, t));
  const result: MapElement[] = [];
  const edge = (tooth: number, surface: Surface, archPos: number) => {
    const key = edgeKey(tooth, surface);
    const data = withData(content, key);
    result.push({
      key,
      kind: 'edge',
      label: edgeLabel(tooth, surface),
      arch,
      teeth: [tooth],
      surface,
      archPos,
      data,
      active: data.enabled === true,
    });
  };

  const first = present[0];
  if (first) edge(first.t, surfaceTowardsPrev(first.t), first.i - 0.5);

  for (let k = 0; k + 1 < present.length; k++) {
    const a = present[k]!;
    const b = present[k + 1]!;
    if (b.i - a.i === 1) {
      const key = interspaceKey(a.t, b.t);
      result.push({
        key,
        kind: 'interspace',
        label: interspaceLabel(a.t, b.t),
        arch,
        teeth: [a.t, b.t],
        archPos: a.i + 0.5,
        data: withData(content, key),
        active: true,
      });
    } else {
      edge(a.t, surfaceTowardsNext(a.t), a.i + 0.5);
      edge(b.t, surfaceTowardsPrev(b.t), b.i - 0.5);
    }
  }

  const last = present[present.length - 1];
  if (last) edge(last.t, surfaceTowardsNext(last.t), last.i + 0.5);

  for (const extra of content.extras) {
    if (archOf(extra.between[0]) !== arch) continue;
    const [ia, ib] = extra.between.map((t) => order.indexOf(t));
    if (ia === undefined || ib === undefined || ia < 0 || ib < 0) continue;
    const key = `x:${extra.id}`;
    result.push({
      key,
      kind: 'extra',
      label: extra.label,
      arch,
      teeth: [...extra.between],
      archPos: (ia + ib) / 2 + 0.15,
      data: withData(content, key),
      active: true,
    });
  }

  return result.sort((x, y) => x.archPos - y.archPos);
}

/** Все элементы карты в порядке осмотра: верхняя 18→28, затем нижняя 38→48. */
export function listElements(content: BrushMapContent): MapElement[] {
  return [...archElements(content, 'upper'), ...archElements(content, 'lower').reverse()];
}

export function elementsByArch(content: BrushMapContent): Record<Arch, MapElement[]> {
  return { upper: archElements(content, 'upper'), lower: archElements(content, 'lower') };
}

/** Элемент заполнен: назначен размер или альтернатива. */
export const isFilled = (d: ElementData) => d.size !== null || d.alternative !== null;

/** Ключи, у которых есть данные, но которые исчезнут при новой формуле (для подтверждения). */
export function keysLostByChange(before: BrushMapContent, after: BrushMapContent): string[] {
  const keep = new Set(listElements(after).map((e) => e.key));
  return listElements(before)
    .filter((e) => !keep.has(e.key) && (isFilled(e.data) || e.data.bleeding !== null))
    .map((e) => e.key);
}

export function setToothState(content: BrushMapContent, tooth: number, state: ToothState): BrushMapContent {
  const current = content.teeth[String(tooth)] ?? { state: 'PRESENT', furcation: false };
  return {
    ...content,
    teeth: { ...content.teeth, [tooth]: { ...current, state, furcation: state === 'MISSING' ? false : current.furcation } },
    extras: state === 'MISSING' ? content.extras.filter((x) => !x.between.includes(tooth)) : content.extras,
  };
}

export function setFurcation(content: BrushMapContent, tooth: number, furcation: boolean): BrushMapContent {
  const current = content.teeth[String(tooth)] ?? { state: 'PRESENT', furcation: false };
  return { ...content, teeth: { ...content.teeth, [tooth]: { ...current, furcation } } };
}

export function updateElement(content: BrushMapContent, key: string, patch: Partial<ElementData>): BrushMapContent {
  return { ...content, elements: { ...content.elements, [key]: { ...withData(content, key), ...patch } } };
}

export function addExtra(content: BrushMapContent, extra: Extra): BrushMapContent {
  return { ...content, extras: [...content.extras, extra] };
}

export function removeExtra(content: BrushMapContent, id: string): BrushMapContent {
  const { [`x:${id}`]: _removed, ...elements } = content.elements;
  return { ...content, extras: content.extras.filter((x) => x.id !== id), elements };
}

function mirrorKey(key: string): string | null {
  const inter = /^(\d{2})-(\d{2})$/.exec(key);
  if (inter) {
    const a = mirrorTooth(Number(inter[1]));
    const b = mirrorTooth(Number(inter[2]));
    if (a === Number(inter[2]) && b === Number(inter[1])) return null; // срединный промежуток
    const order = ARCH_ORDER[archOf(a)];
    return order.indexOf(a) < order.indexOf(b) ? interspaceKey(a, b) : interspaceKey(b, a);
  }
  const edge = /^(\d{2})([md])$/.exec(key);
  if (edge) return `${mirrorTooth(Number(edge[1]))}${edge[2]}`;
  return null;
}

/**
 * Копирует данные элементов с одной стороны челюсти на другую.
 * Формула зубов не копируется; элементы, которых нет на целевой стороне, пропускаются.
 * Возвращает новую карту и число скопированных элементов.
 */
export function mirrorSide(content: BrushMapContent, arch: Arch, from: Side): { content: BrushMapContent; copied: number } {
  const elements = listElements(content).filter((e) => e.arch === arch && e.kind !== 'extra');
  const targetKeys = new Set(elements.map((e) => e.key));
  let next = content;
  let copied = 0;
  for (const el of elements) {
    if (!el.teeth.every((t) => sideOf(t) === from)) continue;
    const target = mirrorKey(el.key);
    if (!target || !targetKeys.has(target)) continue;
    next = updateElement(next, target, { ...el.data });
    copied++;
  }
  return { content: next, copied };
}

export interface BoibResult {
  bleeding: number;
  examined: number;
  /** Целое число процентов или null, если не обследован ни один промежуток. */
  pct: number | null;
}

/** Промежуток обследован: через него проведён ёршик (назначен размер) или кровоточивость отмечена явно. */
export const isExamined = (d: ElementData) => d.bleeding !== null || d.size !== null;

/** BOIB: кровоточащие / обследованные × 100 %. Свободные поверхности не входят. */
export function computeBoib(content: BrushMapContent): BoibResult {
  const relevant = listElements(content).filter((e) => e.kind !== 'edge' && e.active && isExamined(e.data));
  const bleeding = relevant.filter((e) => e.data.bleeding === true).length;
  const examined = relevant.length;
  return { bleeding, examined, pct: examined ? Math.round((bleeding / examined) * 100) : null };
}

export interface SizeUsage {
  ref: string;
  catalogId?: string;
  freeText?: string;
  count: number;
  keys: string[];
}

/** Сводка «Что понадобится»: размеры и число промежутков для каждого. */
export function summarizeSizes(content: BrushMapContent): SizeUsage[] {
  const map = new Map<string, SizeUsage>();
  for (const el of listElements(content)) {
    if (!el.active || !el.data.size) continue;
    const size = el.data.size;
    const ref = 'catalogId' in size ? `c:${size.catalogId}` : `f:${size.freeText.toLowerCase()}`;
    const entry =
      map.get(ref) ??
      ('catalogId' in size ? { ref, catalogId: size.catalogId, count: 0, keys: [] } : { ref, freeText: size.freeText, count: 0, keys: [] });
    entry.count++;
    entry.keys.push(el.key);
    map.set(ref, entry);
  }
  return [...map.values()];
}

export function usedCatalogIds(content: BrushMapContent): string[] {
  return summarizeSizes(content).flatMap((s) => (s.catalogId ? [s.catalogId] : []));
}
