import { destroyUserSessions } from '@/server/auth/session';
import { ok, staff } from '@/server/http';

export const POST = staff<{ id: string }>('users.manage', async ({ params }) => {
  await destroyUserSessions(params.id);
  return ok();
});
