import { describe, expect, it } from 'vitest';
import { emptyBrushMap, updateElement } from '@/domain/brushMap';
import { brushChanges, delta, visitMetrics } from '@/domain/history';
import { emptyPerio, setSite } from '@/domain/perio';
import { emptyPsr } from '@/domain/psr';

const visit = { id: 'v1', date: '2026-10-22', status: 'ISSUED' as const, lastIssueId: null };
const catalog = (id: string) => (id === 'a' ? { label: '0,6 мм', brand: 'TePe Original', color: '#0066ae' } : null);

describe('показатели визита для карточки пациента', () => {
  it('собирает BOIB, набор ёршиков, формулу, PSR и пародонтограмму', () => {
    const map = updateElement(updateElement(emptyBrushMap(), '16-15', { size: { catalogId: 'a' }, bleeding: true }), '15-14', { size: { catalogId: 'a' }, bleeding: false });
    const psr = emptyPsr();
    psr.sextants.S1 = { code: 3, asterisk: true };
    const perio = setSite(emptyPerio(), 16, 'pd', 0, 6);
    const m = visitMetrics(visit, [
      { type: 'BRUSH_MAP', content: map },
      { type: 'PSR', content: psr },
      { type: 'PERIO_CHART', content: perio },
    ], catalog);
    expect(m.boib).toMatchObject({ pct: 50, bleeding: 1, examined: 2 });
    expect(m.brushes).toEqual([{ ref: 'c:a', label: '0,6 мм', brand: 'TePe Original', color: '#0066ae', count: 2 }]);
    expect(m.teeth).toEqual({ present: 28, missing: 4, implants: 0, crowns: 0 });
    expect(m.psr).toMatchObject({ max: 3, star: true });
    expect(m.psr!.sextants.S1).toBe(3);
    expect(m.perio!.pd6).toBe(1);
  });

  it('незаполненный скрининг и отсутствующие документы — null', () => {
    const m = visitMetrics(visit, [{ type: 'PSR', content: emptyPsr() }], catalog);
    expect(m.psr).toBeNull();
    expect(m.boib).toBeNull();
    expect(m.perio).toBeNull();
  });

  it('разница с прошлым визитом и изменения набора ёршиков', () => {
    expect(delta([40, null, 22])).toBe(-18);
    expect(delta([null, 5])).toBeNull();
    const a = { ref: 'c:a', label: '0,6 мм', brand: null, color: null, count: 1 };
    const b = { ref: 'c:b', label: '0,8 мм', brand: null, color: null, count: 1 };
    expect(brushChanges([a], [a, b])).toEqual({ added: [b], removed: [] });
  });
});
