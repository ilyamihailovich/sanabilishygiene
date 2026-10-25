import { z } from 'zod';

export const prefsSchema = z.object({
  mapMode: z.enum(['three', 'scheme']).default('three'),
  /** Порядок размеров каталога для клавиш 1–9, 0 (id позиций). Пусто — порядок каталога. */
  sizeHotkeys: z.array(z.string()).max(10).default([]),
  /** Фото профиля: путь на томе данных; меняется только через /api/v1/me/avatar. */
  avatar: z.string().nullable().default(null),
  /** Номер версии фото: адрес картинки меняется после замены, кэш браузера не мешает. */
  avatarRev: z.number().int().default(0),
});

export type Prefs = z.infer<typeof prefsSchema>;

/** Частичное обновление настроек без значений по умолчанию. */
export const prefsPatchSchema = z.object({
  mapMode: z.enum(['three', 'scheme']).optional(),
  sizeHotkeys: z.array(z.string()).max(10).optional(),
});
