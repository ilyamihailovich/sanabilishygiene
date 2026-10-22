import { z } from 'zod';
import { audit } from '../audit';
import { db } from '../db';
import { conflict } from '../http';
import { ui } from '@/content/ui.ru';

export const cardNumberSchema = z
  .string()
  .transform((s) => s.trim().replace(/\s+/g, ' ').toUpperCase())
  .pipe(z.string().min(1, 'Укажите номер медицинской карты').max(40));

export const patientInputSchema = z.object({
  cardNumber: cardNumberSchema,
  displayName: z
    .string()
    .trim()
    .max(60)
    .transform((s) => (s === '' ? null : s))
    .nullable()
    .default(null),
  fullName: z
    .string()
    .trim()
    .max(120)
    .transform((s) => (s === '' ? null : s))
    .nullable()
    .default(null),
});

export async function searchPatients(query: string, take = 20) {
  const q = cardNumberSchema.safeParse(query);
  if (!q.success) return [];
  return db().patient.findMany({
    where: { cardNumber: { startsWith: q.data } },
    orderBy: { updatedAt: 'desc' },
    take,
  });
}

export async function createPatient(input: z.infer<typeof patientInputSchema>, userId: string) {
  const exists = await db().patient.findUnique({ where: { cardNumber: input.cardNumber } });
  if (exists) throw conflict(ui.patients.duplicate);
  const patient = await db().patient.create({ data: { ...input, createdById: userId } });
  await audit({ userId, action: 'patient.create', entityType: 'patient', entityId: patient.id });
  return patient;
}

export async function updatePatient(id: string, input: z.infer<typeof patientInputSchema>, userId: string) {
  const dup = await db().patient.findFirst({ where: { cardNumber: input.cardNumber, id: { not: id } } });
  if (dup) throw conflict(ui.patients.duplicate);
  const patient = await db().patient.update({ where: { id }, data: input });
  await audit({ userId, action: 'patient.update', entityType: 'patient', entityId: id });
  return patient;
}

/** Последние пациенты, с визитами которых работал сотрудник. */
export async function recentPatients(userId: string, take = 6) {
  const visits = await db().visit.findMany({
    where: { OR: [{ createdById: userId }, { documents: { some: { authorId: userId } } }] },
    orderBy: { updatedAt: 'desc' },
    take: 40,
    include: { patient: true, documents: { where: { type: 'BRUSH_MAP' }, select: { boibPct: true } } },
  });
  const seen = new Set<string>();
  return visits
    .filter((v) => (seen.has(v.patientId) ? false : (seen.add(v.patientId), true)))
    .slice(0, take)
    .map((v) => ({ patient: v.patient, visitDate: v.date, visitId: v.id, boib: v.documents[0]?.boibPct ?? null }));
}
