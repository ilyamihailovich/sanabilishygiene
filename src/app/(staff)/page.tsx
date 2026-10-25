import { patientTitle } from '@/domain/patient';
import { HomeBento } from '@/features/home/HomeBento';
import { requireStaff } from '@/server/auth/guard';
import { db } from '@/server/db';
import { summarizeBrands } from '@/domain/brushes';
import { listCatalog } from '@/server/services/catalog';
import { recentPatients } from '@/server/services/patients';

export default async function HomePage() {
  const session = await requireStaff();
  const [recent, drafts, templates, personal, unverified, catalog] = await Promise.all([
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
  ]);
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
    />
  );
}
