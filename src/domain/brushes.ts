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
