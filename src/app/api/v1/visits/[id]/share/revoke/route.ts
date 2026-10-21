import { ok, staff } from '@/server/http';
import { revokeLinks } from '@/server/services/issue';

export const POST = staff<{ id: string }>('link.manage', async ({ params, session }) => {
  await revokeLinks(params.id, session.user.id);
  return ok();
});
