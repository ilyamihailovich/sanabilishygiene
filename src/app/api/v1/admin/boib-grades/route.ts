import { z } from 'zod';
import { audit } from '@/server/audit';
import { db } from '@/server/db';
import { ok, readJson, staff } from '@/server/http';

export const GET = staff(null, async () => ok(await db().boibGrade.findMany({ orderBy: { minPct: 'asc' } })));

const gradeSchema = z
  .object({
    minPct: z.number().int().min(0).max(100),
    maxPct: z.number().int().min(0).max(100),
    staffLabel: z.string().trim().min(1).max(120),
    patientText: z.string().trim().max(2000),
  })
  .refine((g) => g.minPct <= g.maxPct, 'Нижняя граница больше верхней');

export const POST = staff('texts.edit', async ({ req, session }) => {
  const input = await readJson(req, gradeSchema);
  const row = await db().boibGrade.create({ data: input });
  await audit({ userId: session.user.id, action: 'texts.update', entityType: 'boib_grade', entityId: row.id });
  return ok(row, { status: 201 });
});
