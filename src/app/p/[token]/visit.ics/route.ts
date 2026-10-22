import type { NextRequest } from 'next/server';
import { visitCalendar } from '@/domain/calendar';
import { errorResponse, notFound } from '@/server/http';
import { issueByToken, publicSnapshotOf } from '@/server/services/issue';

/** Напоминание о повторном визите для календаря пациента. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params;
    const found = await issueByToken(token);
    if (!found) throw notFound();
    const ics = visitCalendar(publicSnapshotOf(found.issue), `${found.issue.id}@sanabilis`);
    if (!ics) throw notFound();
    return new Response(ics, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `inline; filename="SANABILIS-visit.ics"`,
        'Cache-Control': 'private, no-store',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
