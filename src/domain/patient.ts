/**
 * Подпись пациента в рабочем интерфейсе и документах: полное ФИО, как его ввели.
 * Без ФИО — имя для обращения.
 */
export function patientTitle(p: { displayName: string | null; fullName?: string | null }): string | null {
  return p.fullName?.trim().replace(/\s+/g, ' ') || p.displayName;
}

/**
 * Имя для обращения на онлайн-карте («Здравствуйте, Анна»): второе слово ФИО «Фамилия Имя Отчество»,
 * из одного слова — оно само.
 */
export function firstNameOf(fullName: string | null | undefined): string | null {
  const parts = fullName?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (!parts.length) return null;
  const name = parts.length >= 2 ? parts[1]! : parts[0]!;
  return name.charAt(0).toUpperCase() + name.slice(1);
}
