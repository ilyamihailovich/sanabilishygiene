import { notFound } from 'next/navigation';
import { PatientCard } from '@/features/patients/PatientCard';
import { requireStaff } from '@/server/auth/guard';
import { loadPatientHistory } from '@/server/services/history';

export default async function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const data = await loadPatientHistory(id);
  if (!data) notFound();
  return <PatientCard {...data} reportUrl={`/api/v1/patients/${id}/report`} />;
}
