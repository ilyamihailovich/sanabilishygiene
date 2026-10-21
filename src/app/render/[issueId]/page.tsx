import { notFound } from 'next/navigation';
import { CaptureScene } from '@/features/patient-card/CaptureScene';
import type { ViewKey } from '@/features/brush-map/useMapKeyboard';
import { verifyInternal } from '@/server/crypto';
import { db } from '@/server/db';
import { snapshotOf } from '@/server/services/issue';

export const dynamic = 'force-dynamic';

const VIEWS: ViewKey[] = ['upper', 'lower', 'front'];

export default async function RenderPage({ params, searchParams }: { params: Promise<{ issueId: string }>; searchParams: Promise<{ sig?: string; view?: string }> }) {
  const { issueId } = await params;
  const { sig, view } = await searchParams;
  if (!verifyInternal(`render:${issueId}`, sig)) notFound();
  const issue = await db().visitIssue.findUnique({ where: { id: issueId } });
  if (!issue) notFound();
  const v = VIEWS.includes(view as ViewKey) ? (view as ViewKey) : 'upper';
  return <CaptureScene snapshot={snapshotOf(issue)} view={v} />;
}
