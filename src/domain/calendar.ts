import type { IssueSnapshot } from '@/schemas/snapshot';

/*
  Напоминание о повторном визите в формате iCalendar (RFC 5545).
  Точная дата и время — событие на 1 час с напоминаниями за сутки и за 2 часа.
  Только дата — событие на весь день. Только срок в месяцах — напоминание записаться, 1-го числа нужного месяца.
  Время «плавающее» (без часового пояса): календарь пациента покажет его как указано в клинике.
*/

const pad = (n: number) => String(n).padStart(2, '0');
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
const ymd = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;

/** Длинные строки iCalendar переносятся по 75 октетов; здесь по 60 символов с запасом для кириллицы. */
const fold = (line: string) => line.match(/.{1,60}/gu)?.join('\r\n ') ?? line;

export function visitCalendar(snapshot: IssueSnapshot, uid: string, now = new Date()): string | null {
  const { date, months, time } = snapshot.nextVisit;
  const c = snapshot.clinic;
  const lines: string[] = [];
  let summary: string;
  let description: string;

  if (date) {
    const [y, m, d] = date.split('-').map(Number) as [number, number, number];
    summary = `Визит в ${c.name}: гигиена`;
    description = `Повторный визит. Телефон клиники: ${c.phone}`;
    if (time) {
      const [hh, mm] = time.split(':').map(Number) as [number, number];
      const start = new Date(Date.UTC(y, m - 1, d, hh, mm));
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      const t = (x: Date) => `${ymd(x)}T${pad(x.getUTCHours())}${pad(x.getUTCMinutes())}00`;
      lines.push(`DTSTART:${t(start)}`, `DTEND:${t(end)}`);
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(summary)}`, 'TRIGGER:-P1D', 'END:VALARM');
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(summary)}`, 'TRIGGER:-PT2H', 'END:VALARM');
    } else {
      const start = new Date(Date.UTC(y, m - 1, d));
      lines.push(`DTSTART;VALUE=DATE:${ymd(start)}`, `DTEND;VALUE=DATE:${ymd(new Date(start.getTime() + 864e5))}`);
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(summary)}`, 'TRIGGER:-PT15H', 'END:VALARM');
    }
  } else if (months) {
    const [y, m] = snapshot.visitDate.split('-').map(Number) as [number, number];
    const start = new Date(Date.UTC(y, m - 1 + months, 1));
    summary = `Записаться на визит в ${c.name}`;
    description = `Рекомендованный срок повторного визита. Телефон клиники: ${c.phone}`;
    lines.push(`DTSTART;VALUE=DATE:${ymd(start)}`, `DTEND;VALUE=DATE:${ymd(new Date(start.getTime() + 864e5))}`);
    lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(summary)}`, 'TRIGGER:PT10H', 'END:VALARM');
  } else return null;

  const stamp = `${ymd(now)}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
  const event = [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `SUMMARY:${esc(summary)}`,
    `LOCATION:${esc(`${c.name}, ${c.address}`)}`,
    `DESCRIPTION:${esc(description)}`,
    `URL:https://${c.site}`,
  ];
  // VALARM вкладывается в VEVENT после основных свойств
  const alarmsStart = lines.findIndex((l) => l === 'BEGIN:VALARM');
  const props = alarmsStart < 0 ? lines : lines.slice(0, alarmsStart);
  const alarms = alarmsStart < 0 ? [] : lines.slice(alarmsStart);
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SANABILIS//Hygiene//RU', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', ...event, ...props, ...alarms, 'END:VEVENT', 'END:VCALENDAR']
    .map(fold)
    .join('\r\n')
    .concat('\r\n');
}
