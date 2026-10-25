import { audit } from '@/server/audit';
import { db } from '@/server/db';
import { notFound, staff } from '@/server/http';
import { patientReportPdf } from '@/server/services/renderer';

/** PDF-отчёт по пациенту: показатели и графики по всем визитам. Только для сотрудников. */
export const GET = staff<{ id: string }>(null, async ({ params, session }) => {
  const patient = await db().patient.findUnique({ where: { id: params.id }, select: { id: true, cardNumber: true } });
  if (!patient) throw notFound('Пациент не найден');
  const pdf = await patientReportPdf(patient.id);
  await audit({ userId: session.user.id, action: 'patient.report', entityType: 'patient', entityId: patient.id });
  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(`SANABILIS_Отчёт_${patient.cardNumber}.pdf`)}`,
      'Cache-Control': 'no-store',
    },
  });
});

export const dynamic = 'force-dynamic';
