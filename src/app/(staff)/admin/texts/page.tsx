import { notFound } from 'next/navigation';
import { TextsAdmin } from '@/features/admin/TextsAdmin';
import { requireStaff } from '@/server/auth/guard';
import { db } from '@/server/db';
import { can } from '@/server/rbac';

export default async function TextsPage() {
  const session = await requireStaff();
  const canEdit = can(session.user.role, 'texts.edit');
  const canApprove = can(session.user.role, 'texts.approve');
  if (!canEdit && !canApprove) notFound();
  const [psr, grades] = await Promise.all([db().psrText.findMany({ orderBy: { code: 'asc' } }), db().boibGrade.findMany({ orderBy: { minPct: 'asc' } })]);
  return (
    <TextsAdmin
      canEdit={canEdit}
      canApprove={canApprove}
      psr={psr.map((t) => ({ code: t.code, staffText: t.staffText, patientText: t.patientText, approved: t.approved }))}
      grades={grades.map((g) => ({ id: g.id, minPct: g.minPct, maxPct: g.maxPct, staffLabel: g.staffLabel, patientText: g.patientText, approved: g.approved }))}
    />
  );
}
