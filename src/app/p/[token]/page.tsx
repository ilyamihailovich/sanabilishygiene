import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PatientCardView } from '@/features/patient-card/PatientCardView';
import { audit } from '@/server/audit';
import { issueByToken, snapshotOf } from '@/server/services/issue';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'SANABILIS',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: 'no-referrer',
};

export default async function PatientCardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await issueByToken(token);
  if (!found) notFound();
  await audit({ actor: 'PATIENT_LINK', action: 'link.open', entityType: 'visit', entityId: found.issue.visitId, meta: { issue: found.issue.number } });
  return <PatientCardView snapshot={snapshotOf(found.issue)} pdfUrl={`/p/${token}/pdf`} />;
}
