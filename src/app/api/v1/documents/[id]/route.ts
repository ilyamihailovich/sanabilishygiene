import { z } from 'zod';
import { ok, readJson, staff } from '@/server/http';
import { deleteDocument, saveDocument } from '@/server/services/documents';

const schema = z.object({ content: z.unknown(), rev: z.number().int().min(1) });

export const PATCH = staff<{ id: string }>('document.write', async ({ req, params, session }) => {
  const { content, rev } = await readJson(req, schema);
  return ok(await saveDocument(params.id, content, rev, session.user.id));
});

export const DELETE = staff<{ id: string }>('document.write', async ({ params, session }) => {
  await deleteDocument(params.id, session.user.id);
  return ok();
});
