import { z } from 'zod';
import type { Prisma } from '@/generated/prisma/client';
import { brushMapSchema } from '@/schemas/brushMap';
import { audit } from '../audit';
import { db } from '../db';
import { badRequest, conflict, notFound } from '../http';
import { carryOverBrushMap } from './documents';
import { computeBoib } from '@/domain/brushMap';

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата в формате ГГГГ-ММ-ДД');

export const visitPatchSchema = z
  .object({
    date: dateString.optional(),
    clinicianId: z.string().nullable().optional(),
    nextVisitDate: dateString.nullable().optional(),
    nextVisitMonths: z.number().int().min(1).max(24).nullable().optional(),
    nextVisitTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Время в формате ЧЧ:ММ').nullable().optional(),
  })
  .refine((v) => !(v.nextVisitDate && v.nextVisitMonths), 'Укажите дату или число месяцев, не оба значения');

const toDate = (s: string) => new Date(`${s}T00:00:00.000Z`);

export function todayIso(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow' }).format(new Date());
}

export async function createVisit(patientId: string, userId: string, copyBrushMap: boolean) {
  const patient = await db().patient.findUnique({ where: { id: patientId } });
  if (!patient) throw notFound('Пациент не найден');
  const creator = await db().user.findUniqueOrThrow({ where: { id: userId } });

  const visit = await db().visit.create({
    data: {
      patientId,
      date: toDate(todayIso()),
      createdById: userId,
      clinicianId: creator.role === 'DOCTOR' ? creator.id : null,
    },
  });

  if (copyBrushMap) {
    const previous = await db().document.findFirst({
      where: { type: 'BRUSH_MAP', visit: { patientId, id: { not: visit.id } } },
      orderBy: { visit: { date: 'desc' } },
    });
    if (previous) {
      const content = carryOverBrushMap(brushMapSchema.parse(previous.content));
      const b = computeBoib(content);
      await db().document.create({
        data: {
          visitId: visit.id,
          type: 'BRUSH_MAP',
          content: content as Prisma.InputJsonValue,
          authorId: userId,
          boibPct: b.pct,
          boibBleeding: b.bleeding,
          boibExamined: b.examined,
        },
      });
    }
  }
  await db().patient.update({ where: { id: patientId }, data: { updatedAt: new Date() } });
  await audit({ userId, action: 'visit.create', entityType: 'visit', entityId: visit.id, meta: { copyBrushMap } });
  return visit;
}

export async function updateVisit(id: string, patch: z.infer<typeof visitPatchSchema>, userId: string) {
  if (patch.clinicianId) {
    const clinician = await db().user.findUnique({ where: { id: patch.clinicianId } });
    if (!clinician || clinician.role !== 'DOCTOR' || !clinician.isActive) throw badRequest('В документе указывается врач');
  }
  const data: Prisma.VisitUpdateInput = {};
  if (patch.date) data.date = toDate(patch.date);
  if (patch.clinicianId !== undefined) data.clinicianId = patch.clinicianId;
  if (patch.nextVisitDate !== undefined) {
    data.nextVisitDate = patch.nextVisitDate ? toDate(patch.nextVisitDate) : null;
    if (patch.nextVisitDate) data.nextVisitMonths = null;
    else data.nextVisitTime = null;
  }
  if (patch.nextVisitMonths !== undefined) {
    data.nextVisitMonths = patch.nextVisitMonths;
    if (patch.nextVisitMonths) {
      data.nextVisitDate = null;
      data.nextVisitTime = null;
    }
  }
  if (patch.nextVisitTime !== undefined) data.nextVisitTime = patch.nextVisitTime;
  const visit = await db().visit.update({ where: { id }, data });
  await audit({ userId, action: 'visit.update', entityType: 'visit', entityId: id });
  return visit;
}

export async function deleteVisit(id: string, userId: string) {
  const visit = await db().visit.findUnique({ where: { id }, include: { issues: { select: { id: true } } } });
  if (!visit) throw notFound('Визит не найден');
  if (visit.issues.length) throw conflict('Визит уже выдан пациенту, удалить нельзя');
  await db().visit.delete({ where: { id } });
  await audit({ userId, action: 'visit.delete', entityType: 'visit', entityId: id });
}

export async function getVisit(id: string) {
  return db().visit.findUnique({
    where: { id },
    include: {
      patient: true,
      documents: { orderBy: { createdAt: 'asc' } },
      issues: { orderBy: { number: 'desc' }, take: 1 },
      shareLinks: { where: { revokedAt: null }, orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });
}
