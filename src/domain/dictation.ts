import type { MapElement } from './brushMap';
import type { ToothState } from './teeth';

/*
  Голосовой ввод карты ёршиков: разбор распознанной фразы в действия редактора.
  Фраза приходит от распознавания речи как есть: числа словами или цифрами, без пунктуации.
  Пример: «шестнадцать пятнадцать тепе ноль шесть кровоточивость дальше 0,8».
*/

export interface DictationSize {
  id: string;
  /** Производитель с линейкой, как в каталоге: «TePe Original». */
  brand: string;
  passageMm: string;
  /** Особая форма того же размера (конус): по одному числу не выбирается, только в карточке. */
  variant?: boolean;
}

export type DictationAction =
  | { kind: 'select'; key: string; label: string }
  | { kind: 'brand'; brand: string }
  | { kind: 'size'; catalogId: string; brand: string; mm: string }
  | { kind: 'bleeding'; value: boolean }
  | { kind: 'floss' }
  | { kind: 'clear' }
  | { kind: 'tooth'; tooth: number; state: ToothState }
  | { kind: 'next' }
  | { kind: 'undo' };

export interface DictationResult {
  actions: DictationAction[];
  /** Части фразы, которые не удалось понять: показываются врачу, чтобы он повторил. */
  unknown: string[];
}

const UNITS: Record<string, number> = {
  ноль: 0, нуль: 0, один: 1, одна: 1, одну: 1, два: 2, две: 2, три: 3, четыре: 4, пять: 5, шесть: 6, семь: 7, восемь: 8, девять: 9,
};
const TEENS: Record<string, number> = {
  десять: 10, одиннадцать: 11, двенадцать: 12, тринадцать: 13, четырнадцать: 14, пятнадцать: 15,
  шестнадцать: 16, семнадцать: 17, восемнадцать: 18, девятнадцать: 19,
};
const TENS: Record<string, number> = { двадцать: 20, тридцать: 30, сорок: 40 };

/** Производители: как их произносят и как их пишет распознавание. Ключ — начало названия в каталоге. */
const BRAND_WORDS: Array<[RegExp, string]> = [
  [/^(тепе|тепэ|тэпэ|тепей|tepe)/, 'tepe'],
  [/^(курапрокс|кюрапрокс|curaprox)/, 'curaprox'],
  [/^(курасепт|курасэпт|кюрасепт|curasept)/, 'curasept'],
];

const STATE_WORDS: Array<[RegExp, ToothState]> = [
  [/^(отсутств|удал|нет$)/, 'MISSING'],
  [/^имплант/, 'IMPLANT'],
  [/^коронк/, 'CROWN'],
  [/^(мост|промежуточ|понтик)/, 'PONTIC'],
  [/^(есть|наместе|присутств|свой)$/, 'PRESENT'],
];

type Token = { t: 'num'; v: number; digits: string; raw: string } | { t: 'dec'; v: string; raw: string } | { t: 'word'; v: string; raw: string };

const isTooth = (n: number) => n >= 11 && n <= 48 && n % 10 >= 1 && n % 10 <= 8;

function tokenize(text: string): Token[] {
  const words = text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/(\d)[.,](\d)/g, '$1#$2')
    .replace(/[^a-zа-я0-9#\s/-]/g, ' ')
    .replace(/(\d)\s*[/-]\s*(\d)/g, '$1 $2')
    .replace(/на месте/g, 'наместе')
    .split(/\s+/)
    .filter(Boolean);
  const out: Token[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    if (/^\d#\d+$/.test(w)) {
      out.push({ t: 'dec', v: w.replace('#', '.'), raw: w.replace('#', ',') });
    } else if (/^\d+$/.test(w)) {
      // «1615» — два зуба подряд, «06» — 0,6 мм
      if (w.length === 4 && isTooth(Number(w.slice(0, 2))) && isTooth(Number(w.slice(2)))) {
        out.push({ t: 'num', v: Number(w.slice(0, 2)), digits: w.slice(0, 2), raw: w.slice(0, 2) });
        out.push({ t: 'num', v: Number(w.slice(2)), digits: w.slice(2), raw: w.slice(2) });
      } else if (/^0\d$/.test(w)) out.push({ t: 'dec', v: `0.${w[1]}`, raw: w });
      else out.push({ t: 'num', v: Number(w), digits: w, raw: w });
    } else if (w in TENS) {
      const next = words[i + 1];
      const unit = next !== undefined ? UNITS[next] : undefined;
      if (unit !== undefined && unit > 0) {
        out.push({ t: 'num', v: TENS[w]! + unit, digits: String(TENS[w]! + unit), raw: `${w} ${next}` });
        i++;
      } else out.push({ t: 'num', v: TENS[w]!, digits: String(TENS[w]!), raw: w });
    } else if (w in TEENS) out.push({ t: 'num', v: TEENS[w]!, digits: String(TEENS[w]!), raw: w });
    else if (w in UNITS) out.push({ t: 'num', v: UNITS[w]!, digits: String(UNITS[w]!), raw: w });
    else out.push({ t: 'word', v: w, raw: w });
  }
  // десятичные: «ноль шесть», «ноль запятая шесть», «одна целая три», «один и три»
  const merged: Token[] = [];
  for (let i = 0; i < out.length; i++) {
    const a = out[i]!;
    const b = out[i + 1];
    const c = out[i + 2];
    const glue = b?.t === 'word' && /^(запятая|точка|целых|целая|и)$/.test(b.v);
    if (a.t === 'num' && a.v <= 2 && glue && c?.t === 'num' && c.v <= 9) {
      merged.push({ t: 'dec', v: `${a.v}.${c.v}`, raw: `${a.raw} ${b.raw} ${c.raw}` });
      i += 2;
      if (out[i + 1]?.t === 'word' && /^десят/.test((out[i + 1] as { v: string }).v)) i++;
    } else if (a.t === 'num' && a.v === 0 && b?.t === 'num' && b.v <= 9 && b.digits.length === 1) {
      merged.push({ t: 'dec', v: `0.${b.v}`, raw: `${a.raw} ${b.raw}` });
      i++;
    } else merged.push(a);
  }
  return merged;
}

const mmKey = (mm: string) => Number(mm).toFixed(2);

/**
 * Разбор фразы. brand — текущий производитель (последний выбранный): размер без названия производителя берётся из него.
 * Пара соседних зубов выбирает промежуток; следующие за ней размер и отметки относятся к нему.
 */
export function parseDictation(text: string, ctx: { elements: MapElement[]; catalog: DictationSize[]; brand: string | null }): DictationResult {
  const tokens = tokenize(text);
  const actions: DictationAction[] = [];
  const unknown: string[] = [];
  let brand = ctx.brand;
  const brands = [...new Set(ctx.catalog.map((c) => c.brand))];
  const pair = new Map<string, MapElement>();
  for (const el of ctx.elements) {
    if (el.kind !== 'interspace' || el.teeth.length !== 2) continue;
    pair.set(`${el.teeth[0]}-${el.teeth[1]}`, el);
    pair.set(`${el.teeth[1]}-${el.teeth[0]}`, el);
  }

  const sizeFor = (mm: string, raw: string) => {
    const own = ctx.catalog.filter((c) => (brand ? c.brand === brand : true) && mmKey(c.passageMm) === mmKey(mm));
    const plain = own.length > 1 && brand ? own.filter((c) => !c.variant) : own;
    const hit = plain.length === 1 ? plain[0] : undefined;
    if (hit) actions.push({ kind: 'size', catalogId: hit.id, brand: hit.brand, mm: hit.passageMm });
    else if (own.length > 1) unknown.push(`${raw} мм: назовите производителя`);
    else unknown.push(brand ? `${raw} мм нет у ${brand}` : `${raw} мм нет в каталоге`);
  };

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]!;
    const next = tokens[i + 1];
    if (tok.t === 'num' && isTooth(tok.v)) {
      // зуб и его состояние: «тридцать шесть имплантат»
      const stateWord = next?.t === 'word' ? STATE_WORDS.find(([re]) => re.test(next.v)) : undefined;
      if (stateWord) {
        actions.push({ kind: 'tooth', tooth: tok.v, state: stateWord[1] });
        i++;
        continue;
      }
      // поверхность у края ряда: «семнадцать дистальная»
      if (next?.t === 'word' && /^(дистальн|мезиальн)/.test(next.v)) {
        const word = next.v.slice(0, 6);
        const el = ctx.elements.find((e) => e.kind === 'edge' && e.teeth[0] === tok.v && e.label.toLowerCase().includes(word));
        if (el) actions.push({ kind: 'select', key: el.key, label: el.label });
        else unknown.push(`${tok.raw} ${next.raw}`);
        i++;
        continue;
      }
      if (next?.t === 'num' && isTooth(next.v)) {
        const el = pair.get(`${tok.v}-${next.v}`);
        if (el) actions.push({ kind: 'select', key: el.key, label: el.label });
        else unknown.push(`${tok.raw} ${next.raw}: нет такого промежутка`);
        i++;
        continue;
      }
      unknown.push(tok.raw);
      continue;
    }
    if (tok.t === 'dec') {
      sizeFor(tok.v, tok.raw.replace('.', ','));
      if (next?.t === 'word' && /^(мм|миллиметр)/.test(next.v)) i++;
      continue;
    }
    if (tok.t === 'num') {
      // «1,3» могут распознать как «1 3 мм» — только с явными миллиметрами
      const after = tokens[i + 2];
      if (tok.v <= 2 && next?.t === 'num' && next.v <= 9 && after?.t === 'word' && /^(мм|миллиметр)/.test(after.v)) {
        sizeFor(`${tok.v}.${next.v}`, `${tok.v},${next.v}`);
        i += 2;
        continue;
      }
      unknown.push(tok.raw);
      continue;
    }
    const w = tok.v;
    const brandWord = BRAND_WORDS.find(([re]) => re.test(w));
    if (brandWord) {
      const full = brands.find((b) => b.toLowerCase().startsWith(brandWord[1]));
      if (full) {
        brand = full;
        actions.push({ kind: 'brand', brand: full });
      } else unknown.push(tok.raw);
      // «тепе ориджинал», «курапрокс прайм» — линейка уже входит в название
      if (next?.t === 'word' && /^(ориджинал|оригинал|original|прайм|prime|прокси|proxi)/.test(next.v)) i++;
      continue;
    }
    if (/^(без|нет)$/.test(w) && next?.t === 'word' && /^кров/.test(next.v)) {
      actions.push({ kind: 'bleeding', value: false });
      i++;
      continue;
    }
    if (/^кров/.test(w)) {
      actions.push({ kind: 'bleeding', value: true });
      continue;
    }
    if (/^нит/.test(w) || w === 'флосс') {
      actions.push({ kind: 'floss' });
      continue;
    }
    if (/^(дальше|следующ|далее)/.test(w)) {
      actions.push({ kind: 'next' });
      continue;
    }
    if (/^(отмен|назад)/.test(w)) {
      actions.push({ kind: 'undo' });
      continue;
    }
    if (/^(очист|сброс|стереть)/.test(w)) {
      actions.push({ kind: 'clear' });
      continue;
    }
    // служебные слова фразы
    if (/^(промежут|между|зуб|размер|ершик|миллиметр)/.test(w) || /^(мм|и|а|точка|запятая)$/.test(w)) continue;
    unknown.push(tok.raw);
  }
  return { actions, unknown };
}
