import { z } from 'zod';
import { ALL_TEETH } from '@/domain/teeth';

export const toothStateSchema = z.enum(['PRESENT', 'CROWN', 'MISSING', 'IMPLANT', 'PONTIC']);

export const toothSchema = z.object({
  state: toothStateSchema,
  furcation: z.boolean().default(false),
});

export const sizeRefSchema = z.union([
  z.object({ catalogId: z.string().min(1).max(64) }),
  z.object({
    freeText: z.string().trim().min(1).max(40),
    /** Цвет своего размера на карте и в легенде; без цвета — пунктирная метка. */
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  }),
]);

export const approachSchema = z.enum(['VESTIBULAR', 'ORAL']);
export const methodSchema = z.enum(['THROUGH', 'ANGLED', 'BOTH']);
export const alternativeSchema = z.enum(['FLOSS']);

export const elementDataSchema = z.object({
  /** Для свободных поверхностей: включена ли в карту. */
  enabled: z.boolean().optional(),
  size: sizeRefSchema.nullable().default(null),
  approach: approachSchema.default('VESTIBULAR'),
  method: methodSchema.default('THROUGH'),
  /** null — не отмечено: с назначенным размером считается «нет», без размера промежуток не обследован. */
  bleeding: z.boolean().nullable().default(null),
  /** Болезненность, открытый контакт и «не требуется» больше не отмечаются: в старых картах такие поля отбрасываются. */
  alternative: z.preprocess((v) => (v === 'NONE' ? null : v), alternativeSchema.nullable().default(null)),
});

export const extraSchema = z.object({
  id: z.string().regex(/^[a-z0-9]{4,16}$/),
  label: z.string().trim().min(1).max(40),
  /** Два соседних по дуге зуба, между которыми расположен дополнительный промежуток. */
  between: z.tuple([z.number().int(), z.number().int()]),
});

const toothKey = z.string().refine((k) => ALL_TEETH.includes(Number(k)), 'Неизвестный зуб');

export const brushMapSchema = z.object({
  schema: z.literal(1),
  teeth: z.record(toothKey, toothSchema),
  elements: z.record(z.string().max(32), elementDataSchema),
  extras: z.array(extraSchema).max(32).default([]),
});

export type SizeRef = z.infer<typeof sizeRefSchema>;
export type ElementData = z.infer<typeof elementDataSchema>;
export type Extra = z.infer<typeof extraSchema>;
export type BrushMapContent = z.infer<typeof brushMapSchema>;
export type Approach = z.infer<typeof approachSchema>;
export type Method = z.infer<typeof methodSchema>;
export type Alternative = z.infer<typeof alternativeSchema>;
