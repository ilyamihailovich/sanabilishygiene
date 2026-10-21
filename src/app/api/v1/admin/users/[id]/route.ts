import { z } from 'zod';
import { audit } from '@/server/audit';
import { destroyUserSessions } from '@/server/auth/session';
import { db } from '@/server/db';
import { badRequest, ok, readJson, staff } from '@/server/http';

const schema = z.object({
  displayName: z.string().trim().min(1).max(120).optional(),
  title: z.string().trim().max(120).nullable().optional(),
  role: z.enum(['ADMIN', 'DOCTOR', 'HYGIENIST', 'ASSISTANT']).optional(),
  isActive: z.boolean().optional(),
});

export const PATCH = staff<{ id: string }>('users.manage', async ({ req, params, session }) => {
  const patch = await readJson(req, schema);
  if (params.id === session.user.id && (patch.isActive === false || (patch.role && patch.role !== 'ADMIN'))) {
    throw badRequest('Нельзя заблокировать себя или снять с себя роль администратора');
  }
  const user = await db().user.update({ where: { id: params.id }, data: patch, select: { id: true, role: true, isActive: true } });
  if (patch.isActive === false) await destroyUserSessions(params.id);
  await audit({ userId: session.user.id, action: 'user.update', entityType: 'user', entityId: params.id, meta: patch });
  return ok(user);
});
