import { db } from '@/server/db';
import { badRequest, ok, staff } from '@/server/http';
import { prefsSchema } from '@/schemas/prefs';
import { avatarUrl } from '@/server/auth/guard';
import { writeData } from '@/server/storage';

const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/** Фото профиля сотрудника: JPEG, PNG или WebP до 2 МБ. Путь хранится в настройках пользователя. */
export const POST = staff(null, async ({ req, session }) => {
  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) throw badRequest('Файл не передан');
  const ext = TYPES[file.type];
  if (!ext) throw badRequest('Допустимы JPEG, PNG, WebP');
  if (file.size > 2 * 1024 * 1024) throw badRequest('Файл больше 2 МБ');
  const rel = `avatars/${session.user.id}.${ext}`;
  await writeData(rel, Buffer.from(await file.arrayBuffer()));
  const current = prefsSchema.parse(session.user.prefs ?? {});
  const next = { ...current, avatar: rel, avatarRev: current.avatarRev + 1 };
  await db().user.update({ where: { id: session.user.id }, data: { prefs: next } });
  return ok({ url: avatarUrl(session.user.id, next) });
});

/** Убрать фото: в шапке снова инициалы. Файл остаётся на томе до следующей загрузки. */
export const DELETE = staff(null, async ({ session }) => {
  const current = prefsSchema.parse(session.user.prefs ?? {});
  await db().user.update({ where: { id: session.user.id }, data: { prefs: { ...current, avatar: null, avatarRev: current.avatarRev + 1 } } });
  return ok({ url: null });
});

export const dynamic = 'force-dynamic';
