import { z } from 'zod';
import { templateStructureSchema } from '@/schemas/template';
import { ok, readJson, staff } from '@/server/http';
import { lintStructure, saveDraft } from '@/server/services/templates';

const schema = z.object({ structure: templateStructureSchema, title: z.string().trim().min(1).max(200).optional() });

export const PUT = staff<{ id: string }>(null, async ({ req, params, session }) => {
  const { structure, title } = await readJson(req, schema);
  await saveDraft(session, params.id, structure, title);
  return ok({ lint: lintStructure(structure) });
});
