import { PatientSearch } from '@/features/patients/PatientSearch';
import { requireStaff } from '@/server/auth/guard';
import { db } from '@/server/db';

export default async function PatientsPage() {
  await requireStaff();
  const patients = await db().patient.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 30,
    include: { visits: { orderBy: { date: 'desc' }, select: { date: true } } },
  });
  return (
    <PatientSearch
      initial={patients.map((p) => ({
        id: p.id,
        cardNumber: p.cardNumber,
        displayName: p.displayName,
        lastVisit: p.visits[0]?.date.toISOString() ?? null,
        visits: p.visits.length,
      }))}
    />
  );
}
