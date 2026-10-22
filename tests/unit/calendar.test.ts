import { describe, expect, it } from 'vitest';
import { visitCalendar } from '@/domain/calendar';
import type { IssueSnapshot } from '@/schemas/snapshot';

const base = {
  visitDate: '2026-10-22',
  clinic: { name: 'SANABILIS', address: 'Москва, ул. Маршала Тимошенко, д. 17, корп. 2', phone: '+7 (495) 417-00-00', site: 'sanabilis.ru' },
} as unknown as IssueSnapshot;
const make = (nextVisit: IssueSnapshot['nextVisit']) => visitCalendar({ ...base, nextVisit }, 'u1', new Date(Date.UTC(2026, 9, 22, 9, 0, 0)));

describe('напоминание о визите (iCalendar)', () => {
  it('дата и время: событие на 1 час и два напоминания', () => {
    const ics = make({ date: '2027-04-14', months: null, time: '10:30' })!;
    expect(ics).toContain('DTSTART:20270414T103000');
    expect(ics).toContain('DTEND:20270414T113000');
    expect(ics.match(/BEGIN:VALARM/g)).toHaveLength(2);
    expect(ics.split('\r\n').every((l) => [...l].length <= 61)).toBe(true);
  });
  it('только дата: событие на весь день', () => {
    const ics = make({ date: '2027-04-14', months: null })!;
    expect(ics).toContain('DTSTART;VALUE=DATE:20270414');
    expect(ics).toContain('DTEND;VALUE=DATE:20270415');
  });
  it('срок в месяцах: напоминание записаться 1-го числа месяца', () => {
    const ics = make({ date: null, months: 6 })!;
    expect(ics).toContain('DTSTART;VALUE=DATE:20270401');
    expect(ics).toContain('Записаться на визит');
  });
  it('без срока визита файла нет', () => {
    expect(make({ date: null, months: null })).toBeNull();
  });
});
