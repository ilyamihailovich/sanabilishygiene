import { z } from 'zod';
import { ok, readJson, staff } from '@/server/http';
import { createDocument } from '@/server/services/documents';

const schema = z.object({
  type: z.enum(['BRUSH_MAP', 'PSR', 'HYGIENE_PLAN', 'AFTERCARE']),
  templateId: z.string().nullable().default(null),
});

export const POST = staff<{ id: string }>('document.write', async ({ req, params, session }) => {
  const { type, templateId } = await readJson(req, schema);
  return ok(await createDocument(params.id, type, templateId, session.user.id), { status: 201 });
});
