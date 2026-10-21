import { auditActionLabels } from '../audit';
import { db } from '../db';

export interface AuditFilter {
  userId?: string | undefined;
  action?: string | undefined;
  entityId?: string | undefined;
  /** Курсор: id записи, раньше которой показывать. */
  before?: string | undefined;
}

export async function queryAudit(filter: AuditFilter, take = 50) {
  const rows = await db().auditLog.findMany({
    where: {
      ...(filter.userId ? { userId: filter.userId } : {}),
      ...(filter.action ? { action: filter.action } : {}),
      ...(filter.entityId ? { entityId: filter.entityId } : {}),
      ...(filter.before ? { id: { lt: BigInt(filter.before) } } : {}),
    },
    orderBy: { id: 'desc' },
    take,
  });
  const userIds = [...new Set(rows.flatMap((r) => (r.userId ? [r.userId] : [])))];
  const users = await db().user.findMany({ where: { id: { in: userIds } }, select: { id: true, displayName: true } });
  const names = new Map(users.map((u) => [u.id, u.displayName]));
  return {
    rows: rows.map((r) => ({
      id: r.id.toString(),
      at: r.at.toISOString(),
      actor: r.actor,
      user: r.userId ? (names.get(r.userId) ?? '—') : r.actor === 'PATIENT_LINK' ? 'Пациент по ссылке' : 'Система',
      action: r.action,
      actionLabel: auditActionLabels[r.action] ?? r.action,
      entityType: r.entityType,
      entityId: r.entityId,
    })),
    next: rows.length === take ? rows[rows.length - 1]!.id.toString() : null,
  };
}
