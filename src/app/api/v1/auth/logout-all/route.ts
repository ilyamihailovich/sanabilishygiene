import { audit } from '@/server/audit';
import { clearSessionCookie, destroyUserSessions } from '@/server/auth/session';
import { ok, staff } from '@/server/http';

export const POST = staff(null, async ({ session }) => {
  await destroyUserSessions(session.user.id);
  await clearSessionCookie();
  await audit({ userId: session.user.id, action: 'auth.logout_all', entityType: 'user', entityId: session.user.id });
  return ok();
});
