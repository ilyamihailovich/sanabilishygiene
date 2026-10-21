import { ok, staff } from '@/server/http';
import { publish } from '@/server/services/templates';

export const POST = staff<{ id: string }>(null, async ({ params, session }) => ok(await publish(session, params.id)));
