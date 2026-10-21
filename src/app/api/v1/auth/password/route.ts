import { z } from 'zod';
import { ui } from '@/content/ui.ru';
import { audit } from '@/server/audit';
import { PASSWORD_MIN, hashPassword, verifyPassword } from '@/server/auth/password';
import { destroyUserSessions } from '@/server/auth/session';
import { db } from '@/server/db';
import { badRequest, ok, readJson, staff } from '@/server/http';

const schema = z.object({
  current: z.string().min(1).max(200),
  next: z.string().min(PASSWORD_MIN, ui.auth.passwordHint).max(200),
});

export const POST = staff(null, async ({ req, session }) => {
  const { current, next } = await readJson(req, schema);
  const user = await db().user.findUniqueOrThrow({ where: { id: session.user.id } });
  if (!(await verifyPassword(user.passwordHash, current))) throw badRequest(ui.auth.wrongCurrent, { current: ui.auth.wrongCurrent });
  await db().user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(next), mustChangePassword: false, passwordChangedAt: new Date() },
  });
  await destroyUserSessions(user.id, session.sessionId);
  await audit({ userId: user.id, action: 'auth.password', entityType: 'user', entityId: user.id });
  return ok();
});
