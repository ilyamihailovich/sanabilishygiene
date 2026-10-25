import { brushBrand } from '@/domain/brushes';
import { visitMetrics, type DocType, type VisitMetrics } from '@/domain/history';
import { db } from '../db';

export interface PatientHistory {
  patient: { id: string; cardNumber: string; displayName: string | null; fullName: string | null };
  history: VisitMetrics[];
  clinicians: Record<string, string | null>;
  nextVisit: string | null;
}

/** Показатели всех визитов пациента — для карточки и для PDF-отчёта, одним расчётом. */
export async function loadPatientHistory(patientId: string): Promise<PatientHistory | null> {
  const patient = await db().patient.findUnique({
    where: { id: patientId },
    include: {
      visits: {
        orderBy: { date: 'desc' },
        include: {
          documents: { select: { type: true, content: true }, orderBy: { createdAt: 'asc' } },
          issues: { select: { id: true }, orderBy: { number: 'desc' }, take: 1 },
        },
      },
    },
  });
  if (!patient) return null;
  // каталог целиком, включая архивные позиции: в старых картах могут быть размеры, которых уже нет
  const sizes = await db().brushSize.findMany({ include: { brand: true } });
  const byId = new Map(sizes.map((s) => [s.id, { label: s.label, brand: brushBrand({ brand: s.brand.name, line: s.line }), color: s.colorHex }]));
  const doctorIds = [...new Set(patient.visits.map((v) => v.clinicianId).filter((x): x is string => Boolean(x)))];
  const doctors = new Map((await db().user.findMany({ where: { id: { in: doctorIds } }, select: { id: true, displayName: true } })).map((u) => [u.id, u.displayName]));
  const last = patient.visits[0];
  return {
    patient: { id: patient.id, cardNumber: patient.cardNumber, displayName: patient.displayName, fullName: patient.fullName },
    history: patient.visits.map((v) =>
      visitMetrics(
        { id: v.id, date: v.date.toISOString().slice(0, 10), status: v.status, lastIssueId: v.issues[0]?.id ?? null },
        v.documents.map((d) => ({ type: d.type as DocType, content: d.content })),
        (sid) => byId.get(sid) ?? null,
      ),
    ),
    clinicians: Object.fromEntries(patient.visits.map((v) => [v.id, v.clinicianId ? (doctors.get(v.clinicianId) ?? null) : null])),
    nextVisit: last?.nextVisitDate ? last.nextVisitDate.toISOString().slice(0, 10) : null,
  };
}
