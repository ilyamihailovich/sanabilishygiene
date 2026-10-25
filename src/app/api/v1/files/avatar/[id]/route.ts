import { db } from '@/server/db';
import { notFound, staff } from '@/server/http';
import { prefsSchema } from '@/schemas/prefs';
import { readData } from '@/server/storage';

/** Фото профиля сотрудника: видно только сотрудникам клиники. */
export const GET = staff<{ id: string }>(null, async ({ params }) => {
  const user = await db().user.findUnique({ where: { id: params.id }, select: { prefs: true } });
  const rel = user ? prefsSchema.parse(user.prefs ?? {}).avatar : null;
  const data = rel ? await readData(rel) : null;
  if (!rel || !data) throw notFound();
  const ext = rel.split('.').pop();
  const type = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  return new Response(new Uint8Array(data), { headers: { 'Content-Type': type, 'Cache-Control': 'private, max-age=86400' } });
});
