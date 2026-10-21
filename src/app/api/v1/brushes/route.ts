import { ok, staff } from '@/server/http';
import { listCatalog } from '@/server/services/catalog';

export const GET = staff(null, async () => ok(await listCatalog()));
