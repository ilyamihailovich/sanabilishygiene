import { env } from '../env';
import { HttpError, badRequest } from '../http';

/** Подсказка распознаванию: словарь диктовки, чтобы цифры, производители и отметки распознавались в нужном написании. */
const PROMPT =
  'Карта межзубных ёршиков. 16 15 TePe 0,6. 15 14 Curasept 0,8, кровоточивость. Дальше. 1,1. Curaprox 0,7. 46 45 нить. 36 имплантат. 25 коронка. Отмена.';

const TYPES: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
};

export function speechConfig() {
  const e = env();
  return e.STT_URL ? { engine: 'server' as const, private: e.STT_PRIVATE } : { engine: null, private: false };
}

/** Фраза врача в текст. Звук не сохраняется и не пишется в журнал. */
export async function transcribe(file: File): Promise<string> {
  const e = env();
  if (!e.STT_URL) throw new HttpError(404, 'stt_disabled', 'Распознавание речи на сервере не настроено');
  const type = file.type.split(';')[0]!.trim();
  const ext = TYPES[type];
  if (!ext) throw badRequest('Неподдерживаемый формат звука');
  if (file.size > 4 * 1024 * 1024) throw badRequest('Фраза слишком длинная');
  const form = new FormData();
  form.set('file', new File([await file.arrayBuffer()], `phrase.${ext}`, { type }));
  form.set('model', e.STT_MODEL);
  form.set('language', 'ru');
  form.set('prompt', PROMPT);
  form.set('temperature', '0');
  form.set('response_format', 'json');
  let res: Response;
  try {
    res = await fetch(`${e.STT_URL.replace(/\/$/, '')}/audio/transcriptions`, {
      method: 'POST',
      headers: e.STT_KEY ? { Authorization: `Bearer ${e.STT_KEY}` } : {},
      body: form,
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new HttpError(503, 'stt_unavailable', 'Сервис распознавания речи недоступен');
  }
  if (!res.ok) throw new HttpError(502, 'stt_failed', 'Сервис распознавания речи вернул ошибку');
  const body = (await res.json()) as { text?: string };
  return (body.text ?? '').trim();
}
