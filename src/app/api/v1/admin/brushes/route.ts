import { audit } from '@/server/audit';
import { db } from '@/server/db';
import { ok, readJson, staff } from '@/server/http';
import { brushSizeSchema, listCatalog, upsertBrand } from '@/server/services/catalog';

export const GET = staff('catalog.manage', async () => ok(await listCatalog(true)));

export const POST = staff('catalog.manage', async ({ req, session }) => {
  const { brand, verified, ...input } = await readJson(req, brushSizeSchema);
  const b = await upsertBrand(brand);
  const size = await db().brushSize.create({
    data: { ...input, brandId: b.id, verified, ...(verified ? { verifiedById: session.user.id, verifiedAt: new Date() } : {}) },
  });
  await audit({ userId: session.user.id, action: 'catalog.update', entityType: 'brush', entityId: size.id });
  return ok(size, { status: 201 });
});
