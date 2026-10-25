import { CatalogAdmin } from '@/features/admin/CatalogAdmin';
import { requireStaff } from '@/server/auth/guard';
import { listCatalog } from '@/server/services/catalog';

export default async function CatalogPage({ searchParams }: { searchParams: Promise<{ brand?: string }> }) {
  await requireStaff('catalog.manage');
  const { brand } = await searchParams;
  return <CatalogAdmin items={await listCatalog(true)} brand={brand ?? null} />;
}
