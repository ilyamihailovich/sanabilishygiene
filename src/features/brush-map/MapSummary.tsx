import { countLabel } from '@/content/plural';
import { ui } from '@/content/ui.ru';
import type { BoibResult, SizeUsage } from '@/domain/brushMap';
import { Card, CardHeader } from '@/ui/Card';
import { CounterChip } from '@/ui/Chip';
import { formatDate } from '@/ui/format';
import { boibTone, toneStyle } from '@/ui/tone';
import s from './editor.module.css';

export interface SizeLegend {
  ref: string;
  label: string;
  meta: string;
  color: string | null;
  count: number;
}

export function legendFromUsage(usage: SizeUsage[], lookup: (id: string) => { label: string; meta: string; color: string } | null): SizeLegend[] {
  return usage.map((u) => {
    const c = u.catalogId ? lookup(u.catalogId) : null;
    return {
      ref: u.ref,
      label: c?.label ?? u.freeText ?? '—',
      meta: c?.meta ?? ui.map.freeText,
      color: c?.color ?? u.color ?? null,
      count: u.count,
    };
  });
}

export function NeedCard({ legend, onPick, picked }: { legend: SizeLegend[]; onPick?: (ref: string) => void; picked?: string | null }) {
  return (
    <Card>
      <CardHeader title={ui.map.need} meta={legend.length ? <CounterChip>{countLabel(legend.length, ui.map.sizes)}</CounterChip> : undefined} />
      {legend.length ? (
        <ul className={s.needList}>
          {legend.map((l) => {
            const content = (
              <>
                <span className={s.needDot} style={l.color ? { background: l.color } : undefined} data-free={l.color ? undefined : 'true'} aria-hidden="true" />
                <span className={s.needText}>
                  <span className={s.needLabel}>{l.label}</span>
                  <span className={s.needMeta}>{l.meta}</span>
                </span>
                <span className={s.needCount}>{countLabel(l.count, ui.map.interspaces)}</span>
              </>
            );
            return (
              <li key={l.ref}>
                {onPick ? (
                  <button type="button" className={s.need} aria-pressed={picked === l.ref} onClick={() => onPick(l.ref)}>
                    {content}
                  </button>
                ) : (
                  <div className={s.need}>{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={s.muted}>{ui.map.needEmpty}</p>
      )}
    </Card>
  );
}

export function BoibCard({ boib, previous }: { boib: BoibResult; previous: (BoibResult & { date: string }) | null }) {
  const incomparable = previous && boib.examined && Math.abs(previous.examined - boib.examined) > boib.examined / 3;
  return (
    <Card style={boib.pct === null ? undefined : toneStyle(boibTone(boib.pct))}>
      <CardHeader title="BOIB" meta={boib.examined ? <CounterChip>{`${boib.examined} ${ui.map.boibExamined}`}</CounterChip> : undefined} />
      {boib.pct === null ? (
        <p className={s.muted}>{ui.map.boibNone}</p>
      ) : (
        <>
          <div className={s.index}>
            <span className={s.indexValue}>
              {boib.pct}
              {'\u202F'}%
            </span>
            <span className={s.indexMeta}>
              {boib.bleeding} из {boib.examined}
            </span>
          </div>
          {(previous || incomparable) && (
            <p className={s.indexNote}>
              {previous && (
                <span className={s.indexPrev}>
                  <span>Прошлый визит {formatDate(previous.date)}</span>
                  <span>{previous.pct} %</span>
                </span>
              )}
              {previous && incomparable && <br />}
              {incomparable && ui.map.incomparable}
            </p>
          )}
        </>
      )}
    </Card>
  );
}
