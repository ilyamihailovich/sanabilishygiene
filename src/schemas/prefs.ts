import { z } from 'zod';

export const prefsSchema = z.object({
  mapMode: z.enum(['three', 'scheme']).default('three'),
  /** Порядок размеров каталога для клавиш 1–9, 0 (id позиций). Пусто — порядок каталога. */
  sizeHotkeys: z.array(z.string()).max(10).default([]),
});

export type Prefs = z.infer<typeof prefsSchema>;
