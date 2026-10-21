import { z } from 'zod';

export const SEXTANTS = [
  { id: 'S1', label: '17–14', arch: 'upper' },
  { id: 'S2', label: '13–23', arch: 'upper' },
  { id: 'S3', label: '24–27', arch: 'upper' },
  { id: 'S4', label: '47–44', arch: 'lower' },
  { id: 'S5', label: '43–33', arch: 'lower' },
  { id: 'S6', label: '34–37', arch: 'lower' },
] as const;

export type SextantId = (typeof SEXTANTS)[number]['id'];

export const psrCodeSchema = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal('X')]);

export const sextantSchema = z.object({
  code: psrCodeSchema.nullable().default(null),
  asterisk: z.boolean().default(false),
});

export const psrSchema = z.object({
  schema: z.literal(1),
  sextants: z.object({
    S1: sextantSchema,
    S2: sextantSchema,
    S3: sextantSchema,
    S4: sextantSchema,
    S5: sextantSchema,
    S6: sextantSchema,
  }),
});

export type PsrCode = z.infer<typeof psrCodeSchema>;
export type PsrContent = z.infer<typeof psrSchema>;
