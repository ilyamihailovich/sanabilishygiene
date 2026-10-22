import { z } from 'zod';
import { ok, readJson, staff } from '@/server/http';
import { toothSchema } from '@/schemas/brushMap';
import { createDocument } from '@/server/services/documents';

const schema = z.object({
  type: z.enum(['BRUSH_MAP', 'PSR', 'HYGIENE_PLAN', 'AFTERCARE']),
  templateId: z.string().nullable().default(null),
  /** Только для карты ёршиков: начать с формулы, отмеченной до осмотра, или перенести прошлую карту. */
  start: z
    .object({
      from: z.enum(['empty', 'previous']),
      teeth: z.record(z.string().max(2), toothSchema).optional(),
    })
    .optional(),
});

export const POST = staff<{ id: string }>('document.write', async ({ req, params, session }) => {
  const { type, templateId, start } = await readJson(req, schema);
  return ok(await createDocument(params.id, type, templateId, session.user.id, type === 'BRUSH_MAP' ? start : undefined), { status: 201 });
});
