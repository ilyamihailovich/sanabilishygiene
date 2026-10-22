/**
 * Подпись пациента в рабочем интерфейсе: «Имя Фамилия».
 * ФИО вводится как «Фамилия Имя Отчество»; без ФИО — имя для обращения.
 */
export function patientTitle(p: { displayName: string | null; fullName?: string | null }): string | null {
  const parts = p.fullName?.trim().split(/\s+/) ?? [];
  if (parts.length >= 2) return `${parts[1]} ${parts[0]}`;
  return p.fullName?.trim() || p.displayName;
}
