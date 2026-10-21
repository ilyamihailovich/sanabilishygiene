import { db } from '@/server/db';
import { notFound, ok, readJson, staff } from '@/server/http';
import { patientInputSchema, updatePatient } from '@/server/services/patients';

export const GET = staff<{ id: string }>(null, async ({ params }) => {
  const patient = await db().patient.findUnique({
    where: { id: params.id },
    include: { visits: { orderBy: { date: 'desc' }, include: { documents: { select: { id: true, type: true, boibPct: true, psrMaxCode: true } } } } },
  });
  if (!patient) throw notFound('Пациент не найден');
  return ok(patient);
});

export const PATCH = staff<{ id: string }>('patient.write', async ({ req, params, session }) => {
  const input = await readJson(req, patientInputSchema);
  return ok(await updatePatient(params.id, input, session.user.id));
});
