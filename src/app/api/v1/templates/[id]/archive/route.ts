import { z } from 'zod';
import { ok, readJson, staff } from '@/server/http';
import { setArchived } from '@/server/services/templates';

export const POST = staff<{ id: string }>(null, async ({ req, params, session }) => {
  const { archived } = await readJson(req, z.object({ archived: z.boolean() }));
  await setArchived(session, params.id, archived);
  return ok();
});
