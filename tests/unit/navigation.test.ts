import { describe, expect, it } from 'vitest';
import { emptyBrushMap, listElements, setToothState, updateElement } from '@/domain/brushMap';
import { navigate } from '@/domain/navigation';

describe('навигация с клавиатуры', () => {
  const els = listElements(emptyBrushMap());

  it('без фокуса начинает с первого промежутка', () => {
    expect(navigate(els, null, 'next')).toBe('17-16');
    expect(navigate(els, null, 'prev')).toBe('47-46');
  });

  it('по порядку осмотра и по кругу', () => {
    expect(navigate(els, '17-16', 'next')).toBe('16-15');
    expect(navigate(els, '26-27', 'next')).toBe('36-37');
    expect(navigate(els, '47-46', 'next')).toBe('17-16');
    expect(navigate(els, '17-16', 'prev')).toBe('47-46');
  });

  it('вверх и вниз на ближайший промежуток другой челюсти', () => {
    expect(navigate(els, '16-15', 'down')).toBe('46-45');
    expect(navigate(els, '35-36', 'up')).toBe('25-26');
    expect(navigate(els, '16-15', 'up')).toBe('16-15');
  });

  it('пропускает исчезнувшие и выключенные элементы', () => {
    const c = setToothState(emptyBrushMap(), 15, 'MISSING');
    const list = listElements(c);
    expect(navigate(list, '17-16', 'next')).toBe('14-13');
    const withEdge = listElements(updateElement(c, '16m', { enabled: true }));
    expect(navigate(withEdge, '17-16', 'next')).toBe('16m');
  });
});
