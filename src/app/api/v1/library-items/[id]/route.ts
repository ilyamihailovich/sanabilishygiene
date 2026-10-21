import { db } from '@/server/db';
import { forbidden, notFound, ok, staff } from '@/server/http';
import { can } from '@/server/rbac';

export const DELETE = staff<{ id: string }>(null, async ({ params, session }) => {
  const item = await db().libraryItem.findUnique({ where: { id: params.id } });
  if (!item) throw notFound();
  const allowed = item.ownerId === null ? can(session.user.role, 'template.library') : item.ownerId === session.user.id;
  if (!allowed) throw forbidden();
  await db().libraryItem.update({ where: { id: params.id }, data: { archived: true } });
  return ok();
});
