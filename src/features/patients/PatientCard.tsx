'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ui } from '@/content/ui.ru';
import { ApiError, api } from '@/ui/api';
import { Button } from '@/ui/Button';
import { Card, CardHeader } from '@/ui/Card';
import { CounterChip } from '@/ui/Chip';
import { Dialog } from '@/ui/Dialog';
import { TextField } from '@/ui/Field';
import { Heading } from '@/ui/Heading';
import { IconChevronRight, IconPlus } from '@/ui/icons';
import { formatDate } from '@/ui/format';
import { useToast } from '@/ui/Toast';
import { useCan } from '../shell/StaffContext';
import { TrendChart } from './TrendChart';
import s from './patients.module.css';

const docLabels = { BRUSH_MAP: 'Карта ёршиков', PSR: 'Скрининг', HYGIENE_PLAN: 'Схема гигиены', AFTERCARE: 'Памятка' } as const;

interface Props {
  patient: { id: string; cardNumber: string; displayName: string | null };
  visits: Array<{
    id: string;
    date: string;
    status: 'DRAFT' | 'ISSUED';
    documents: Array<keyof typeof docLabels>;
    boib: number | null;
    psr: number | null;
    psrStar: boolean;
    lastIssueId: string | null;
  }>;
}

export function PatientCard({ patient, visits }: Props) {
  const router = useRouter();
  const toast = useToast();
  const canVisit = useCan('visit.write');
  const canEdit = useCan('patient.write');
  const [edit, setEdit] = useState(false);
  const [card, setCard] = useState(patient.cardNumber);
  const [name, setName] = useState(patient.displayName ?? '');
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
      await api.patch(`/api/v1/patients/${patient.id}`, { cardNumber: card, displayName: name });
      setEdit(false);
      router.refresh();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Ошибка', 'error');
    }
  };

  const chrono = [...visits].reverse();
  const boib = chrono.filter((v) => v.boib !== null).map((v) => ({ date: v.date, value: v.boib!, label: `${v.boib} %` }));
  const psr = chrono.filter((v) => v.psr !== null).map((v) => ({ date: v.date, value: v.psr!, label: `${v.psr}${v.psrStar ? '*' : ''}` }));
  const hasMap = visits.some((v) => v.documents.includes('BRUSH_MAP'));

  return (
    <div className={s.page}>
      <div className={s.head}>
        <Heading as="h1" level="title1" rest={patient.displayName ?? undefined}>
          {patient.cardNumber}
        </Heading>
        <div className={s.actions}>
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

      <div className={s.bento}>
        <Card className={s.visits}>
          <CardHeader title={ui.patients.visits} meta={<CounterChip>{visits.length}</CounterChip>} />
          {visits.length ? (
            <ul className={s.visitList}>
              {visits.map((v) => (
                <li key={v.id}>
                  <Link href={`/visits/${v.id}`} className={s.visitRow}>
                    <span className={s.card}>{formatDate(v.date)}</span>
                    <span className={s.docs}>
                      <CounterChip>{v.status === 'ISSUED' ? ui.patients.issued : ui.patients.draft}</CounterChip>
                      {v.documents.map((d, i) => (
                        <CounterChip key={d + i} tone="surface">
                          {docLabels[d]}
                        </CounterChip>
                      ))}
                    </span>
                    <IconChevronRight size={18} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className={s.sub} style={{ marginTop: 'var(--space-3)' }}>
              {ui.patients.noVisits}
            </p>
          )}
        </Card>
        <div className={s.charts}>
          {boib.length > 0 && (
            <Card>
              <TrendChart title={ui.patients.boibChart} points={boib} yMax={100} yTicks={[0, 25, 50, 75, 100]} format={(v) => `${v}`} />
            </Card>
          )}
          {psr.length > 0 && (
            <Card>
              <TrendChart title={ui.patients.psrChart} points={psr} yMax={4} yTicks={[0, 1, 2, 3, 4]} format={(v) => `${v}`} step />
            </Card>
          )}
        </div>
      </div>

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
          <TextField label={ui.patients.cardNumber} value={card} onChange={(e) => setCard(e.target.value)} />
          <TextField label={ui.patients.displayName} hint={ui.patients.displayNameHint} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
      </Dialog>
    </div>
  );
}
