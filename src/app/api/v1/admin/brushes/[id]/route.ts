import { audit } from '@/server/audit';
import { db } from '@/server/db';
import { ok, readJson, staff } from '@/server/http';
import { brushSizePatchSchema, upsertBrand } from '@/server/services/catalog';

export const PATCH = staff<{ id: string }>('catalog.manage', async ({ req, params, session }) => {
  const { brand, verified, ...rest } = await readJson(req, brushSizePatchSchema);
  const data: Record<string, unknown> = { ...rest };
  if (brand) data.brandId = (await upsertBrand(brand)).id;
  if (verified !== undefined) {
    data.verified = verified;
    data.verifiedById = verified ? session.user.id : null;
    data.verifiedAt = verified ? new Date() : null;
  }
  const size = await db().brushSize.update({ where: { id: params.id }, data });
  await audit({ userId: session.user.id, action: 'catalog.update', entityType: 'brush', entityId: params.id, meta: { verified } });
  return ok(size);
});
