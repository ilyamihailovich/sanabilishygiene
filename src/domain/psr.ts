import { SEXTANTS, type PsrContent } from '@/schemas/psr';

export function emptyPsr(): PsrContent {
  const blank = { code: null, asterisk: false };
  return { schema: 1, sextants: { S1: blank, S2: blank, S3: blank, S4: blank, S5: blank, S6: blank } };
}

export interface PsrSummary {
  /** Наибольший код по заполненным секстантам (X не учитывается); null, если кодов нет. */
  maxCode: number | null;
  asterisk: boolean;
  filled: number;
  total: number;
}

/** Итог PSR по наибольшему коду; работает при неполном заполнении. */
export function summarizePsr(content: PsrContent): PsrSummary {
  let maxCode: number | null = null;
  let asterisk = false;
  let filled = 0;
  for (const { id } of SEXTANTS) {
    const s = content.sextants[id];
    if (s.code !== null) filled++;
    if (typeof s.code === 'number') maxCode = maxCode === null ? s.code : Math.max(maxCode, s.code);
    if (s.asterisk && s.code !== 'X') asterisk = true;
  }
  return { maxCode, asterisk, filled, total: SEXTANTS.length };
}

/** Зубы секстанта для подсказки об открытой фуркации. */
export const SEXTANT_TEETH: Record<(typeof SEXTANTS)[number]['id'], number[]> = {
  S1: [17, 16, 15, 14],
  S2: [13, 12, 11, 21, 22, 23],
  S3: [24, 25, 26, 27],
  S4: [47, 46, 45, 44],
  S5: [43, 42, 41, 31, 32, 33],
  S6: [34, 35, 36, 37],
};
