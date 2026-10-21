import { db } from '@/server/db';
import { notFound, staff } from '@/server/http';
import { readData } from '@/server/storage';

export const GET = staff<{ id: string }>(null, async ({ params }) => {
  const size = await db().brushSize.findUnique({ where: { id: params.id } });
  const data = size?.photoPath ? await readData(size.photoPath) : null;
  if (!size?.photoPath || !data) throw notFound();
  const ext = size.photoPath.split('.').pop();
  const type = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  return new Response(new Uint8Array(data), { headers: { 'Content-Type': type, 'Cache-Control': 'private, max-age=300' } });
});
