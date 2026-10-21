import { audit } from '@/server/audit';
import { hashPassword } from '@/server/auth/password';
import { destroyUserSessions } from '@/server/auth/session';
import { db } from '@/server/db';
import { ok, staff } from '@/server/http';
import { tempPassword } from '@/server/services/users';

export const POST = staff<{ id: string }>('users.manage', async ({ params, session }) => {
  const password = tempPassword();
  await db().user.update({ where: { id: params.id }, data: { passwordHash: await hashPassword(password), mustChangePassword: true } });
  await destroyUserSessions(params.id);
  await audit({ userId: session.user.id, action: 'user.reset_password', entityType: 'user', entityId: params.id });
  return ok({ password });
});
