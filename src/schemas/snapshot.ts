import type { BoibResult } from '@/domain/brushMap';
import type { PsrSummary } from '@/domain/psr';
import type { Settings } from '@/server/settings';
import type { BrushMapContent } from './brushMap';
import type { PsrContent } from './psr';
import type { FilledDocument } from './template';

/** Позиция каталога, зафиксированная в выдаче. */
export interface SnapshotSize {
  id: string;
  label: string;
  brand: string;
  line: string;
  isoSize: string | null;
  passageMm: string;
  colorHex: string;
}

/** Неизменяемый снимок выдачи: из него строятся онлайн-карта и PDF. Номера медкарты здесь нет. */
export interface IssueSnapshot {
  schema: 1;
  issueNumber: number;
  issuedAt: string;
  visitDate: string;
  /** time — «ЧЧ:ММ», только при точной дате; в выдачах до появления поля отсутствует. */
  nextVisit: { date: string | null; months: number | null; time?: string | null };
  patientName: string | null;
  /** ФИО для PDF; в выдачах до появления поля отсутствует. */
  patientFullName?: string | null;
  clinician: { name: string; title: string | null } | null;
  clinic: Settings['clinic'];
  brushSteps: string[] | null;
  brushMap: {
    content: BrushMapContent;
    sizes: Record<string, SnapshotSize>;
    boib: BoibResult;
    previousBoib: (BoibResult & { date: string }) | null;
    boibText: string | null;
  } | null;
  psr: {
    content: PsrContent;
    summary: PsrSummary;
    patientText: string | null;
    asteriskText: string | null;
  } | null;
  hygienePlan: FilledDocument | null;
  aftercare: FilledDocument[];
}
