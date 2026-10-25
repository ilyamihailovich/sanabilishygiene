/** Название ёршика для врача и пациента: производитель и линейка, например «TePe Original». */
export function brushBrand(c: { brand: string; line: string }) {
  return [c.brand, c.line].filter(Boolean).join(' ');
}

/** Размер ёршика всегда в миллиметрах прохода: «0,6 мм». */
export function formatMm(passageMm: string) {
  return `${passageMm.replace('.', ',')} мм`;
}

/** Порядок производителей в выборе ёршика: Curaprox, Curasept, TePe; остальные — после них. */
const BRAND_ORDER = ['curaprox', 'curasept', 'tepe'];

export function brandRank(brand: string) {
  const i = BRAND_ORDER.findIndex((b) => brand.toLowerCase().startsWith(b));
  return i < 0 ? BRAND_ORDER.length : i;
}

/** Каталог в порядке производителей; внутри производителя порядок каталога сохраняется. */
export function byBrandOrder<T extends { brand: string; line: string }>(items: T[]): T[] {
  return items
    .map((c, i) => ({ c, i }))
    .sort((a, b) => brandRank(brushBrand(a.c)) - brandRank(brushBrand(b.c)) || a.i - b.i)
    .map(({ c }) => c);
}

export interface BrandSummary {
  /** Производитель с линейкой: «Curaprox Prime». */
  name: string;
  count: number;
  /** Цвета размеров по порядку каталога. */
  colors: string[];
}

/** Марки каталога для главной: число размеров и их цвета, архивные позиции не учитываются. */
export function summarizeBrands(items: Array<{ brand: string; line: string; colorHex: string; archived?: boolean }>): BrandSummary[] {
  const map = new Map<string, BrandSummary>();
  for (const c of byBrandOrder(items.filter((i) => !i.archived))) {
    const name = brushBrand(c);
    const b = map.get(name) ?? { name, count: 0, colors: [] };
    b.count += 1;
    b.colors.push(c.colorHex);
    map.set(name, b);
  }
  return [...map.values()];
}
