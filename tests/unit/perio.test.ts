import { describe, expect, it } from 'vitest';
import { attachment, emptyPerio, furcationSites, probeSequence, screenSites, setSite, summarizePerio, updateTooth } from '@/domain/perio';

describe('пародонтограмма', () => {
  it('уровень прикрепления = глубина − десневой край (примеры из калибровки)', () => {
    expect(attachment(2, 2)).toBe(0);
    expect(attachment(7, 2)).toBe(5);
    expect(attachment(2, -4)).toBe(6);
    expect(attachment(5, 5)).toBe(0);
  });

  it('точки фуркации по зубам', () => {
    expect(furcationSites(16)).toEqual(['b', 'mo', 'do']);
    expect(furcationSites(24)).toEqual(['mo', 'do']);
    expect(furcationSites(15)).toEqual([]);
    expect(furcationSites(46)).toEqual(['b', 'o']);
    expect(furcationSites(44)).toEqual([]);
  });

  it('на экране у 1-го и 4-го квадрантов дистальная точка слева, у 2-го и 3-го — мезиальная', () => {
    expect(screenSites(16, 'buccal')).toEqual([0, 1, 2]);
    expect(screenSites(26, 'buccal')).toEqual([2, 1, 0]);
    expect(screenSites(36, 'oral')).toEqual([5, 4, 3]);
  });

  it('итоги: средние по присутствующим зубам, проценты BOP и налёта', () => {
    let c = emptyPerio({ missing: [18, 28, 38, 48] });
    c = setSite(c, 16, 'pd', 0, 6);
    c = setSite(c, 16, 'gm', 0, -2);
    c = setSite(c, 16, 'bop', 0, true);
    c = setSite(c, 11, 'plaque', 1, true);
    const s = summarizePerio(c);
    expect(s.teeth).toBe(28);
    expect(s.sites).toBe(168);
    expect(s.meanPd).toBe(0);
    expect(s.pd6).toBe(1);
    expect(s.bopPct).toBe(1);
    expect(s.meanAl).toBeCloseTo(0, 1);
  });

  it('порядок зондирования: верх вестибулярно с 18-го, у каждой точки десна, затем глубина; отсутствующие пропускаются', () => {
    const c = updateTooth(emptyPerio(), 18, (t) => ({ ...t, missing: true }));
    const seq = probeSequence(c);
    expect(seq.slice(0, 2)).toEqual([
      { tooth: 17, site: 0, field: 'gm' },
      { tooth: 17, site: 0, field: 'pd' },
    ]);
    expect(seq).toHaveLength(31 * 6 * 2);
    // нёбная сторона идёт справа налево: начинается с 28
    const firstPalatal = seq.find((x) => x.site >= 3)!;
    expect(firstPalatal.tooth).toBe(28);
  });
});
