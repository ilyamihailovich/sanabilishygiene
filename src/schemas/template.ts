import { z } from 'zod';

export const PRODUCT_CATEGORIES = [
  'TOOTHBRUSH',
  'PASTE',
  'INTERDENTAL',
  'FLOSS',
  'IRRIGATOR',
  'RINSE',
  'GEL',
  'TONGUE',
  'OTHER',
] as const;

export const productCategoryLabels: Record<(typeof PRODUCT_CATEGORIES)[number], string> = {
  TOOTHBRUSH: 'Зубная щётка',
  PASTE: 'Паста',
  INTERDENTAL: 'Межзубные ёршики',
  FLOSS: 'Зубная нить',
  IRRIGATOR: 'Ирригатор',
  RINSE: 'Ополаскиватель',
  GEL: 'Гель',
  TONGUE: 'Скребок для языка',
  OTHER: 'Прочее',
};

export const TIMES_OF_DAY = ['MORNING', 'DAY', 'EVENING'] as const;
export const timeOfDayLabels: Record<(typeof TIMES_OF_DAY)[number], string> = {
  MORNING: 'утром',
  DAY: 'днём',
  EVENING: 'вечером',
};

const id = z.string().regex(/^[a-zA-Z0-9_-]{4,24}$/);
const text = z.string().max(2000);

const base = { id, required: z.boolean().default(false) };

export const textItemSchema = z.object({ ...base, type: z.literal('text'), text });
export const productItemSchema = z.object({
  ...base,
  type: z.literal('product'),
  category: z.enum(PRODUCT_CATEGORIES),
  name: z.string().max(200),
  usage: text,
  frequency: z.string().max(200),
  duration: z.string().max(200),
  timeOfDay: z.array(z.enum(TIMES_OF_DAY)).max(3).default([]),
  /** Препарат: в документе вместо дозировки выводится «по назначению врача». */
  prescription: z.boolean().default(false),
});
export const choiceItemSchema = z.object({
  ...base,
  type: z.literal('choice'),
  prompt: text,
  multiple: z.boolean().default(false),
  options: z.array(z.object({ id, label: z.string().max(300) })).max(20),
});
export const inputItemSchema = z.object({
  ...base,
  type: z.literal('input'),
  label: z.string().max(300),
  inputKind: z.enum(['text', 'date', 'number']).default('text'),
  suffix: z.string().max(40).default(''),
});
export const warningItemSchema = z.object({ ...base, type: z.literal('warning'), title: z.string().max(200), text });
/** Блок ёршиков: подтягивается из карты ёршиков визита. */
export const brushesItemSchema = z.object({ ...base, type: z.literal('brushes') });

export const templateItemSchema = z.discriminatedUnion('type', [
  textItemSchema,
  productItemSchema,
  choiceItemSchema,
  inputItemSchema,
  warningItemSchema,
  brushesItemSchema,
]);

export const sectionSchema = z.object({
  id,
  title: z.string().max(200),
  items: z.array(templateItemSchema).max(100),
});

export const templateStructureSchema = z.object({
  schema: z.literal(1),
  sections: z.array(sectionSchema).max(30),
});

/** Заполненный пункт документа: копия пункта шаблона плюс выбор врача. */
export const filledItemSchema = z.intersection(
  templateItemSchema,
  z.object({
    enabled: z.boolean().default(true),
    selected: z.array(z.string()).default([]),
    value: z.string().max(500).default(''),
  }),
);

export const filledDocumentSchema = z.object({
  schema: z.literal(1),
  templateId: z.string().nullable(),
  templateVersion: z.number().int().nullable(),
  title: z.string().max(200),
  sections: z.array(
    z.object({
      id,
      title: z.string().max(200),
      enabled: z.boolean().default(true),
      items: z.array(filledItemSchema).max(100),
    }),
  ),
});

export type TemplateItem = z.infer<typeof templateItemSchema>;
export type TemplateSection = z.infer<typeof sectionSchema>;
export type TemplateStructure = z.infer<typeof templateStructureSchema>;
export type FilledItem = z.infer<typeof filledItemSchema>;
export type FilledDocument = z.infer<typeof filledDocumentSchema>;
