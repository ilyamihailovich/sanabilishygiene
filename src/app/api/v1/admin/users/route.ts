import { audit } from '@/server/audit';
import { hashPassword } from '@/server/auth/password';
import { tempPassword, userSchema, userSelect as select } from '@/server/services/users';
import { db } from '@/server/db';
import { conflict, ok, readJson, staff } from '@/server/http';


export const GET = staff('users.manage', async () => ok(await db().user.findMany({ select, orderBy: { displayName: 'asc' } })));

export const POST = staff('users.manage', async ({ req, session }) => {
  const input = await readJson(req, userSchema);
  if (await db().user.findUnique({ where: { email: input.email } })) throw conflict('Сотрудник с таким email уже есть');
  const password = tempPassword();
  const user = await db().user.create({
    data: { ...input, passwordHash: await hashPassword(password), mustChangePassword: true },
    select,
  });
  await audit({ userId: session.user.id, action: 'user.create', entityType: 'user', entityId: user.id, meta: { role: user.role } });
  return ok({ user, password }, { status: 201 });
});
