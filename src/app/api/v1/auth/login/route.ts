import { z } from 'zod';
import { ui } from '@/content/ui.ru';
import { audit } from '@/server/audit';
import { hashPassword, verifyPassword } from '@/server/auth/password';
import { isLoginBlocked, recordLoginAttempt } from '@/server/auth/rateLimit';
import { createSession, setSessionCookie } from '@/server/auth/session';
import { db } from '@/server/db';
import { HttpError, clientIp, ok, publicRoute, readJson } from '@/server/http';

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(1).max(200),
});

// Хеш для выравнивания времени ответа, когда сотрудника нет
let dummyHash: Promise<string> | null = null;
const getDummyHash = () => (dummyHash ??= hashPassword('timing-equalizer'));

export const POST = publicRoute(async ({ req }) => {
  const { email, password } = await readJson(req, schema);
  const ip = clientIp(req);
  if (await isLoginBlocked(email, ip)) throw new HttpError(429, 'blocked', ui.auth.blocked);

  const user = await db().user.findUnique({ where: { email } });
  const valid = await verifyPassword(user?.passwordHash ?? (await getDummyHash()), password);
  if (!user || !valid || !user.isActive) {
    await recordLoginAttempt(email, ip, false);
    throw new HttpError(401, 'invalid', ui.auth.invalid);
  }
  await recordLoginAttempt(email, ip, true);
  const token = await createSession(user.id, req.headers.get('user-agent'));
  await setSessionCookie(token);
  await audit({ userId: user.id, action: 'auth.login', entityType: 'user', entityId: user.id });
  return ok({ mustChangePassword: user.mustChangePassword });
});
