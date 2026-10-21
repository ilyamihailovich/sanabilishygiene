import { ok, staff } from '@/server/http';
import { queryAudit } from '@/server/services/auditQuery';

export const GET = staff('audit.view', async ({ req }) => {
  const p = req.nextUrl.searchParams;
  return ok(
    await queryAudit({
      userId: p.get('user') || undefined,
      action: p.get('action') || undefined,
      entityId: p.get('entity') || undefined,
      before: p.get('before') || undefined,
    }),
  );
});
