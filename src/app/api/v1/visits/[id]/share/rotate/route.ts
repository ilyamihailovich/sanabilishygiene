import { ok, staff } from '@/server/http';
import { rotateLink } from '@/server/services/issue';

export const POST = staff<{ id: string }>('link.manage', async ({ params, session }) => ok({ url: await rotateLink(params.id, session.user.id) }));
