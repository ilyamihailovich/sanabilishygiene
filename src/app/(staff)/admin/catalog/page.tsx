import { CatalogAdmin } from '@/features/admin/CatalogAdmin';
import { requireStaff } from '@/server/auth/guard';
import { listCatalog } from '@/server/services/catalog';

export default async function CatalogPage() {
  await requireStaff('catalog.manage');
  return <CatalogAdmin items={await listCatalog(true)} />;
}
