import { z } from 'zod';
import { db } from '../db';

export const brushSizeSchema = z.object({
  brand: z.string().trim().min(1).max(80),
  line: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(40),
  isoSize: z.string().trim().max(10).nullable().default(null),
  passageMm: z.coerce.number().min(0.1).max(10),
  bristleDiameterMm: z.coerce.number().min(0.1).max(20).nullable().default(null),
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Цвет в формате #RRGGBB'),
  verified: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(999).default(0),
});

/** Частичное обновление: без значений по умолчанию, иначе непереданные поля сбрасываются. */
export const brushSizePatchSchema = z.object({
  brand: z.string().trim().min(1).max(80).optional(),
  line: z.string().trim().min(1).max(80).optional(),
  label: z.string().trim().min(1).max(40).optional(),
  isoSize: z.string().trim().max(10).nullable().optional(),
  passageMm: z.coerce.number().min(0.1).max(10).optional(),
  bristleDiameterMm: z.coerce.number().min(0.1).max(20).nullable().optional(),
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Цвет в формате #RRGGBB').optional(),
  verified: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
  archived: z.boolean().optional(),
});

export interface CatalogItem {
  id: string;
  brand: string;
  line: string;
  label: string;
  isoSize: string | null;
  passageMm: string;
  bristleDiameterMm: string | null;
  colorHex: string;
  verified: boolean;
  sortOrder: number;
  hasPhoto: boolean;
  archived: boolean;
}

export async function listCatalog(includeArchived = false): Promise<CatalogItem[]> {
  const rows = await db().brushSize.findMany({
    where: includeArchived ? {} : { archived: false },
    include: { brand: true },
    orderBy: [{ sortOrder: 'asc' }, { passageMm: 'asc' }],
  });
  return rows.map((r) => ({
    id: r.id,
    brand: r.brand.name,
    line: r.line,
    label: r.label,
    isoSize: r.isoSize,
    passageMm: r.passageMm.toString(),
    bristleDiameterMm: r.bristleDiameterMm?.toString() ?? null,
    colorHex: r.colorHex,
    verified: r.verified,
    sortOrder: r.sortOrder,
    hasPhoto: Boolean(r.photoPath),
    archived: r.archived,
  }));
}

export async function upsertBrand(name: string) {
  return db().brushBrand.upsert({ where: { name }, create: { name }, update: {} });
}
