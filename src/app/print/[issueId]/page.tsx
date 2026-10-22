import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import { PrintDocument } from '@/features/patient-card/PrintDocument';
import { verifyInternal } from '@/server/crypto';
import { db } from '@/server/db';
import { activeLinkToken, patientUrl, publicSnapshotOf, snapshotOf } from '@/server/services/issue';
import { readData } from '@/server/storage';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Печатная вёрстка для сервиса PDF. Открывается только с короткоживущей подписью.
 * Вариант public (PDF по ссылке пациента) печатается без ФИО; вариант входит в подпись.
 */
export default async function PrintPage({ params, searchParams }: { params: Promise<{ issueId: string }>; searchParams: Promise<{ sig?: string; variant?: string }> }) {
  const { issueId } = await params;
  const { sig, variant } = await searchParams;
  const isPublic = variant === 'public';
  if (!verifyInternal(`print:${issueId}:${isPublic ? 'public' : 'staff'}`, sig)) notFound();
  const issue = await db().visitIssue.findUnique({ where: { id: issueId } });
  if (!issue) notFound();
  const token = await activeLinkToken(issue.visitId);
  const qrSvg = token
    ? await QRCode.toString(patientUrl(token), { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#1d1d1f', light: '#ffffff' } })
    : null;
  const renders: Partial<Record<'upper' | 'lower' | 'front', string>> = {};
  const paths = (issue.renders ?? {}) as Partial<Record<'upper' | 'lower' | 'front', string>>;
  for (const [view, rel] of Object.entries(paths)) {
    const data = rel ? await readData(rel) : null;
    if (data) renders[view as 'upper'] = `data:image/png;base64,${data.toString('base64')}`;
  }
  return (
    <>
      <PrintDocument snapshot={isPublic ? publicSnapshotOf(issue) : snapshotOf(issue)} qrSvg={qrSvg} renders={renders} />
      <script dangerouslySetInnerHTML={{ __html: 'document.fonts.ready.then(()=>{window.__printReady=true})' }} />
    </>
  );
}
