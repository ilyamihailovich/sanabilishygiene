import { describe, expect, it } from 'vitest';
import {
  computeBoib,
  emptyBrushMap,
  keysLostByChange,
  listElements,
  mirrorSide,
  setToothState,
  summarizeSizes,
  updateElement,
} from '@/domain/brushMap';

const keys = (c = emptyBrushMap()) => listElements(c).filter((e) => e.active).map((e) => e.key);

describe('элементы карты', () => {
  it('по умолчанию 28 зубов без третьих моляров: по 13 промежутков в челюсти', () => {
    const all = listElements(emptyBrushMap());
    expect(all.filter((e) => e.kind === 'interspace')).toHaveLength(26);
    expect(keys()).toContain('16-15');
    expect(keys()).toContain('11-21');
    expect(keys()).toContain('41-31');
    expect(keys()).not.toContain('18-17');
  });

  it('дистальные поверхности последних зубов есть, но выключены', () => {
    const edges = listElements(emptyBrushMap()).filter((e) => e.kind === 'edge');
    expect(edges.map((e) => e.key).sort()).toEqual(['17d', '27d', '37d', '47d']);
    expect(edges.every((e) => !e.active)).toBe(true);
  });

  it('при отсутствии 15: вместо 16-15 и 15-14 появляются 16m и 14d', () => {
    const c = setToothState(emptyBrushMap(), 15, 'MISSING');
    const all = listElements(c).map((e) => e.key);
    expect(all).not.toContain('16-15');
    expect(all).not.toContain('15-14');
    expect(all).toContain('16m');
    expect(all).toContain('14d');
  });

  it('левая сторона: при отсутствии 25 появляются 24d и 26m', () => {
    const all = listElements(setToothState(emptyBrushMap(), 25, 'MISSING')).map((e) => e.key);
    expect(all).toContain('24d');
    expect(all).toContain('26m');
  });

  it('имплантат и промежуточная часть сохраняют промежутки', () => {
    let c = setToothState(emptyBrushMap(), 36, 'IMPLANT');
    c = setToothState(c, 46, 'PONTIC');
    expect(keys(c)).toEqual(expect.arrayContaining(['35-36', '36-37', '47-46', '46-45']));
  });

  it('порядок осмотра: верхняя справа налево, затем нижняя слева направо', () => {
    const order = keys();
    expect(order[0]).toBe('17-16');
    expect(order.indexOf('26-27')).toBe(12);
    const lowerStart = order.findIndex((k) => k.startsWith('3') || k.startsWith('4'));
    expect(order[lowerStart]).toBe('36-37');
    expect(order[order.length - 1]).toBe('47-46');
  });

  it('предупреждает о данных, которые исчезнут при смене формулы', () => {
    const before = updateElement(emptyBrushMap(), '16-15', { size: { catalogId: 'a' } });
    const after = setToothState(before, 15, 'MISSING');
    expect(keysLostByChange(before, after)).toEqual(['16-15']);
  });
});

describe('BOIB', () => {
  it('не обследованные не входят в знаменатель', () => {
    let c = updateElement(emptyBrushMap(), '16-15', { bleeding: true });
    c = updateElement(c, '15-14', { bleeding: false });
    c = updateElement(c, '14-13', { bleeding: false });
    c = updateElement(c, '13-12', { bleeding: true });
    expect(computeBoib(c)).toEqual({ bleeding: 2, examined: 4, pct: 50 });
  });

  it('промежуток с назначенным размером считается обследованным без кровоточивости', () => {
    let c = updateElement(emptyBrushMap(), '16-15', { size: { catalogId: 'a' } });
    c = updateElement(c, '15-14', { size: { catalogId: 'a' }, bleeding: true });
    c = updateElement(c, '14-13', { alternative: 'FLOSS' });
    expect(computeBoib(c)).toEqual({ bleeding: 1, examined: 2, pct: 50 });
  });

  it('нет обследованных — индекс не считается', () => {
    expect(computeBoib(emptyBrushMap())).toEqual({ bleeding: 0, examined: 0, pct: null });
  });

  it('свободные поверхности не входят, промежутки у имплантатов входят', () => {
    let c = setToothState(emptyBrushMap(), 36, 'IMPLANT');
    c = updateElement(c, '35-36', { bleeding: true });
    c = updateElement(c, '17d', { enabled: true, bleeding: true });
    expect(computeBoib(c)).toEqual({ bleeding: 1, examined: 1, pct: 100 });
  });

  it('округление до целого', () => {
    let c = updateElement(emptyBrushMap(), '16-15', { bleeding: true });
    c = updateElement(c, '15-14', { bleeding: false });
    c = updateElement(c, '14-13', { bleeding: false });
    expect(computeBoib(c).pct).toBe(33);
  });
});

describe('сводка и зеркалирование', () => {
  it('считает размеры, свободный ввод отдельно', () => {
    let c = updateElement(emptyBrushMap(), '16-15', { size: { catalogId: 'a' } });
    c = updateElement(c, '15-14', { size: { catalogId: 'a' } });
    c = updateElement(c, '14-13', { size: { freeText: '1,5 мм' } });
    const s = summarizeSizes(c);
    expect(s.find((x) => x.catalogId === 'a')?.count).toBe(2);
    expect(s.find((x) => x.freeText === '1,5 мм')?.count).toBe(1);
  });

  it('выключенная свободная поверхность не попадает в сводку', () => {
    const c = updateElement(emptyBrushMap(), '17d', { size: { catalogId: 'a' } });
    expect(summarizeSizes(c)).toHaveLength(0);
  });

  it('копирует правую сторону верхней челюсти на левую, без срединного промежутка', () => {
    let c = updateElement(emptyBrushMap(), '16-15', { size: { catalogId: 'a' }, bleeding: true });
    c = updateElement(c, '11-21', { size: { catalogId: 'b' } });
    const { content, copied } = mirrorSide(c, 'upper', 'right');
    expect(content.elements['25-26']?.size).toEqual({ catalogId: 'a' });
    expect(content.elements['25-26']?.bleeding).toBe(true);
    expect(copied).toBe(7);
    expect(content.elements['46-45']).toBeUndefined();
  });
});
