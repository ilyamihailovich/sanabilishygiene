import { db } from '@/server/db';
import { badRequest, ok, staff } from '@/server/http';
import { writeData } from '@/server/storage';

const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export const POST = staff<{ id: string }>('catalog.manage', async ({ req, params }) => {
  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) throw badRequest('Файл не передан');
  const ext = TYPES[file.type];
  if (!ext) throw badRequest('Допустимы JPEG, PNG, WebP');
  if (file.size > 3 * 1024 * 1024) throw badRequest('Файл больше 3 МБ');
  const rel = `catalog/${params.id}.${ext}`;
  await writeData(rel, Buffer.from(await file.arrayBuffer()));
  await db().brushSize.update({ where: { id: params.id }, data: { photoPath: rel } });
  return ok();
});
