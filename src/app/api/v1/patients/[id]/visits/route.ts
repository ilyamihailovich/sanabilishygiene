import { z } from 'zod';
import { ok, readJson, staff } from '@/server/http';
import { createVisit } from '@/server/services/visits';

const schema = z.object({ copyBrushMap: z.boolean().default(false) });

export const POST = staff<{ id: string }>('visit.write', async ({ req, params, session }) => {
  const { copyBrushMap } = await readJson(req, schema);
  return ok(await createVisit(params.id, session.user.id, copyBrushMap), { status: 201 });
});
