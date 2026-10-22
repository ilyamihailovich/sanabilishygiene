import { notFound } from 'next/navigation';
import { VisitWorkspace } from '@/features/visit/VisitWorkspace';
import { requireStaff, staffInfo } from '@/server/auth/guard';
import { db } from '@/server/db';
import { listCatalog } from '@/server/services/catalog';
import { visitBlockers } from '@/server/services/readiness';
import { getVisit } from '@/server/services/visits';
import { listTemplates } from '@/server/services/templates';
import { activeLinkToken, patientUrl } from '@/server/services/issue';

export default async function VisitPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ step?: string }> }) {
  const session = await requireStaff();
  const { id } = await params;
  const { step } = await searchParams;
  const visit = await getVisit(id);
  if (!visit) notFound();

  const [catalog, doctors, templates, psrTexts, blockers, previous, token, lastIssue, previousMap] = await Promise.all([
    listCatalog(),
    db().user.findMany({ where: { role: 'DOCTOR', isActive: true }, select: { id: true, displayName: true, title: true }, orderBy: { displayName: 'asc' } }),
    listTemplates(session),
    db().psrText.findMany(),
    visitBlockers(id),
    db().document.findFirst({
      where: { type: 'BRUSH_MAP', boibPct: { not: null }, visit: { patientId: visit.patientId, date: { lt: visit.date } } },
      orderBy: { visit: { date: 'desc' } },
      include: { visit: { select: { date: true } } },
    }),
    activeLinkToken(id),
    db().visitIssue.findFirst({ where: { visitId: id }, orderBy: { number: 'desc' }, select: { id: true, number: true, issuedAt: true } }),
    db().document.findFirst({
      where: { type: 'BRUSH_MAP', visit: { patientId: visit.patientId, id: { not: id }, date: { lte: visit.date } } },
      orderBy: { visit: { date: 'desc' } },
      select: { visit: { select: { date: true } } },
    }),
  ]);

  const furcationTeeth = (() => {
    const map = visit.documents.find((d) => d.type === 'BRUSH_MAP')?.content as { teeth?: Record<string, { furcation?: boolean }> } | undefined;
    return Object.entries(map?.teeth ?? {})
      .filter(([, t]) => t.furcation)
      .map(([k]) => Number(k));
  })();

  return (
    <VisitWorkspace
      step={step ?? null}
      staff={staffInfo(session)}
      visit={{
        id: visit.id,
        date: visit.date.toISOString().slice(0, 10),
        clinicianId: visit.clinicianId,
        nextVisitDate: visit.nextVisitDate?.toISOString().slice(0, 10) ?? null,
        nextVisitTime: visit.nextVisitTime,
        nextVisitMonths: visit.nextVisitMonths,
        status: visit.status,
        patient: { id: visit.patient.id, cardNumber: visit.patient.cardNumber, displayName: visit.patient.displayName, fullName: visit.patient.fullName },
      }}
      documents={visit.documents.map((d) => ({ id: d.id, type: d.type, rev: d.rev, content: d.content, templateVersionId: d.templateVersionId }))}
      catalog={catalog}
      doctors={doctors}
      templates={templates
        .filter((t) => t.status === 'ACTIVE')
        .map((t) => ({ id: t.id, kind: t.kind, title: t.title, personal: t.ownerId !== null }))}
      psrTexts={psrTexts.map((t) => ({ code: t.code, staffText: t.staffText, approved: t.approved }))}
      blockers={blockers.map((b) => b.message)}
      previousBoib={
        previous && previous.boibPct !== null
          ? { pct: previous.boibPct, bleeding: previous.boibBleeding ?? 0, examined: previous.boibExamined ?? 0, date: previous.visit.date.toISOString() }
          : null
      }
      furcationTeeth={furcationTeeth}
      previousMapDate={previousMap?.visit.date.toISOString().slice(0, 10) ?? null}
      share={token ? patientUrl(token) : null}
      lastIssue={lastIssue ? { id: lastIssue.id, number: lastIssue.number, issuedAt: lastIssue.issuedAt.toISOString() } : null}
    />
  );
}
