import { ok, staff } from '@/server/http';
import { currentStructure, getEditableTemplate } from '@/server/services/templates';

export const GET = staff<{ id: string }>(null, async ({ params, session }) => {
  const t = await getEditableTemplate(session, params.id);
  return ok({ ...t, structure: currentStructure(t), hasDraft: t.draft !== null });
});
