import { patientTitle } from '@/domain/patient';
import { HomeBento } from '@/features/home/HomeBento';
import { requireStaff } from '@/server/auth/guard';
import { db } from '@/server/db';
import { summarizeBrands } from '@/domain/brushes';
import { listCatalog } from '@/server/services/catalog';
import { recentPatients } from '@/server/services/patients';

export default async function HomePage() {
  const session = await requireStaff();
  const now = Date.now();
  const weekAgo = new Date(now - 7 * 86_400_000);
  const [recent, drafts, templates, personal, unverified, catalog, weekVisits, weekIssued, dueVisits] = await Promise.all([
    recentPatients(session.user.id),
    db().visit.findMany({
      where: { status: 'DRAFT', OR: [{ createdById: session.user.id }, { documents: { some: { authorId: session.user.id } } }] },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      include: { patient: true, documents: { select: { type: true } } },
    }),
    db().template.count({ where: { status: 'ACTIVE', OR: [{ ownerId: null }, { ownerId: session.user.id }] } }),
    db().template.count({ where: { status: 'ACTIVE', ownerId: session.user.id } }),
    db().brushSize.count({ where: { archived: false, verified: false } }),
    listCatalog(),
    db().visit.findMany({ where: { createdById: session.user.id, createdAt: { gte: weekAgo } }, select: { patientId: true } }),
    db().visitIssue.count({ where: { issuedById: session.user.id, issuedAt: { gte: weekAgo } } }),
    // повторные визиты пациентов врача: от просроченных на два месяца до назначенных на ближайший месяц
    db().visit.findMany({
      where: {
        createdById: session.user.id,
        status: 'ISSUED',
        nextVisitDate: { gte: new Date(now - 60 * 86_400_000), lte: new Date(now + 30 * 86_400_000) },
      },
      orderBy: { nextVisitDate: 'asc' },
      take: 20,
      include: { patient: true },
    }),
  ]);
  const due = new Map<string, { patientId: string; card: string; name: string | null; date: string }>();
  for (const v of dueVisits) {
    if (!v.nextVisitDate || due.has(v.patientId)) continue;
    due.set(v.patientId, { patientId: v.patientId, card: v.patient.cardNumber, name: patientTitle(v.patient), date: v.nextVisitDate.toISOString() });
  }
  return (
    <HomeBento
      today={new Date().toISOString()}
      recent={recent.map((r) => ({
        patientId: r.patient.id,
        card: r.patient.cardNumber,
        name: patientTitle(r.patient),
        date: r.visitDate.toISOString(),
        boib: r.boib,
      }))}
      drafts={drafts.map((d) => ({
        id: d.id,
        card: d.patient.cardNumber,
        name: patientTitle(d.patient),
        updatedAt: d.updatedAt.toISOString(),
        docs: d.documents.length,
      }))}
      templates={templates}
      personalTemplates={personal}
      catalogUnverified={unverified}
      catalogBrands={summarizeBrands(catalog)}
      week={{ visits: weekVisits.length, issued: weekIssued, patients: new Set(weekVisits.map((v) => v.patientId)).size }}
      due={[...due.values()].slice(0, 6)}
    />
  );
}
