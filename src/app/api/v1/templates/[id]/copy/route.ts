import { z } from 'zod';
import { ok, readJson, staff } from '@/server/http';
import { copyTemplate } from '@/server/services/templates';

export const POST = staff<{ id: string }>(null, async ({ req, params, session }) => {
  const { library } = await readJson(req, z.object({ library: z.boolean().default(false) }));
  return ok(await copyTemplate(session, params.id, library), { status: 201 });
});
