import { badRequest, ok, staff } from '@/server/http';
import { speechConfig, transcribe } from '@/server/services/speech';

/** Какой способ распознавания доступен: серверный или только браузерный. */
export const GET = staff(null, async () => ok(speechConfig()));

/** Одна фраза диктовки (звук) → текст. */
export const POST = staff('document.write', async ({ req }) => {
  const form = await req.formData();
  const file = form.get('audio');
  if (!(file instanceof File)) throw badRequest('Звук не передан');
  return ok({ text: await transcribe(file) });
});

export const dynamic = 'force-dynamic';
