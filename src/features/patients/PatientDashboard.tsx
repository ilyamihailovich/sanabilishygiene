'use client';

import Link from 'next/link';
import { useState } from 'react';
import { brushChanges, delta, type DocType, type VisitMetrics } from '@/domain/history';
import { SEXTANTS } from '@/schemas/psr';
import { Card, CardHeader } from '@/ui/Card';
import { CounterChip } from '@/ui/Chip';
import { cx } from '@/ui/cx';
import { Dialog } from '@/ui/Dialog';
import { IconChevronRight } from '@/ui/icons';
import { plural } from '@/content/plural';
import { formatDate } from '@/ui/format';
import { TrendChart } from './TrendChart';
import s from './dashboard.module.css';

/*
  Карточка пациента как сводка: плитки показателей с динамикой, графики по визитам, набор ёршиков
  и лента визитов с документами. Каждая плитка открывается подробно: график и значения по всем визитам.
*/

export interface Metric {
  key: string;
  title: string;
  /** Пояснение в подробном виде: что это за показатель и откуда берётся. */
  about: string;
  unit: string;
  get: (v: VisitMetrics) => number | null;
  format?: (v: VisitMetrics) => string;
  /** Что считается улучшением: снижение для всех показателей воспаления и карманов. */
  better: 'down' | 'up';
  max: (values: number[]) => number;
  ticks?: number[];
  step?: boolean;
  deltaUnit: string;
}

const pctMax = () => 100;
const mmMax = (vs: number[]) => Math.max(4, Math.ceil(Math.max(...vs) * 1.25));
const countMax = (vs: number[]) => Math.max(4, Math.ceil(Math.max(...vs) * 1.25));
export const comma = (v: number) => String(v).replace('.', ',');

export const METRICS: Metric[] = [
  {
    key: 'boib',
    title: 'Кровоточивость промежутков',
    about: 'BOIB: доля межзубных промежутков, кровоточащих после ёршика, из обследованных. Карта ёршиков.',
    unit: '%',
    get: (v) => v.boib?.pct ?? null,
    format: (v) => (v.boib?.pct == null ? '—' : `${v.boib.pct} % · ${v.boib.bleeding} из ${v.boib.examined}`),
    better: 'down',
    max: pctMax,
    ticks: [0, 25, 50, 75, 100],
    deltaUnit: 'п.п.',
  },
  {
    key: 'psr',
    title: 'Скрининг PSR',
    about: 'Наибольший код по шести секстантам, «*» — фуркация, подвижность, рецессия ≥ 3,5 мм или мукогингивальная проблема.',
    unit: '',
    get: (v) => v.psr?.max ?? null,
    format: (v) => (v.psr?.max == null ? '—' : `${v.psr.max}${v.psr.star ? '*' : ''}`),
    better: 'down',
    max: () => 4,
    ticks: [0, 1, 2, 3, 4],
    step: true,
    deltaUnit: '',
  },
  {
    key: 'pd',
    title: 'Средняя глубина зондирования',
    about: 'Среднее по шести точкам всех присутствующих зубов и имплантатов. Пародонтограмма.',
    unit: ' мм',
    get: (v) => v.perio?.meanPd ?? null,
    better: 'down',
    max: mmMax,
    deltaUnit: 'мм',
  },
  {
    key: 'al',
    title: 'Средний уровень прикрепления',
    about: 'Уровень прикрепления = глубина зондирования − десневой край, среднее по всем точкам. Пародонтограмма.',
    unit: ' мм',
    get: (v) => v.perio?.meanAl ?? null,
    better: 'down',
    max: mmMax,
    deltaUnit: 'мм',
  },
  {
    key: 'bop',
    title: 'Кровоточивость при зондировании',
    about: 'BOP: доля точек с кровоточивостью из всех точек пародонтограммы.',
    unit: '%',
    get: (v) => v.perio?.bopPct ?? null,
    better: 'down',
    max: pctMax,
    ticks: [0, 25, 50, 75, 100],
    deltaUnit: 'п.п.',
  },
  {
    key: 'pi',
    title: 'Налёт',
    about: 'Индекс налёта: доля точек с налётом из всех точек пародонтограммы.',
    unit: '%',
    get: (v) => v.perio?.plaquePct ?? null,
    better: 'down',
    max: pctMax,
    ticks: [0, 25, 50, 75, 100],
    deltaUnit: 'п.п.',
  },
  {
    key: 'pockets',
    title: 'Карманы 4 мм и глубже',
    about: 'Число точек с глубиной зондирования 4 мм и больше. Подробно по глубине — в графике карманов.',
    unit: '',
    get: (v) => (v.perio ? v.perio.pd4 + v.perio.pd5 + v.perio.pd6 : null),
    better: 'down',
    max: countMax,
    deltaUnit: '',
  },
  {
    key: 'brushes',
    title: 'Промежутков с ёршиком',
    about: 'Сколько межзубных промежутков получили размер ёршика. Карта ёршиков.',
    unit: '',
    get: (v) => (v.brushes ? v.brushes.reduce((n, b) => n + b.count, 0) : null),
    better: 'up',
    max: countMax,
    deltaUnit: '',
  },
];

export const series = (history: VisitMetrics[], m: Metric) => [...history].reverse().map((v) => ({ v, value: m.get(v) }));

function Delta({ value, metric }: { value: number | null; metric: Metric }) {
  if (value === null) return <span className={s.deltaNone}>первое измерение</span>;
  if (value === 0) return <span className={s.deltaNone}>без изменений</span>;
  const good = metric.better === 'down' ? value < 0 : value > 0;
  return (
    <span className={cx(s.delta, good ? s.good : s.bad)}>
      {value > 0 ? '↑' : '↓'} {comma(Math.abs(value))}
      {metric.deltaUnit ? ` ${metric.deltaUnit}` : ''}
    </span>
  );
}

/** Маленький график динамики в плитке: масштаб по размаху значений, чтобы изменение было видно; последняя точка выделена. */
function Sparkline({ values }: { values: number[] }) {
  const W = 120;
  const H = 36;
  if (values.length < 2) return <svg className={s.spark} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" />;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const x = (i: number) => 4 + ((W - 8) * i) / (values.length - 1);
  const y = (v: number) => 5 + (H - 10) * (1 - (v - lo) / span);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i)} ${y(v)}`).join('');
  const last = values.length - 1;
  return (
    <svg className={s.spark} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <path d={`${d}L${x(last)} ${H}L${x(0)} ${H}Z`} className={s.sparkFill} />
      <path d={d} className={s.sparkLine} />
      <circle cx={x(last)} cy={y(values[last]!)} r={3.2} className={s.sparkDot} />
    </svg>
  );
}

function MetricTile({ metric, history, onOpen }: { metric: Metric; history: VisitMetrics[]; onOpen: () => void }) {
  const pts = series(history, metric).filter((p) => p.value !== null) as Array<{ v: VisitMetrics; value: number }>;
  const last = pts[pts.length - 1];
  if (!last) return null;
  const values = pts.map((p) => p.value);
  return (
    <button type="button" className={s.tile} onClick={onOpen}>
      <span className={s.tileTitle}>{metric.title}</span>
      {/* значение и динамика — одной группой у нижнего края, график справа */}
      <span className={s.tileFoot}>
        <span className={s.tileMain}>
          <span className={s.tileValue}>
            {metric.format ? metric.format(last.v).split(' · ')[0] : comma(last.value)}
            {!metric.format && metric.unit && <small>{metric.unit}</small>}
          </span>
          <Delta value={delta(values)} metric={metric} />
        </span>
        <Sparkline values={values} />
      </span>
    </button>
  );
}

function MetricDetail({ metric, history, onClose }: { metric: Metric | null; history: VisitMetrics[]; onClose: () => void }) {
  const pts = metric ? (series(history, metric).filter((p) => p.value !== null) as Array<{ v: VisitMetrics; value: number }>) : [];
  const values = pts.map((p) => p.value);
  return (
    <Dialog open={metric !== null} onClose={onClose} title={metric?.title ?? ''}>
      {metric && (
        <div className={s.detail}>
          <p className={s.about}>{metric.about}</p>
          <TrendChart
            title="По визитам"
            points={pts.map((p) => ({ date: p.v.date, value: p.value, label: metric.format ? metric.format(p.v).split(' · ')[0]! : `${comma(p.value)}${metric.unit}` }))}
            yMax={metric.max(values)}
            yTicks={metric.ticks ?? [0, Math.round(metric.max(values) / 2), metric.max(values)]}
            format={(v) => comma(v)}
            step={metric.step}
          />
          <table className={s.table}>
            <thead>
              <tr>
                <th>Визит</th>
                <th>Значение</th>
                <th>Изменение</th>
              </tr>
            </thead>
            <tbody>
              {[...pts].reverse().map((p, i, arr) => {
                const prev = arr[i + 1];
                const d = prev ? Math.round((p.value - prev.value) * 10) / 10 : null;
                return (
                  <tr key={p.v.id}>
                    <td>
                      <Link href={`/visits/${p.v.id}`}>{formatDate(p.v.date)}</Link>
                    </td>
                    <td>{metric.format ? metric.format(p.v) : `${comma(p.value)}${metric.unit}`}</td>
                    <td>
                      <Delta value={d} metric={metric} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Dialog>
  );
}

// шкала кодов в палитре клиники: от светло-серого через лаванду к индиго
const PSR_TONE = ['#ededed', 'rgba(167, 140, 213, 0.22)', 'rgba(167, 140, 213, 0.45)', 'rgba(167, 140, 213, 0.75)', '#462c6c'];

/** Коды PSR по секстантам за визиты: строка — секстант, столбец — визит. */
export function PsrStrip({ history }: { history: VisitMetrics[] }) {
  const visits = [...history].reverse().filter((v) => v.psr);
  if (!visits.length) return null;
  return (
    <Card className={s.wide}>
      <CardHeader title="PSR по секстантам" />
      <div className={s.psrGrid} style={{ gridTemplateColumns: `72px repeat(${visits.length}, minmax(44px, 1fr))` }}>
        <span />
        {visits.map((v) => (
          <span key={v.id} className={s.psrHead}>
            {formatDate(v.date).slice(0, 5)}
          </span>
        ))}
        {SEXTANTS.map((sx) => (
          <PsrRow key={sx.id} label={sx.label} codes={visits.map((v) => v.psr!.sextants[sx.id])} />
        ))}
      </div>
    </Card>
  );
}

function PsrRow({ label, codes }: { label: string; codes: Array<number | 'X' | null> }) {
  return (
    <>
      <span className={s.psrLabel}>{label}</span>
      {codes.map((c, i) => (
        <span key={i} className={s.psrCell} style={{ background: typeof c === 'number' ? PSR_TONE[c] : 'var(--color-surface-muted)', color: c === 4 ? '#fff' : undefined }}>
          {c ?? '—'}
        </span>
      ))}
    </>
  );
}

/** Карманы по визитам: столбцы 4, 5 и ≥ 6 мм. */
export function PocketBars({ history }: { history: VisitMetrics[] }) {
  const visits = [...history].reverse().filter((v) => v.perio);
  if (!visits.length) return null;
  const max = Math.max(1, ...visits.map((v) => v.perio!.pd4 + v.perio!.pd5 + v.perio!.pd6));
  return (
    <Card className={s.wide}>
      <CardHeader title="Карманы по визитам" />
      <div className={s.bars}>
        {visits.map((v) => {
          const p = v.perio!;
          const total = p.pd4 + p.pd5 + p.pd6;
          return (
            <div key={v.id} className={s.barCol}>
              <span className={s.barTotal}>{total}</span>
              <div className={s.bar} style={{ height: `${(total / max) * 100}%` }}>
                <span className={s.b6} style={{ flexGrow: p.pd6 }} title={`≥ 6 мм: ${p.pd6}`} />
                <span className={s.b5} style={{ flexGrow: p.pd5 }} title={`5 мм: ${p.pd5}`} />
                <span className={s.b4} style={{ flexGrow: p.pd4 }} title={`4 мм: ${p.pd4}`} />
              </div>
              <span className={s.barDate}>{formatDate(v.date).slice(0, 5)}</span>
            </div>
          );
        })}
      </div>
      <div className={s.legend}>
        <span>
          <i className={s.b4} /> 4 мм
        </span>
        <span>
          <i className={s.b5} /> 5 мм
        </span>
        <span>
          <i className={s.b6} /> ≥ 6 мм
        </span>
      </div>
    </Card>
  );
}

export function BrushSet({ history }: { history: VisitMetrics[] }) {
  const withMap = history.filter((v) => v.brushes && v.brushes.length);
  const current = withMap[0];
  if (!current) return null;
  const { added, removed } = brushChanges(withMap[1]?.brushes ?? null, current.brushes);
  return (
    <Card className={s.wide}>
      <CardHeader title="Ёршики сейчас" meta={<CounterChip>{formatDate(current.date)}</CounterChip>} />
      <ul className={s.brushList}>
        {current.brushes!.map((b) => (
          <li key={b.ref} className={s.brush}>
            <span className={s.brushDot} style={b.color ? { background: b.color } : undefined} aria-hidden="true" />
            <span className={s.brushText}>
              <b>{b.label}</b>
              {b.brand && <span>{b.brand}</span>}
            </span>
            <span className={s.brushCount}>{b.count}</span>
            {added.some((a) => a.ref === b.ref) && <span className={s.badge}>новый</span>}
          </li>
        ))}
      </ul>
      {removed.length > 0 && <p className={s.removed}>Убраны с прошлого визита: {removed.map((b) => `${b.label}${b.brand ? ` ${b.brand}` : ''}`).join(', ')}</p>}
    </Card>
  );
}

export const DOC_STEP: Record<string, { step: string; label: string }> = {
  BRUSH_MAP: { step: 'map', label: 'Карта ёршиков' },
  PSR: { step: 'psr', label: 'Скрининг PSR' },
  PERIO_CHART: { step: 'perio', label: 'Пародонтограмма' },
  HYGIENE_PLAN: { step: 'plan', label: 'Схема гигиены' },
  AFTERCARE: { step: 'aftercare', label: 'Памятка' },
};

/** Лента визитов: строка раскрывается в документы визита с кратким итогом, каждый открывается так, как его заполнил врач. */
function Timeline({ history, clinicians }: { history: VisitMetrics[]; clinicians: Record<string, string | null> }) {
  const [open, setOpen] = useState<string | null>(history[0]?.id ?? null);
  const summary = (v: VisitMetrics, type: string) => {
    if (type === 'BRUSH_MAP') return v.boib?.pct != null ? `BOIB ${v.boib.pct} %, ${v.brushes?.length ?? 0} размеров` : `${v.brushes?.length ?? 0} размеров`;
    if (type === 'PSR') return v.psr ? `наибольший код ${v.psr.max ?? '—'}${v.psr.star ? '*' : ''}` : 'не заполнен';
    if (type === 'PERIO_CHART' && v.perio) return `глубина ${comma(v.perio.meanPd)} мм, BOP ${v.perio.bopPct} %`;
    return '';
  };
  return (
    <Card className={s.timeline}>
      <CardHeader title="Визиты" meta={<CounterChip>{history.length}</CounterChip>} />
      <ol className={s.visits}>
        {history.map((v) => (
          <li key={v.id} className={s.visit}>
            <button type="button" className={s.visitHead} aria-expanded={open === v.id} onClick={() => setOpen(open === v.id ? null : v.id)}>
              <span className={s.visitDate}>{formatDate(v.date)}</span>
              <span className={s.visitMeta}>
                {clinicians[v.id] ?? 'врач не указан'} · {v.status === 'ISSUED' ? 'выдано' : 'черновик'}
              </span>
              <IconChevronRight size={18} className={s.chev} />
            </button>
            {open === v.id && (
              <ul className={s.docs}>
                {v.documents.map((d, i) => (
                  <li key={d + i}>
                    <Link href={`/visits/${v.id}?step=${DOC_STEP[d]!.step}`} className={s.doc}>
                      <span>{DOC_STEP[d]!.label}</span>
                      <span className={s.docSum}>{summary(v, d)}</span>
                      <IconChevronRight size={16} />
                    </Link>
                  </li>
                ))}
                {v.lastIssueId && (
                  <li>
                    <a href={`/api/v1/issues/${v.lastIssueId}/pdf`} className={s.doc} target="_blank" rel="noreferrer">
                      <span>PDF выдачи пациенту</span>
                      <span className={s.docSum}>как получил пациент</span>
                      <IconChevronRight size={16} />
                    </a>
                  </li>
                )}
                {!v.documents.length && <li className={s.docSum}>Документов нет</li>}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </Card>
  );
}

export function PatientDashboard({
  history,
  clinicians,
  nextVisit,
  reportUrl,
}: {
  history: VisitMetrics[];
  clinicians: Record<string, string | null>;
  nextVisit: string | null;
  reportUrl?: string;
}) {
  const [openMetric, setOpenMetric] = useState<Metric | null>(null);
  const tiles = METRICS.filter((m) => history.some((v) => m.get(v) !== null));
  const last = history[0];
  const teeth = history.find((v) => v.teeth)?.teeth ?? null;
  return (
    <div className={s.bento}>
      <Card className={s.hero}>
        <span className={s.tileTitle}>Последний визит</span>
        <span className={s.heroValue}>{last ? formatDate(last.date) : '—'}</span>
        <span className={s.heroMeta}>
          Визитов {history.length}
          {nextVisit ? ` · следующий ${formatDate(nextVisit)}` : ''}
        </span>
        {teeth && (
          <div className={s.teeth}>
            <span>
              <b>{teeth.present}</b> {plural(teeth.present, ['зуб', 'зуба', 'зубов'])}
            </span>
            {teeth.implants > 0 && (
              <span>
                <b>{teeth.implants}</b> {plural(teeth.implants, ['имплантат', 'имплантата', 'имплантатов'])}
              </span>
            )}
            {teeth.crowns > 0 && (
              <span>
                <b>{teeth.crowns}</b> {plural(teeth.crowns, ['коронка', 'коронки', 'коронок'])}
              </span>
            )}
            <span>
              <b>{teeth.missing}</b> отсутствует
            </span>
          </div>
        )}
      </Card>
      {tiles.map((m) => (
        <MetricTile key={m.key} metric={m} history={history} onOpen={() => setOpenMetric(m)} />
      ))}
      <PocketBars history={history} />
      <PsrStrip history={history} />
      <BrushSet history={history} />
      <Timeline history={history} clinicians={clinicians} />
      <NextVisitCard nextVisit={nextVisit} last={last ?? null} />
      <QuickDocs history={history} reportUrl={reportUrl} />
      <MetricDetail metric={openMetric} history={history} onClose={() => setOpenMetric(null)} />
    </div>
  );
}

const DAY = 24 * 3600 * 1000;

/** Следующий визит: дата и сколько осталось; без даты — подсказка назначить его в визите. */
function NextVisitCard({ nextVisit, last }: { nextVisit: string | null; last: VisitMetrics | null }) {
  const days = nextVisit ? Math.ceil((new Date(nextVisit).getTime() - Date.now()) / DAY) : null;
  return (
    <Card className={cx(s.wide, s.bottomCard)}>
      <CardHeader title="Следующий визит" />
      {nextVisit ? (
        <div className={s.bottomMain}>
          <span className={s.heroValue}>{formatDate(nextVisit)}</span>
          <span className={s.heroMeta}>
            {days === null ? '' : days > 0 ? `через ${days} ${plural(days, ['день', 'дня', 'дней'])}` : days === 0 ? 'сегодня' : `просрочен на ${-days} ${plural(-days, ['день', 'дня', 'дней'])}`}
          </span>
        </div>
      ) : (
        <p className={s.about}>Не назначен. Срок повторного визита указывается в шапке визита и попадает в напоминание пациенту.</p>
      )}
      {last && (
        <Link className={s.doc} href={`/visits/${last.id}`}>
          <span>Открыть последний визит</span>
          <span className={s.docSum}>{formatDate(last.date)}</span>
          <IconChevronRight size={16} />
        </Link>
      )}
    </Card>
  );
}

/** Быстрый доступ: свежие документы пациента без раскрытия ленты визитов. */
function QuickDocs({ history, reportUrl }: { history: VisitMetrics[]; reportUrl?: string }) {
  const latest = (type: DocType) => history.find((v) => v.documents.includes(type));
  const issued = history.find((v) => v.lastIssueId);
  const links: Array<{ href: string; label: string; sum: string; external?: boolean }> = [];
  for (const type of ['BRUSH_MAP', 'PERIO_CHART', 'PSR'] as const) {
    const v = latest(type);
    if (v) links.push({ href: `/visits/${v.id}?step=${DOC_STEP[type]!.step}`, label: DOC_STEP[type]!.label, sum: formatDate(v.date) });
  }
  if (issued) links.push({ href: `/api/v1/issues/${issued.lastIssueId}/pdf`, label: 'PDF выдачи пациенту', sum: formatDate(issued.date), external: true });
  // в прототипе отчёт открывается страницей (адрес с #), в приложении — PDF в новой вкладке
  if (reportUrl)
    links.push(
      reportUrl.startsWith('#')
        ? { href: reportUrl.slice(1), label: 'Отчёт по визитам', sum: 'PDF с графиками' }
        : { href: reportUrl, label: 'Отчёт по визитам', sum: 'PDF с графиками', external: true },
    );
  return (
    <Card className={cx(s.wide, s.bottomCard)}>
      <CardHeader title="Последние документы" />
      <ul className={s.docs}>
        {links.map((l) => (
          <li key={l.label}>
            {l.external ? (
              <a href={l.href} className={s.doc} target="_blank" rel="noreferrer">
                <span>{l.label}</span>
                <span className={s.docSum}>{l.sum}</span>
                <IconChevronRight size={16} />
              </a>
            ) : (
              <Link href={l.href} className={s.doc}>
                <span>{l.label}</span>
                <span className={s.docSum}>{l.sum}</span>
                <IconChevronRight size={16} />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
