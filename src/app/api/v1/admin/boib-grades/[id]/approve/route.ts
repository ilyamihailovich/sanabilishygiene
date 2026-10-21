import { z } from 'zod';
import { hasTodo } from '@/content/styleRules';
import { audit } from '@/server/audit';
import { db } from '@/server/db';
import { badRequest, notFound, ok, readJson, staff } from '@/server/http';

export const POST = staff<{ id: string }>('texts.approve', async ({ req, params, session }) => {
  const { approved } = await readJson(req, z.object({ approved: z.boolean() }));
  const row = await db().boibGrade.findUnique({ where: { id: params.id } });
  if (!row) throw notFound();
  if (approved && hasTodo(row.patientText)) throw badRequest('В тексте для пациента есть TODO');
  await db().boibGrade.update({ where: { id: params.id }, data: { approved, approvedById: approved ? session.user.id : null } });
  await audit({ userId: session.user.id, action: 'texts.approve', entityType: 'boib_grade', entityId: params.id, meta: { approved } });
  return ok();
});
