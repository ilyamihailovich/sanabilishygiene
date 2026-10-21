import { ok, staff } from '@/server/http';
import { visitBlockers } from '@/server/services/readiness';

export const GET = staff<{ id: string }>(null, async ({ params }) => ok({ blockers: await visitBlockers(params.id) }));
