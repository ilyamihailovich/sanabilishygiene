'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ui } from '@/content/ui.ru';
import { patientTitle } from '@/domain/patient';
import { ApiError, api } from '@/ui/api';
import { Button } from '@/ui/Button';
import { Dialog } from '@/ui/Dialog';
import { TextField } from '@/ui/Field';
import { Heading } from '@/ui/Heading';
import { IconDownload, IconPlus } from '@/ui/icons';
import { useToast } from '@/ui/Toast';
import { useCan } from '../shell/StaffContext';
import type { VisitMetrics } from '@/domain/history';
import { PatientDashboard } from './PatientDashboard';
import s from './patients.module.css';

interface Props {
  patient: { id: string; cardNumber: string; displayName: string | null; fullName: string | null };
  /** Визиты с показателями, от новых к старым. */
  history: VisitMetrics[];
  clinicians: Record<string, string | null>;
  nextVisit: string | null;
  /** PDF-отчёт по пациенту: показатели и графики по визитам. */
  reportUrl: string;
}

export function PatientCard({ patient, history, clinicians, nextVisit, reportUrl }: Props) {
  const router = useRouter();
  const toast = useToast();
  const canVisit = useCan('visit.write');
  const canEdit = useCan('patient.write');
  const [edit, setEdit] = useState(false);
  const [card, setCard] = useState(patient.cardNumber);
  const [fullName, setFullName] = useState(patient.fullName ?? '');
  const [busy, setBusy] = useState(false);

  const start = async (copyBrushMap: boolean) => {
    setBusy(true);
    try {
      const v = await api.post<{ id: string }>(`/api/v1/patients/${patient.id}/visits`, { copyBrushMap });
      router.push(`/visits/${v.id}`);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Ошибка', 'error');
      setBusy(false);
    }
  };

  const save = async () => {
    try {
      await api.patch(`/api/v1/patients/${patient.id}`, { cardNumber: card, fullName });
      setEdit(false);
      router.refresh();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Ошибка', 'error');
    }
  };

  const hasMap = history.some((v) => v.documents.includes('BRUSH_MAP'));

  return (
    <div className={s.page}>
      <div className={s.head}>
        <Heading as="h1" level="title1">
          {patientTitle(patient) ?? 'Без имени'} <span className={s.cardNumber}>{patient.cardNumber}</span>
        </Heading>
        <div className={s.actions}>
          {history.length > 0 && (
            <Button variant="ghost" leading={<IconDownload size={18} />} onClick={() => (reportUrl.startsWith('#') ? router.push(reportUrl.slice(1)) : window.open(reportUrl, '_blank', 'noopener'))}>
              Отчёт PDF
            </Button>
          )}
          {canEdit && (
            <Button variant="ghost" onClick={() => setEdit(true)}>
              {ui.common.edit}
            </Button>
          )}
          {canVisit && hasMap && (
            <Button variant="secondary" disabled={busy} onClick={() => start(true)}>
              {ui.patients.copyMap}
            </Button>
          )}
          {canVisit && (
            <Button leading={<IconPlus size={18} />} disabled={busy} onClick={() => start(false)}>
              {ui.patients.newVisit}
            </Button>
          )}
        </div>
      </div>

      {history.length ? (
        <PatientDashboard history={history} clinicians={clinicians} nextVisit={nextVisit} reportUrl={reportUrl} patient={patient} onEditPatient={canEdit ? () => setEdit(true) : undefined} />
      ) : (
        <p className={s.sub}>{ui.patients.noVisits}</p>
      )}

      <Dialog
        open={edit}
        onClose={() => setEdit(false)}
        title={ui.common.edit}
        actions={
          <>
            <Button variant="secondary" onClick={() => setEdit(false)}>
              {ui.common.cancel}
            </Button>
            <Button onClick={save}>{ui.common.save}</Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <TextField label={ui.patients.fullName} hint="Полностью. Обращение на онлайн-карте берётся из имени." value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={120} />
          <TextField label={ui.patients.cardNumber} value={card} onChange={(e) => setCard(e.target.value)} />
        </div>
      </Dialog>
    </div>
  );
}
