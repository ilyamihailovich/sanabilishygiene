import { audit } from '@/server/audit';
import { clearSessionCookie, destroySession } from '@/server/auth/session';
import { ok, staff } from '@/server/http';

export const POST = staff(null, async ({ session }) => {
  await destroySession(session.sessionId);
  await clearSessionCookie();
  await audit({ userId: session.user.id, action: 'auth.logout', entityType: 'user', entityId: session.user.id });
  return ok();
});
