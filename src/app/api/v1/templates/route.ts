import { z } from 'zod';
import { ok, readJson, staff } from '@/server/http';
import { createTemplate, listTemplates } from '@/server/services/templates';

const kind = z.enum(['HYGIENE_PLAN', 'AFTERCARE']);

export const GET = staff(null, async ({ req, session }) => {
  const k = kind.safeParse(req.nextUrl.searchParams.get('kind'));
  return ok(await listTemplates(session, k.success ? k.data : undefined));
});

const createSchema = z.object({ kind, title: z.string().trim().min(1).max(200), library: z.boolean().default(false) });

export const POST = staff(null, async ({ req, session }) => {
  const input = await readJson(req, createSchema);
  return ok(await createTemplate(session, input), { status: 201 });
});
