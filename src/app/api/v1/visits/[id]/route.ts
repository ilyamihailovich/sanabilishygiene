import { notFound, ok, readJson, staff } from '@/server/http';
import { deleteVisit, getVisit, updateVisit, visitPatchSchema } from '@/server/services/visits';

export const GET = staff<{ id: string }>(null, async ({ params }) => {
  const visit = await getVisit(params.id);
  if (!visit) throw notFound('Визит не найден');
  return ok(visit);
});

export const PATCH = staff<{ id: string }>('visit.write', async ({ req, params, session }) => {
  const patch = await readJson(req, visitPatchSchema);
  return ok(await updateVisit(params.id, patch, session.user.id));
});

export const DELETE = staff<{ id: string }>('visit.delete', async ({ params, session }) => {
  await deleteVisit(params.id, session.user.id);
  return ok();
});
