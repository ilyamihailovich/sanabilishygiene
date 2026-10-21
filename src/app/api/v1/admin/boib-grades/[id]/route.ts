import { z } from 'zod';
import { audit } from '@/server/audit';
import { db } from '@/server/db';
import { ok, readJson, staff } from '@/server/http';

const schema = z.object({
  minPct: z.number().int().min(0).max(100),
  maxPct: z.number().int().min(0).max(100),
  staffLabel: z.string().trim().min(1).max(120),
  patientText: z.string().trim().max(2000),
});

export const PUT = staff<{ id: string }>('texts.edit', async ({ req, params, session }) => {
  const input = await readJson(req, schema);
  const row = await db().boibGrade.update({ where: { id: params.id }, data: { ...input, approved: false, approvedById: null } });
  await audit({ userId: session.user.id, action: 'texts.update', entityType: 'boib_grade', entityId: params.id });
  return ok(row);
});

export const DELETE = staff<{ id: string }>('texts.edit', async ({ params, session }) => {
  await db().boibGrade.delete({ where: { id: params.id } });
  await audit({ userId: session.user.id, action: 'texts.update', entityType: 'boib_grade', entityId: params.id, meta: { deleted: true } });
  return ok();
});
