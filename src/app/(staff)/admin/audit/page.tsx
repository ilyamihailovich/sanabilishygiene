import { AuditLogView } from '@/features/admin/AuditLogView';
import { auditActionLabels } from '@/server/audit';
import { requireStaff } from '@/server/auth/guard';
import { db } from '@/server/db';
import { queryAudit } from '@/server/services/auditQuery';

export default async function AuditPage() {
  await requireStaff('audit.view');
  const [first, users] = await Promise.all([
    queryAudit({}),
    db().user.findMany({ select: { id: true, displayName: true }, orderBy: { displayName: 'asc' } }),
  ]);
  return <AuditLogView initial={first} users={users} actions={Object.entries(auditActionLabels).map(([value, label]) => ({ value, label }))} />;
}
