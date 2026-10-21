import { db } from '@/server/db';
import { ok, readJson, staff } from '@/server/http';
import { prefsPatchSchema, prefsSchema } from '@/schemas/prefs';

export const PATCH = staff(null, async ({ req, session }) => {
  const patch = Object.fromEntries(Object.entries(await readJson(req, prefsPatchSchema)).filter(([, v]) => v !== undefined));
  const current = prefsSchema.parse(session.user.prefs ?? {});
  const next = { ...current, ...patch };
  await db().user.update({ where: { id: session.user.id }, data: { prefs: next } });
  return ok(next);
});

export const dynamic = 'force-dynamic';
