import { z } from 'zod';
import { ok, readJson, staff } from '@/server/http';
import { templateFromDocument } from '@/server/services/templates';

export const POST = staff<{ id: string }>('template.personal', async ({ req, params, session }) => {
  const { title } = await readJson(req, z.object({ title: z.string().trim().min(1).max(200) }));
  return ok(await templateFromDocument(session, params.id, title), { status: 201 });
});
