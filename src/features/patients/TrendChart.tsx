'use client';

import { useId, useState } from 'react';
import { formatDate } from '@/ui/format';
import s from './patients.module.css';

export interface TrendPoint {
  date: string;
  value: number;
  label: string;
}

interface Props {
  title: string;
  points: TrendPoint[];
  yMax: number;
  yTicks: number[];
  format: (v: number) => string;
  /** Ступенчатая линия для кодов (PSR), прямая — для процентов. */
  step?: boolean;
}

const W = 560;
const H = 200;
const PAD = { l: 40, r: 20, t: 16, b: 30 };

/** Однорядный график динамики: тонкая линия, точки 8 px, подпись последнего значения, подсказка при наведении. */
export function TrendChart({ title, points, yMax, yTicks, format, step }: Props) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  if (points.length === 0) return null;
  const x = (i: number) => (points.length === 1 ? (PAD.l + W - PAD.r) / 2 : PAD.l + ((W - PAD.l - PAD.r) * i) / (points.length - 1));
  const y = (v: number) => PAD.t + (H - PAD.t - PAD.b) * (1 - v / yMax);
  const path = points
    .map((p, i) => {
      if (i === 0) return `M${x(i)} ${y(p.value)}`;
      return step ? `H${x(i)}V${y(p.value)}` : `L${x(i)} ${y(p.value)}`;
    })
    .join('');
  const last = points.length - 1;
  const h = hover ?? null;

  return (
    <figure className={s.chart} aria-labelledby={`${id}-t`}>
      <figcaption id={`${id}-t`} className={s.chartTitle}>
        {title}
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className={s.chartSvg}
        role="img"
        aria-label={`${title}: ${points.map((p) => `${formatDate(p.date)} ${p.label}`).join(', ')}`}
        onPointerLeave={() => setHover(null)}
      >
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--color-separator)" strokeWidth={1} />
            <text x={PAD.l - 10} y={y(t) + 5} textAnchor="end" className={s.axis}>
              {format(t)}
            </text>
          </g>
        ))}
        {points.length > 1 && (
          <path d={path} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        )}
        {h !== null && <line x1={x(h)} x2={x(h)} y1={PAD.t} y2={H - PAD.b} stroke="var(--color-border-strong)" strokeWidth={1} />}
        {points.map((p, i) => (
          <g key={p.date + i}>
            <circle cx={x(i)} cy={y(p.value)} r={i === last || i === h ? 5 : 4} fill="var(--accent)" stroke="var(--color-surface)" strokeWidth={2} />
            <rect
              x={x(i) - 22}
              y={PAD.t}
              width={44}
              height={H - PAD.t - PAD.b}
              fill="transparent"
              onPointerEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              tabIndex={0}
              aria-label={`${formatDate(p.date)}: ${p.label}`}
            />
          </g>
        ))}
        <text x={x(last)} y={y(points[last]!.value) - 12} textAnchor={points.length === 1 ? 'middle' : 'end'} className={s.direct}>
          {points[last]!.label}
        </text>
        {[0, last].filter((v, i, a) => a.indexOf(v) === i).map((i) => (
          <text key={i} x={x(i)} y={H - 8} textAnchor={points.length === 1 ? 'middle' : i === 0 ? 'start' : 'end'} className={s.axis}>
            {formatDate(points[i]!.date)}
          </text>
        ))}
      </svg>
      {h !== null && (
        <div className={s.tip} style={{ left: `${(x(h) / W) * 100}%` }} role="status">
          <span className={s.tipValue}>{points[h]!.label}</span>
          <span>{formatDate(points[h]!.date)}</span>
        </div>
      )}
      <table className="visually-hidden">
        <caption>{title}</caption>
        <tbody>
          {points.map((p, i) => (
            <tr key={i}>
              <td>{formatDate(p.date)}</td>
              <td>{p.label}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
