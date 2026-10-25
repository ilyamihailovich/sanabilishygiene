import { z } from 'zod';

/*
  Пародонтограмма: шесть точек у каждого зуба.
  Порядок точек в массивах: 0 — дистально-вестибулярная, 1 — вестибулярная, 2 — мезиально-вестибулярная,
  3 — дистально-оральная, 4 — оральная, 5 — мезиально-оральная (оральная — нёбная сверху, язычная снизу).
*/

const six = <T extends z.ZodTypeAny>(item: T, fill: z.infer<T>) => z.array(item).length(6).default(Array(6).fill(fill));

export const furcationGradeSchema = z.number().int().min(0).max(3);

export const perioToothSchema = z.object({
  missing: z.boolean().default(false),
  implant: z.boolean().default(false),
  /** Подвижность по Miller (1950): 0–3. */
  mobility: z.number().int().min(0).max(3).default(0),
  /** Фуркация по Hamp (1975): 0–3 в точках входа (b — вестибулярно, o — орально, mo/do — мезио- и дистально-нёбно). */
  furcation: z.partialRecord(z.enum(['b', 'o', 'mo', 'do']), furcationGradeSchema).default({}),
  /** Десневой край, мм от эмалево-цементной границы: плюс — край корональнее, минус — рецессия. */
  gm: six(z.number().int().min(-99).max(99), 0),
  /** Глубина зондирования, мм. */
  pd: six(z.number().int().min(0).max(99), 0),
  bop: six(z.boolean(), false),
  plaque: six(z.boolean(), false),
  note: z.string().max(200).default(''),
});

export const perioSchema = z.object({
  schema: z.literal(1),
  teeth: z.record(z.string().regex(/^[1-4][1-8]$/), perioToothSchema),
});

export type PerioTooth = z.infer<typeof perioToothSchema>;
export type PerioContent = z.infer<typeof perioSchema>;
export type FurcationSite = 'b' | 'o' | 'mo' | 'do';
