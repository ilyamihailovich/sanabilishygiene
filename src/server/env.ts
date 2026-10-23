import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  APP_SECRET: z.string().min(32, 'APP_SECRET: не короче 32 символов'),
  APP_URL: z.string().url(),
  RENDERER_URL: z.string().url().default('http://localhost:3100'),
  /** Адрес приложения изнутри сети контейнеров, по нему сервис рендера открывает печатную вёрстку. */
  INTERNAL_APP_URL: z.string().url().optional(),
  DATA_DIR: z.string().default('./data'),
  /**
   * Распознавание речи для диктовки карты: сервис с API, совместимым с OpenAI (POST <STT_URL>/audio/transcriptions).
   * Свой сервер Whisper в клинике (например, speaches/faster-whisper), Groq или OpenAI. Без STT_URL — распознавание браузера.
   */
  STT_URL: z.string().url().optional(),
  STT_KEY: z.string().optional(),
  STT_MODEL: z.string().default('whisper-1'),
  /** true — сервис распознавания внутри клиники: звук не покидает её сеть, предупреждение врачу не показывается. */
  STT_PRIVATE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

let cached: z.infer<typeof schema> | null = null;

/** Переменные окружения проверяются при первом обращении, а не при сборке. */
export function env() {
  cached ??= schema.parse(process.env);
  return cached;
}
