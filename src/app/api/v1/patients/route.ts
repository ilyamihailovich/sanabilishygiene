import { ok, readJson, staff } from '@/server/http';
import { createPatient, patientInputSchema, searchPatients } from '@/server/services/patients';

export const GET = staff(null, async ({ req }) => {
  const q = req.nextUrl.searchParams.get('card') ?? '';
  return ok(await searchPatients(q));
});

export const POST = staff('patient.write', async ({ req, session }) => {
  const input = await readJson(req, patientInputSchema);
  return ok(await createPatient(input, session.user.id), { status: 201 });
});
