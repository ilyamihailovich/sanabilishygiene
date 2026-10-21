import { audit } from '@/server/audit';
import { db } from '@/server/db';
import { notFound, staff } from '@/server/http';
import { pdfResponse, getIssuePdf } from '@/server/services/renderer';

export const GET = staff<{ id: string }>(null, async ({ params, session }) => {
  const issue = await db().visitIssue.findUnique({ where: { id: params.id } });
  if (!issue) throw notFound();
  const pdf = await getIssuePdf(issue.id);
  await audit({ userId: session.user.id, action: 'pdf.download', entityType: 'visit', entityId: issue.visitId, meta: { issue: issue.number } });
  return pdfResponse(pdf, issue, false);
});
