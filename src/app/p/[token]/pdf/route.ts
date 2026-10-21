import type { NextRequest } from 'next/server';
import { audit } from '@/server/audit';
import { errorResponse, notFound } from '@/server/http';
import { issueByToken } from '@/server/services/issue';
import { getIssuePdf, pdfResponse } from '@/server/services/renderer';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params;
    const found = await issueByToken(token);
    if (!found) throw notFound();
    const pdf = await getIssuePdf(found.issue.id);
    await audit({ actor: 'PATIENT_LINK', action: 'pdf.download', entityType: 'visit', entityId: found.issue.visitId, meta: { issue: found.issue.number } });
    return pdfResponse(pdf, found.issue, false);
  } catch (e) {
    return errorResponse(e);
  }
}
