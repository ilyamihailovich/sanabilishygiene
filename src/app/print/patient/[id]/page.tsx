import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PatientReport } from '@/features/patients/PatientReport';
import { verifyInternal } from '@/server/crypto';
import { loadPatientHistory } from '@/server/services/history';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Печатная вёрстка отчёта по пациенту для сервиса PDF. Открывается только с короткоживущей подписью. */
export default async function PatientReportPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ sig?: string }> }) {
  const { id } = await params;
  const { sig } = await searchParams;
  if (!verifyInternal(`patient-report:${id}`, sig)) notFound();
  const data = await loadPatientHistory(id);
  if (!data) notFound();
  return (
    <>
      <PatientReport patient={data.patient} history={data.history} clinicians={data.clinicians} generatedAt={new Date().toISOString().slice(0, 10)} />
      <script dangerouslySetInnerHTML={{ __html: 'document.fonts.ready.then(()=>{window.__printReady=true})' }} />
    </>
  );
}
