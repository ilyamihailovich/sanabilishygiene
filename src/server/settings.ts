import { z } from 'zod';
import { db } from './db';

export const settingsSchema = z.object({
  idleTimeoutMin: z.number().int().min(5).max(240),
  clinic: z.object({
    name: z.string().min(1),
    address: z.string().min(1),
    phone: z.string().min(1),
    site: z.string().min(1),
  }),
  /** Шаги «Как пользоваться ёршиком» для пациента. Тексты даёт клиника; с TODO блок не показывается. */
  brushSteps: z.array(z.string().max(400)).max(4),
});

export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  idleTimeoutMin: 30,
  clinic: {
    name: 'SANABILIS',
    address: 'Москва, ул. Маршала Тимошенко, д. 17, корп. 2',
    phone: '+7 (495) 417-00-00',
    site: 'sanabilis.ru',
  },
  brushSteps: ['TODO: шаг 1', 'TODO: шаг 2', 'TODO: шаг 3', 'TODO: шаг 4'],
};

export async function getSettings(): Promise<Settings> {
  const rows = await db().setting.findMany();
  const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const row of rows) merged[row.key] = row.value;
  const parsed = settingsSchema.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}

export async function saveSettings(next: Settings): Promise<void> {
  await db().$transaction(
    Object.entries(next).map(([key, value]) =>
      db().setting.upsert({ where: { key }, create: { key, value }, update: { value } }),
    ),
  );
}
