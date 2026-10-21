import { notFound } from 'next/navigation';
import { PresentView } from '@/features/patient-card/PresentView';
import { requireStaff } from '@/server/auth/guard';
import { db } from '@/server/db';
import { listCatalog } from '@/server/services/catalog';
import { brushMapSchema } from '@/schemas/brushMap';

export const dynamic = 'force-dynamic';

export default async function PresentPage({ params }: { params: Promise<{ visitId: string }> }) {
  await requireStaff();
  const { visitId } = await params;
  const doc = await db().document.findFirst({ where: { visitId, type: 'BRUSH_MAP' } });
  if (!doc) notFound();
  const catalog = await listCatalog(true);
  return <PresentView visitId={visitId} content={brushMapSchema.parse(doc.content)} catalog={catalog.map((c) => ({ id: c.id, label: c.label, colorHex: c.colorHex }))} />;
}
