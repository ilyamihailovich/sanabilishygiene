import { ui } from '@/content/ui.ru';
import { plural } from '@/content/plural';
import { timeOfDayLabels, type FilledItem } from '@/schemas/template';
import type { IssueSnapshot } from '@/schemas/snapshot';

const monthsNominative = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

/** «21 октября 2026» из ISO-даты без часового пояса. */
export function dateLong(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d} ${months[(m ?? 1) - 1]} ${y}`;
}

export function nextVisitText(snapshot: IssueSnapshot): string | null {
  const { date, months: m } = snapshot.nextVisit;
  if (date) return dateLong(date);
  if (m) {
    const [y, mo, d] = snapshot.visitDate.split('-').map(Number);
    const target = new Date(Date.UTC(y!, mo! - 1 + m, d!));
    return `через ${m} ${plural(m, ['месяц', 'месяца', 'месяцев'])}: ${monthsNominative[target.getUTCMonth()]} ${target.getUTCFullYear()}`;
  }
  return null;
}

/** Строка средства гигиены для пациента. Для препаратов — только «по назначению врача». */
export function productLine(item: Extract<FilledItem, { type: 'product' }>): string {
  const parts = item.prescription ? ['по назначению врача'] : [item.usage, item.frequency, item.duration].filter((x) => x.trim());
  if (item.timeOfDay.length) parts.push(item.timeOfDay.map((t) => timeOfDayLabels[t]).join(' и '));
  return parts.join(', ');
}

export const greeting = (name: string | null) => (name ? `${ui.patient.greeting}, ${name}` : ui.patient.greeting);
