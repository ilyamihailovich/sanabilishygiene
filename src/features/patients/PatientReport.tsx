'use client';

import { patientTitle } from '@/domain/patient';
import { delta, type VisitMetrics } from '@/domain/history';
import { formatDate } from '@/ui/format';
import { BrushSet, DOC_STEP, METRICS, PocketBars, PsrStrip, comma, series } from './PatientDashboard';
import { TrendChart } from './TrendChart';
import s from './report.module.css';

interface Props {
  patient: { cardNumber: string; displayName: string | null; fullName: string | null };
  history: VisitMetrics[];
  clinicians: Record<string, string | null>;
  generatedAt: string;
}

/** PDF-отчёт по пациенту для врача: показатели по визитам таблицей и графиками, набор ёршиков, визиты и документы. */
export function PatientReport({ patient, history, clinicians, generatedAt }: Props) {
  const metrics = METRICS.filter((m) => history.some((v) => m.get(v) !== null));
  const cols = history.slice(0, 5).reverse();
  return (
    <article className={s.page}>
      <header className={s.head}>
        <div>
          <span className={s.brand}>SANABILIS</span>
          <h1 className={s.title}>Отчёт по пациенту</h1>
          <p className={s.meta}>
            {patient.fullName || patientTitle(patient) || 'Без имени'} · медкарта {patient.cardNumber}
          </p>
        </div>
        <p className={s.meta}>
          Сформирован {formatDate(generatedAt)}
          <br />
          Визитов {history.length}
        </p>
      </header>

      <section className={s.block}>
        <h2 className={s.h2}>Показатели по визитам</h2>
        <table className={s.table}>
          <thead>
            <tr>
              <th>Показатель</th>
              {cols.map((v) => (
                <th key={v.id}>{formatDate(v.date)}</th>
              ))}
              <th>Изменение</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => {
              const values = series(history, m).map((p) => p.value);
              const d = delta(values);
              return (
                <tr key={m.key}>
                  <td>{m.title}</td>
                  {cols.map((v) => (
                    <td key={v.id}>{m.get(v) === null ? '—' : m.format ? m.format(v).split(' · ')[0] : `${comma(m.get(v)!)}${m.unit}`}</td>
                  ))}
                  <td>{d === null ? '—' : `${d > 0 ? '+' : ''}${comma(d)}${m.deltaUnit ? ` ${m.deltaUnit}` : ''}`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className={s.charts}>
        {metrics.map((m) => {
          const pts = series(history, m).filter((p) => p.value !== null) as Array<{ v: VisitMetrics; value: number }>;
          if (pts.length < 2) return null;
          const values = pts.map((p) => p.value);
          return (
            <div key={m.key} className={s.chart}>
              <TrendChart
                title={m.title}
                points={pts.map((p) => ({ date: p.v.date, value: p.value, label: m.format ? m.format(p.v).split(' · ')[0]! : `${comma(p.value)}${m.unit}` }))}
                yMax={m.max(values)}
                yTicks={m.ticks ?? [0, Math.round(m.max(values) / 2), m.max(values)]}
                format={(v) => comma(v)}
                step={m.step}
              />
            </div>
          );
        })}
      </section>

      <section className={s.cards}>
        <PocketBars history={history} />
        <PsrStrip history={history} />
        <BrushSet history={history} />
      </section>

      <section className={s.block}>
        <h2 className={s.h2}>Визиты</h2>
        <table className={s.table}>
          <thead>
            <tr>
              <th>Дата</th>
              <th>Врач</th>
              <th>Документы</th>
            </tr>
          </thead>
          <tbody>
            {history.map((v) => (
              <tr key={v.id}>
                <td>{formatDate(v.date)}</td>
                <td>{clinicians[v.id] ?? '—'}</td>
                <td>{v.documents.map((d) => DOC_STEP[d]!.label).join(', ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </article>
  );
}
