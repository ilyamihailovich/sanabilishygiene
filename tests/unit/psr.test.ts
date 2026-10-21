import { describe, expect, it } from 'vitest';
import { emptyPsr, summarizePsr } from '@/domain/psr';

describe('итог PSR', () => {
  it('пустой скрининг без итога', () => {
    expect(summarizePsr(emptyPsr())).toEqual({ maxCode: null, asterisk: false, filled: 0, total: 6 });
  });

  it('наибольший код при неполном заполнении', () => {
    const c = emptyPsr();
    c.sextants.S1 = { code: 2, asterisk: false };
    c.sextants.S4 = { code: 3, asterisk: true };
    expect(summarizePsr(c)).toEqual({ maxCode: 3, asterisk: true, filled: 2, total: 6 });
  });

  it('X не участвует в максимуме, но считается заполненным', () => {
    const c = emptyPsr();
    c.sextants.S1 = { code: 'X', asterisk: true };
    c.sextants.S2 = { code: 0, asterisk: false };
    expect(summarizePsr(c)).toEqual({ maxCode: 0, asterisk: false, filled: 2, total: 6 });
  });

  it('все секстанты X — итога нет', () => {
    const c = emptyPsr();
    for (const k of ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'] as const) c.sextants[k] = { code: 'X', asterisk: false };
    expect(summarizePsr(c).maxCode).toBeNull();
  });
});
