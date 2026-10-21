import { notFound } from 'next/navigation';
import { PatientCard } from '@/features/patients/PatientCard';
import { requireStaff } from '@/server/auth/guard';
import { db } from '@/server/db';

export default async function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const patient = await db().patient.findUnique({
    where: { id },
    include: {
      visits: {
        orderBy: { date: 'desc' },
        include: {
          documents: { select: { type: true, boibPct: true, psrMaxCode: true, psrAsterisk: true } },
          issues: { select: { id: true }, orderBy: { number: 'desc' }, take: 1 },
        },
      },
    },
  });
  if (!patient) notFound();
  return (
    <PatientCard
      patient={{ id: patient.id, cardNumber: patient.cardNumber, displayName: patient.displayName }}
      visits={patient.visits.map((v) => ({
        id: v.id,
        date: v.date.toISOString(),
        status: v.status,
        documents: v.documents.map((d) => d.type),
        boib: v.documents.find((d) => d.type === 'BRUSH_MAP')?.boibPct ?? null,
        psr: v.documents.find((d) => d.type === 'PSR')?.psrMaxCode ?? null,
        psrStar: v.documents.find((d) => d.type === 'PSR')?.psrAsterisk ?? false,
        lastIssueId: v.issues[0]?.id ?? null,
      }))}
    />
  );
}
