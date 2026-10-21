import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  APP_SECRET: z.string().min(32, 'APP_SECRET: не короче 32 символов'),
  APP_URL: z.string().url(),
  RENDERER_URL: z.string().url().default('http://localhost:3100'),
  /** Адрес приложения изнутри сети контейнеров, по нему сервис рендера открывает печатную вёрстку. */
  INTERNAL_APP_URL: z.string().url().optional(),
  DATA_DIR: z.string().default('./data'),
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
