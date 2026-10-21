import { countLabel } from '@/content/plural';
import { ui } from '@/content/ui.ru';
import type { BoibResult, SizeUsage } from '@/domain/brushMap';
import { Card, CardHeader } from '@/ui/Card';
import { CounterChip } from '@/ui/Chip';
import { formatDate } from '@/ui/format';
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
      color: c?.color ?? null,
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
  const trend =
    previous && boib.pct !== null
      ? boib.pct < previous.pct!
        ? ui.map.trendDown
        : boib.pct > previous.pct!
          ? ui.map.trendUp
          : ui.map.trendSame
      : null;
  const incomparable = previous && boib.examined && Math.abs(previous.examined - boib.examined) > boib.examined / 3;
  return (
    <Card>
      <CardHeader title="BOIB" meta={boib.examined ? <CounterChip>{`${boib.examined} ${ui.map.boibExamined}`}</CounterChip> : undefined} />
      {boib.pct === null ? (
        <p className={s.muted}>{ui.map.boibNone}</p>
      ) : (
        <div className={s.index}>
          <span className={s.indexValue}>{boib.pct} %</span>
          <span className={s.indexMeta}>
            {boib.bleeding} из {boib.examined}
            {previous && (
              <>
                <br />
                {ui.map.previous} {formatDate(previous.date)}: {previous.pct} %{trend ? `, ${trend}` : ''}
              </>
            )}
            {incomparable && (
              <>
                <br />
                {ui.map.incomparable}
              </>
            )}
          </span>
        </div>
      )}
    </Card>
  );
}
