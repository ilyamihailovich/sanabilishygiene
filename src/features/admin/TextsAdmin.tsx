'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { lintPatientText } from '@/content/styleRules';
import { ui } from '@/content/ui.ru';
import { ApiError, api } from '@/ui/api';
import { Button } from '@/ui/Button';
import { Card, CardHeader } from '@/ui/Card';
import { CounterChip } from '@/ui/Chip';
import { TextArea, TextField } from '@/ui/Field';
import { Heading } from '@/ui/Heading';
import { IconPlus } from '@/ui/icons';
import { useToast } from '@/ui/Toast';
import s from './admin.module.css';

interface PsrRow {
  code: string;
  staffText: string;
  patientText: string;
  approved: boolean;
}
interface Grade {
  id?: string;
  minPct: number;
  maxPct: number;
  staffLabel: string;
  patientText: string;
  approved: boolean;
}

function LintHint({ text }: { text: string }) {
  const issues = lintPatientText(text);
  if (!issues.length) return null;
  return <span style={{ color: 'var(--color-notice-text)', fontSize: 'var(--fs-caption)' }}>{[...new Set(issues.map((i) => `${i.message}: «${i.match}»`))].join('; ')}</span>;
}

/** Тексты PSR и словесные оценки BOIB: правит администратор, утверждает врач. Правка снимает утверждение. */
export function TextsAdmin({ psr, grades, canEdit, canApprove }: { psr: PsrRow[]; grades: Grade[]; canEdit: boolean; canApprove: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [rows, setRows] = useState(psr);
  const [gradeRows, setGradeRows] = useState<Grade[]>(grades);
  const [prev, setPrev] = useState({ psr, grades });
  if (prev.psr !== psr || prev.grades !== grades) {
    setPrev({ psr, grades });
    setRows(psr);
    setGradeRows(grades);
  }
  const fail = (err: unknown) => toast(err instanceof ApiError ? err.message : 'Ошибка', 'error');

  const savePsr = async (r: PsrRow) => {
    try {
      await api.put('/api/v1/admin/psr-texts', { code: r.code, staffText: r.staffText, patientText: r.patientText });
      toast(ui.common.saved);
      router.refresh();
    } catch (err) {
      fail(err);
    }
  };
  const approvePsr = async (code: string, approved: boolean) => {
    await api.post(`/api/v1/admin/psr-texts/${encodeURIComponent(code)}/approve`, { approved }).catch(fail);
    router.refresh();
  };
  const saveGrade = async (g: Grade) => {
    try {
      const body = { minPct: g.minPct, maxPct: g.maxPct, staffLabel: g.staffLabel, patientText: g.patientText };
      if (g.id) await api.put(`/api/v1/admin/boib-grades/${g.id}`, body);
      else await api.post('/api/v1/admin/boib-grades', body);
      toast(ui.common.saved);
      router.refresh();
    } catch (err) {
      fail(err);
    }
  };

  return (
    <div className={s.page}>
      <Heading as="h1" level="title1" rest="утверждает врач">
        {ui.admin.texts}
      </Heading>
      <p className={s.muted}>Тексты для пациента выдаются только после утверждения врачом. Пока в тексте есть TODO, утвердить его нельзя, и документ с этим кодом не выдаётся.</p>

      <Heading as="h2" level="title3">
        Скрининг PSR
      </Heading>
      <div className={s.bento} style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
        {rows.map((r, i) => (
          <Card key={r.code} className={s.textCard}>
            <CardHeader
              title={r.code === '*' ? 'Отметка *' : `Код ${r.code}`}
              meta={<CounterChip>{r.approved ? ui.admin.approved : ui.admin.notApproved}</CounterChip>}
            />
            <TextArea label={ui.admin.staffText} value={r.staffText} disabled={!canEdit} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, staffText: e.target.value } : x)))} />
            <TextArea label={ui.admin.patientText} value={r.patientText} disabled={!canEdit} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, patientText: e.target.value } : x)))} />
            <LintHint text={r.patientText} />
            <div className={s.row}>
              {canEdit && (
                <Button variant="secondary" size="sm" onClick={() => savePsr(r)}>
                  {ui.common.save}
                </Button>
              )}
              {canApprove && (
                <Button size="sm" variant={r.approved ? 'ghost' : 'primary'} onClick={() => approvePsr(r.code, !r.approved)}>
                  {r.approved ? 'Снять утверждение' : ui.admin.approve}
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      <div className={s.head}>
        <Heading as="h2" level="title3" rest="границы и тексты задаёт клиника">
          Оценки BOIB
        </Heading>
        {canEdit && (
          <Button variant="secondary" leading={<IconPlus size={18} />} onClick={() => setGradeRows([...gradeRows, { minPct: 0, maxPct: 0, staffLabel: '', patientText: 'TODO', approved: false }])}>
            Оценка
          </Button>
        )}
      </div>
      {gradeRows.length === 0 && <p className={s.muted}>Оценок нет. Пока их нет, в документе выводится только значение индекса.</p>}
      <div className={s.bento} style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
        {gradeRows.map((g, i) => (
          <Card key={g.id ?? `new-${i}`} className={s.textCard}>
            <CardHeader title={`${g.minPct}–${g.maxPct} %`} meta={<CounterChip>{g.approved ? ui.admin.approved : ui.admin.notApproved}</CounterChip>} />
            <div className={s.grid2}>
              <TextField label="От, %" inputMode="numeric" value={String(g.minPct)} disabled={!canEdit} onChange={(e) => setGradeRows(gradeRows.map((x, j) => (j === i ? { ...x, minPct: Number(e.target.value) || 0 } : x)))} />
              <TextField label="До, %" inputMode="numeric" value={String(g.maxPct)} disabled={!canEdit} onChange={(e) => setGradeRows(gradeRows.map((x, j) => (j === i ? { ...x, maxPct: Number(e.target.value) || 0 } : x)))} />
            </div>
            <TextField label="Оценка для сотрудника" value={g.staffLabel} disabled={!canEdit} onChange={(e) => setGradeRows(gradeRows.map((x, j) => (j === i ? { ...x, staffLabel: e.target.value } : x)))} />
            <TextArea label={ui.admin.patientText} value={g.patientText} disabled={!canEdit} onChange={(e) => setGradeRows(gradeRows.map((x, j) => (j === i ? { ...x, patientText: e.target.value } : x)))} />
            <LintHint text={g.patientText} />
            <div className={s.row}>
              {canEdit && (
                <Button variant="secondary" size="sm" onClick={() => saveGrade(g)}>
                  {ui.common.save}
                </Button>
              )}
              {canApprove && g.id && (
                <Button
                  size="sm"
                  variant={g.approved ? 'ghost' : 'primary'}
                  onClick={async () => {
                    await api.post(`/api/v1/admin/boib-grades/${g.id}/approve`, { approved: !g.approved }).catch(fail);
                    router.refresh();
                  }}
                >
                  {g.approved ? 'Снять утверждение' : ui.admin.approve}
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
