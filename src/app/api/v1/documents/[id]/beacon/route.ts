import { z } from 'zod';
import { ok, readJson, staff } from '@/server/http';
import { saveDocument } from '@/server/services/documents';

const schema = z.object({ content: z.unknown(), rev: z.number().int().min(1) });

/** Сохранение при закрытии вкладки (navigator.sendBeacon отправляет только POST). */
export const POST = staff<{ id: string }>('document.write', async ({ req, params, session }) => {
  const { content, rev } = await readJson(req, schema);
  return ok(await saveDocument(params.id, content, rev, session.user.id));
});
