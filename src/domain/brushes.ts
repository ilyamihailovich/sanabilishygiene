/** Название ёршика для врача и пациента: производитель и линейка, например «TePe Original». */
export function brushBrand(c: { brand: string; line: string }) {
  return [c.brand, c.line].filter(Boolean).join(' ');
}

/** Размер ёршика всегда в миллиметрах прохода: «0,6 мм». */
export function formatMm(passageMm: string) {
  return `${passageMm.replace('.', ',')} мм`;
}
