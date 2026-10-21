import { z } from 'zod';
import { hasTodo } from '@/content/styleRules';
import { audit } from '@/server/audit';
import { db } from '@/server/db';
import { badRequest, notFound, ok, readJson, staff } from '@/server/http';

export const POST = staff<{ code: string }>('texts.approve', async ({ req, params, session }) => {
  const { approved } = await readJson(req, z.object({ approved: z.boolean() }));
  const row = await db().psrText.findUnique({ where: { code: params.code } });
  if (!row) throw notFound();
  if (approved && hasTodo(row.patientText)) throw badRequest('В тексте для пациента есть TODO');
  await db().psrText.update({ where: { code: params.code }, data: { approved, approvedById: approved ? session.user.id : null } });
  await audit({ userId: session.user.id, action: 'texts.approve', entityType: 'psr_text', entityId: params.code, meta: { approved } });
  return ok();
});
