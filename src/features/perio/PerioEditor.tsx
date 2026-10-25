'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import {
  LOWER,
  UPPER,
  attachment,
  furcationSites,
  probeSequence,
  screenSites,
  setSite,
  summarizePerio,
  toothOf,
  updateTooth,
  type ProbeStep,
  type Side,
} from '@/domain/perio';
import type { FurcationSite, PerioContent } from '@/schemas/perio';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { cx } from '@/ui/cx';
import { Dialog } from '@/ui/Dialog';
import { GlassPanel } from '@/ui/Glass';
import { useTouchLayout } from '@/ui/hooks/useMediaQuery';
import { IconButton } from '@/ui/IconButton';
import { IconRedo, IconTrash, IconUndo } from '@/ui/icons';
import { useHistoryState } from '../brush-map/useHistoryState';
import { SaveIndicator } from '../visit/SaveIndicator';
import { useAutosave } from '../visit/useAutosave';
import { toothShape } from './toothProfile';
import s from './perio.module.css';

/** Ширина колонки точки, px: на компьютере плотнее (вся челюсть без прокрутки), на телефоне крупнее под палец. Таблица и график выровнены по ней. */
const SITE_DESK = 17;
const SITE_TOUCH = 26;
const MID_W = 12;

type Arch = 'upper' | 'lower';
type Highlight = 'bop' | 'plaque' | 'pd5' | 'pd6';

interface Cell {
  tooth: number;
  site: number;
  field: 'gm' | 'pd';
}

const sameCell = (a: Cell | null, b: Cell) => !!a && a.tooth === b.tooth && a.site === b.site && a.field === b.field;

const SIDE_LABEL: Record<Arch, Record<Side, string>> = {
  upper: { buccal: 'Верхняя челюсть, вестибулярно', oral: 'Верхняя челюсть, нёбно' },
  lower: { buccal: 'Нижняя челюсть, вестибулярно', oral: 'Нижняя челюсть, язычно' },
};

const MOBILITY_HINT = ['0 — физиологическая', '1 — до 1 мм горизонтально', '2 — больше 1 мм горизонтально', '3 — вертикальная'];
const FURCATION_HINT = ['0 — вход не определяется', '1 — зонд входит до 3 мм', '2 — больше 3 мм, не насквозь', '3 — сквозная'];

interface Props {
  documentId: string;
  rev: number;
  initial: PerioContent;
  onRemove: () => void;
}

/**
 * Пародонтограмма: шесть точек у каждого зуба — десневой край, глубина зондирования, уровень прикрепления (вычисляется),
 * кровоточивость и налёт; подвижность, фуркации, имплантаты и отсутствующие зубы. График повторяет таблицу:
 * красная линия — край десны, синяя — дно кармана (уровень прикрепления).
 */
export function PerioEditor({ documentId, rev, initial, onRemove }: Props) {
  const history = useHistoryState(initial);
  const content = history.value;
  const save = useAutosave(documentId, rev, content);
  const summary = useMemo(() => summarizePerio(content), [content]);
  const touch = useTouchLayout();
  const siteW = touch ? SITE_TOUCH : SITE_DESK;
  const [active, setActive] = useState<Cell | null>(null);
  const [highlight, setHighlight] = useState<Set<Highlight>>(new Set(['bop', 'pd5', 'pd6']));
  const [note, setNote] = useState<number | null>(null);
  const [noteText, setNoteText] = useState('');
  const sign = useRef(1);
  const pendingOne = useRef<{ cell: Cell; timer: number } | null>(null);
  const cells = useRef(new Map<string, HTMLButtonElement>());
  const sequence = useMemo(() => probeSequence(content), [content]);
  const live = useRef(content);
  live.current = content;

  const apply = useCallback((fn: (c: PerioContent) => PerioContent) => history.apply(() => fn(live.current)), [history]);

  const cellKey = (c: Cell) => `${c.field}-${c.tooth}-${c.site}`;

  const go = useCallback(
    (c: Cell | null) => {
      setActive(c);
      sign.current = 1;
      if (c) {
        const el = cells.current.get(cellKey(c));
        el?.focus({ preventScroll: true });
        el?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
      }
    },
    [],
  );

  const step = useCallback(
    (from: Cell, dir: 1 | -1) => {
      const i = sequence.findIndex((x: ProbeStep) => x.tooth === from.tooth && x.site === from.site && x.field === from.field);
      const next = sequence[i + dir];
      go(next ? { tooth: next.tooth, site: next.site, field: next.field } : null);
    },
    [sequence, go],
  );

  const commit = (c: Cell, value: number) => {
    const v = c.field === 'pd' ? Math.max(0, Math.min(99, value)) : Math.max(-99, Math.min(99, value));
    apply((x) => setSite(x, c.tooth, c.field, c.site, v));
  };

  const clearPending = () => {
    if (pendingOne.current) window.clearTimeout(pendingOne.current.timer);
    pendingOne.current = null;
  };

  /** Ввод с клавиатуры или экранных кнопок: цифра — значение и переход дальше; «1» ждёт вторую цифру (10–19). */
  const press = (key: string) => {
    const c = active;
    if (!c) return;
    if (key === '-') {
      if (c.field === 'gm') sign.current = -sign.current;
      return;
    }
    if (/^\d$/.test(key)) {
      const d = Number(key);
      const p = pendingOne.current;
      if (p && sameCell(p.cell, c)) {
        clearPending();
        commit(c, sign.current * (10 + d));
        step(c, 1);
        return;
      }
      clearPending();
      commit(c, sign.current * d);
      if (d === 1) {
        const at = c;
        pendingOne.current = { cell: at, timer: window.setTimeout(() => ((pendingOne.current = null), step(at, 1)), 650) };
        return;
      }
      step(c, 1);
      return;
    }
    if (key === 'Backspace' || key === 'Delete') {
      clearPending();
      commit(c, 0);
      return;
    }
    if (key === 'Enter' || key === 'Tab' || key === 'next') {
      clearPending();
      step(c, 1);
      return;
    }
    if (key === 'prev') {
      clearPending();
      step(c, -1);
      return;
    }
    if (key === 'b') apply((x) => setSite(x, c.tooth, 'bop', c.site, !toothOf(x, c.tooth).bop[c.site]));
    if (key === 'p') apply((x) => setSite(x, c.tooth, 'plaque', c.site, !toothOf(x, c.tooth).plaque[c.site]));
  };

  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const map: Record<string, string> = { ArrowRight: 'next', ArrowLeft: 'prev', и: 'b', з: 'p', B: 'b', P: 'p' };
    const key = e.key === 'Tab' && e.shiftKey ? 'prev' : (map[e.key] ?? e.key);
    if (/^\d$/.test(key) || ['-', 'Backspace', 'Delete', 'Enter', 'Tab', 'next', 'prev', 'b', 'p'].includes(key)) {
      e.preventDefault();
      press(key);
    }
    if (e.key === 'Escape') go(null);
  };

  useEffect(() => () => clearPending(), []);

  const toggleHighlight = (h: Highlight) =>
    setHighlight((cur) => {
      const next = new Set(cur);
      if (next.has(h)) next.delete(h);
      else next.add(h);
      return next;
    });

  const block = (arch: Arch, side: Side) => {
    const teeth = arch === 'upper' ? UPPER : LOWER;
    // ряды строятся от графика наружу: у верхних вестибулярных и нижних язычных таблица над графиком
    const above = (arch === 'upper') === (side === 'buccal');
    const rows = [
      side === 'buccal' && 'tooth',
      side === 'buccal' && 'mobility',
      side === 'buccal' && 'implant',
      'furcation',
      'bop',
      'plaque',
      'gm',
      'pd',
      'al',
      side === 'oral' && 'note',
    ].filter(Boolean) as Array<'tooth' | 'mobility' | 'implant' | 'furcation' | 'bop' | 'plaque' | 'gm' | 'pd' | 'al' | 'note'>;
    const ordered = above ? rows : [...rows].reverse();
    const table = (
      <div className={s.rows}>
        {ordered.map((row) => (
          <div key={row} className={cx(s.row, (row === 'gm' || row === 'pd' || row === 'al') && s.rowNum)}>
            <span className={s.label}>{ROW_LABEL[row]}</span>
            {teeth.map((t, i) => (
              <Fragment key={t}>
                {i === 8 && <span className={s.mid} aria-hidden="true" />}
                {renderCell(row, t, side)}
              </Fragment>
            ))}
          </div>
        ))}
      </div>
    );
    return (
      <section key={`${arch}-${side}`} className={s.block} aria-label={SIDE_LABEL[arch][side]}>
        <h3 className={s.blockTitle}>{SIDE_LABEL[arch][side]}</h3>
        <div className={s.scroll}>
          <div className={s.sheet}>
            {above && table}
            <div className={s.chartRow}>
              <span className={s.label} aria-hidden="true" />
              <Chart arch={arch} side={side} content={content} highlight={highlight} active={active} siteW={siteW} />
            </div>
            {!above && table}
          </div>
        </div>
      </section>
    );
  };

  const renderCell = (row: string, t: number, side: Side) => {
    const tooth = toothOf(content, t);
    const off = tooth.missing;
    const sites = screenSites(t, side);
    const base = cx(s.cell, off && s.off);
    switch (row) {
      case 'tooth':
        return (
          <button
            key={row}
            type="button"
            className={cx(s.cell, s.number, off && s.numberOff)}
            aria-pressed={!off}
            aria-label={`Зуб ${t}: ${off ? 'отсутствует' : 'есть'}`}
            onClick={() => apply((x) => updateTooth(x, t, (z) => ({ ...z, missing: !z.missing })))}
          >
            {t}
          </button>
        );
      case 'mobility':
        return (
          <button
            key={row}
            type="button"
            className={cx(base, s.single, tooth.mobility > 0 && s.marked)}
            disabled={off}
            title={MOBILITY_HINT[tooth.mobility]}
            aria-label={`Подвижность ${t}: ${tooth.mobility}`}
            onClick={() => apply((x) => updateTooth(x, t, (z) => ({ ...z, mobility: (z.mobility + 1) % 4 })))}
          >
            {tooth.mobility}
          </button>
        );
      case 'implant':
        return (
          <button
            key={row}
            type="button"
            className={cx(base, s.single, tooth.implant && s.implantOn)}
            disabled={off}
            aria-pressed={tooth.implant}
            aria-label={`Имплантат ${t}`}
            onClick={() => apply((x) => updateTooth(x, t, (z) => ({ ...z, implant: !z.implant })))}
          >
            {tooth.implant ? 'И' : ''}
          </button>
        );
      case 'furcation': {
        const here = furcationSites(t).filter((f) => (side === 'buccal' ? f === 'b' : f !== 'b'));
        const left = (f: FurcationSite) => (f === 'do') === tooth_leftDistal(t);
        return (
          <span key={row} className={base}>
            {!off &&
              !tooth.implant &&
              here.map((f) => {
                const g = tooth.furcation[f] ?? 0;
                return (
                  <button
                    key={f}
                    type="button"
                    className={cx(s.furc, here.length === 1 ? s.furcMid : left(f) ? s.furcLeft : s.furcRight)}
                    data-grade={g}
                    title={`Фуркация ${t} ${FURC_NAME[f]}: ${FURCATION_HINT[g]}`}
                    aria-label={`Фуркация ${t} ${FURC_NAME[f]}: степень ${g}`}
                    onClick={() => apply((x) => updateTooth(x, t, (z) => ({ ...z, furcation: { ...z.furcation, [f]: ((z.furcation[f] ?? 0) + 1) % 4 } })))}
                  >
                    <FurcIcon grade={g} />
                  </button>
                );
              })}
          </span>
        );
      }
      case 'bop':
      case 'plaque':
        return (
          <span key={row} className={base}>
            {sites.map((i) => {
              const on = row === 'bop' ? tooth.bop[i] : tooth.plaque[i];
              return (
                <button
                  key={i}
                  type="button"
                  className={cx(s.dot, row === 'bop' ? s.dotBop : s.dotPlaque)}
                  aria-pressed={on}
                  disabled={off}
                  aria-label={`${row === 'bop' ? 'Кровоточивость' : 'Налёт'} ${t}, точка ${SITE_NAME[i]}`}
                  onClick={() => apply((x) => setSite(x, t, row, i, !on))}
                />
              );
            })}
          </span>
        );
      case 'gm':
      case 'pd':
        return (
          <span key={row} className={base}>
            {sites.map((i) => {
              const c: Cell = { tooth: t, site: i, field: row };
              const v = tooth[row][i]!;
              const pd = tooth.pd[i]!;
              return (
                <button
                  key={i}
                  ref={(el) => {
                    if (el) cells.current.set(cellKey(c), el);
                    else cells.current.delete(cellKey(c));
                  }}
                  type="button"
                  className={cx(s.num, sameCell(active, c) && s.numActive, row === 'pd' && pd >= 6 ? s.deep6 : row === 'pd' && pd >= 4 ? s.deep4 : undefined, row === 'gm' && v < 0 && s.recession)}
                  disabled={off}
                  inputMode="none"
                  aria-label={`${row === 'gm' ? 'Десневой край' : 'Глубина зондирования'} ${t}, точка ${SITE_NAME[i]}: ${v} мм`}
                  onClick={() => go(c)}
                  onFocus={() => !sameCell(active, c) && setActive(c)}
                  onKeyDown={onKey}
                >
                  {v}
                </button>
              );
            })}
          </span>
        );
      case 'al':
        return (
          <span key={row} className={cx(base, s.computed)}>
            {sites.map((i) => {
              const al = attachment(tooth.pd[i]!, tooth.gm[i]!);
              return (
                <span key={i} className={cx(s.numStatic, al >= 5 && s.deep6, al >= 3 && al < 5 && s.deep4)}>
                  {off ? '' : al}
                </span>
              );
            })}
          </span>
        );
      case 'note':
        return (
          <button
            key={row}
            type="button"
            className={cx(base, s.noteCell, tooth.note && s.noteOn)}
            disabled={off}
            title={tooth.note || 'Примечание'}
            aria-label={`Примечание ${t}${tooth.note ? `: ${tooth.note}` : ''}`}
            onClick={() => {
              setNote(t);
              setNoteText(tooth.note);
            }}
          >
            {tooth.note ? '•' : '+'}
          </button>
        );
      default:
        return null;
    }
  };

  return (
    <div className={s.wrap} style={{ '--site': `${siteW}px` } as CSSProperties}>
      <div className={s.summary}>
        <Card className={s.stat}>
          <span className={s.statLabel}>Ср. глубина зондирования</span>
          <span className={s.statValue}>
            {fmt(summary.meanPd)}
            <small> мм</small>
          </span>
        </Card>
        <Card className={s.stat}>
          <span className={s.statLabel}>Ср. уровень прикрепления</span>
          <span className={s.statValue}>
            {fmt(summary.meanAl)}
            <small> мм</small>
          </span>
        </Card>
        <Card className={s.stat}>
          <span className={s.statLabel}>Кровоточивость, BOP</span>
          <span className={s.statValue}>
            {summary.bopPct}
            <small> %</small>
          </span>
        </Card>
        <Card className={s.stat}>
          <span className={s.statLabel}>Налёт, PI</span>
          <span className={s.statValue}>
            {summary.plaquePct}
            <small> %</small>
          </span>
        </Card>
      </div>
      <p className={s.counts}>
        Зубов и имплантатов {summary.teeth}, точек {summary.sites} · карманы 4 мм: {summary.pd4} · 5 мм: {summary.pd5} · ≥ 6 мм: {summary.pd6}
      </p>

      <div className={s.toolbar}>
        <div className={s.chips} role="group" aria-label="Подсветка на графике">
          {(
            [
              ['bop', 'Кровоточивость'],
              ['plaque', 'Налёт'],
              ['pd5', '5 мм'],
              ['pd6', '≥ 6 мм'],
            ] as Array<[Highlight, string]>
          ).map(([h, label]) => (
            <button key={h} type="button" className={cx(s.chip, s[`chip_${h}`])} aria-pressed={highlight.has(h)} onClick={() => toggleHighlight(h)}>
              {label}
            </button>
          ))}
        </div>
        <GlassPanel className={s.tools} aria-label="Правка">
          <IconButton label="Отменить" icon={<IconUndo size={20} />} variant="ghost" size={40} disabled={!history.canUndo} onClick={history.undo} />
          <IconButton label="Повторить" icon={<IconRedo size={20} />} variant="ghost" size={40} disabled={!history.canRedo} onClick={history.redo} />
        </GlassPanel>
      </div>

      <p className={s.hint}>
        Нажмите на ячейку десневого края и вводите цифры подряд: после каждой значение переходит дальше — десневой край, затем глубина в той же точке, по порядку
        Бернского университета. Минус перед цифрой — рецессия. {touch ? '' : 'B — кровоточивость, P — налёт в текущей точке, стрелки — назад и вперёд.'} Номер
        зуба — отсутствует или есть.
      </p>

      {block('upper', 'buccal')}
      {block('upper', 'oral')}
      {block('lower', 'oral')}
      {block('lower', 'buccal')}

      <div className={s.footer}>
        <SaveIndicator state={save} />
        <Button variant="ghost" size="sm" leading={<IconTrash size={18} />} onClick={onRemove}>
          Удалить пародонтограмму
        </Button>
      </div>

      {touch && active && (
        <div className={s.keypad} role="group" aria-label="Ввод значения">
          <span className={s.keypadInfo}>
            {active.field === 'gm' ? 'Край десны' : 'Глубина'} · {active.tooth}, {SITE_NAME[active.site]}
          </span>
          <div className={s.keys}>
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '-', '0', 'Backspace'].map((k) => (
              <button
                key={k}
                type="button"
                className={s.key}
                disabled={k === '-' && active.field === 'pd'}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => press(k)}
                aria-label={k === 'Backspace' ? 'Стереть' : k === '-' ? 'Минус' : k}
              >
                {k === 'Backspace' ? '⌫' : k === '-' ? '−' : k}
              </button>
            ))}
          </div>
          <div className={s.keyRow}>
            <button type="button" className={s.keyWide} onPointerDown={(e) => e.preventDefault()} onClick={() => press('prev')}>
              Назад
            </button>
            <button type="button" className={s.keyWide} onPointerDown={(e) => e.preventDefault()} onClick={() => press('b')}>
              Кровь
            </button>
            <button type="button" className={s.keyWide} onPointerDown={(e) => e.preventDefault()} onClick={() => press('p')}>
              Налёт
            </button>
            <button type="button" className={cx(s.keyWide, s.keyGo)} onPointerDown={(e) => e.preventDefault()} onClick={() => press('next')}>
              Дальше
            </button>
            <button type="button" className={s.keyWide} onClick={() => go(null)}>
              Готово
            </button>
          </div>
        </div>
      )}

      <Dialog
        open={note !== null}
        onClose={() => setNote(null)}
        title={note ? `Примечание, зуб ${note}` : ''}
        actions={
          <>
            <Button variant="secondary" onClick={() => setNote(null)}>
              Отмена
            </Button>
            <Button
              onClick={() => {
                if (note) apply((x) => updateTooth(x, note, (z) => ({ ...z, note: noteText.trim().slice(0, 200) })));
                setNote(null);
              }}
            >
              Сохранить
            </Button>
          </>
        }
      >
        <textarea className={s.noteInput} value={noteText} maxLength={200} rows={3} onChange={(e) => setNoteText(e.target.value)} autoFocus />
      </Dialog>
    </div>
  );
}

const ROW_LABEL: Record<string, string> = {
  tooth: 'Зуб',
  mobility: 'Подвижность',
  implant: 'Имплантат',
  furcation: 'Фуркация',
  bop: 'Кровоточивость',
  plaque: 'Налёт',
  gm: 'Десневой край',
  pd: 'Глубина зондирования',
  al: 'Уровень прикрепления',
  note: 'Примечание',
};

const SITE_NAME = ['дистально-вестибулярная', 'вестибулярная', 'мезиально-вестибулярная', 'дистально-оральная', 'оральная', 'мезиально-оральная'];
const FURC_NAME: Record<FurcationSite, string> = { b: 'вестибулярно', o: 'язычно', mo: 'мезио-нёбно', do: 'дисто-нёбно' };

/** У 1-го и 4-го квадрантов дистальная сторона слева. */
const tooth_leftDistal = (t: number) => [1, 4].includes(Math.floor(t / 10));

const fmt = (v: number) => v.toFixed(1).replace('.', ',');

function FurcIcon({ grade }: { grade: number }) {
  // степень — заполнение круга: пусто, четверть, половина, целиком
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
      {grade === 1 && <path d="M7 7V1.5A5.5 5.5 0 0 1 12.5 7Z" fill="currentColor" />}
      {grade === 2 && <path d="M7 1.5A5.5 5.5 0 0 1 7 12.5Z" fill="currentColor" />}
      {grade === 3 && <circle cx="7" cy="7" r="5.5" fill="currentColor" />}
    </svg>
  );
}

/** График стороны челюсти: силуэты зубов, сетка через 1 мм, лавандовая линия — край десны, индиго — дно кармана. */
function Chart({
  arch,
  side,
  content,
  highlight,
  active,
  siteW,
}: {
  arch: Arch;
  side: Side;
  content: PerioContent;
  highlight: Set<Highlight>;
  active: Cell | null;
  siteW: number;
}) {
  const teeth = arch === 'upper' ? UPPER : LOWER;
  const SITE_W = siteW;
  const COL_W = siteW * 3;
  // силуэт масштабируется под ширину колонки: самый широкий моляр (11 мм) занимает её почти целиком
  const MM = COL_W / 12;
  const width = COL_W * 16 + MID_W;
  const root = 19;
  const crown = 12;
  const height = (root + crown) * MM;
  // верх: корни вверху, коронки внизу; низ — наоборот. y — расстояние от шейки к коронке (+) или к верхушке (−)
  const cej = arch === 'upper' ? root * MM : crown * MM;
  const dir = arch === 'upper' ? 1 : -1;
  const yAt = (mm: number) => cej + dir * mm * MM;
  const colX = (i: number) => i * COL_W + (i >= 8 ? MID_W : 0);

  const segments: Array<Array<{ x: number; gm: number; bottom: number; t: number; site: number }>> = [];
  let current: (typeof segments)[number] = [];
  teeth.forEach((t, i) => {
    const tooth = toothOf(content, t);
    if (tooth.missing || i === 8) {
      if (current.length) segments.push(current);
      current = [];
    }
    if (tooth.missing) return;
    screenSites(t, side).forEach((site, k) => {
      const x = colX(i) + SITE_W * (k + 0.5);
      const gm = tooth.gm[site]!;
      current.push({ x, gm: yAt(gm), bottom: yAt(gm - tooth.pd[site]!), t, site });
    });
  });
  if (current.length) segments.push(current);

  const grid: number[] = [];
  for (let mm = -root + 1; mm < crown; mm++) grid.push(yAt(mm));

  return (
    <svg className={s.chart} width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`График: ${SIDE_LABEL[arch][side]}`}>
      <defs>
        {/* эмаль светлеет к режущему краю, корень — к середине: объём без лишних линий */}
        <linearGradient id="perio-crown" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ededed" />
          <stop offset="0.45" stopColor="#ffffff" />
        </linearGradient>
        <linearGradient id="perio-root" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ededed" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ededed" />
        </linearGradient>
        <linearGradient id="perio-metal" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ededed" />
          <stop offset="0.4" stopColor="#ffffff" />
          <stop offset="1" stopColor="#ededed" />
        </linearGradient>
      </defs>
      {grid.map((y, i) => (
        <line key={i} x1={0} x2={width} y1={y} y2={y} className={s.grid} />
      ))}
      {teeth.map((t, i) => {
        const tooth = toothOf(content, t);
        if (tooth.missing) return null;
        const shape = toothShape(t, side, tooth.implant);
        const tf = `translate(${colX(i) + COL_W / 2} ${cej}) scale(${MM} ${dir * MM})`;
        return (
          <g key={t} transform={tf} className={cx(s.tooth, tooth.implant && s.implant)}>
            {shape.roots.map((d, k) => (
              <path key={k} d={d} />
            ))}
            {shape.threads && <path d={shape.threads} className={s.threads} />}
            <path d={shape.crown} className={s.crown} />
            <ellipse className={s.gloss} cx={-shape.dims.crownW * 0.2} cy={shape.dims.crownH * 0.6} rx={shape.dims.crownW * 0.08} ry={shape.dims.crownH * 0.2} />
          </g>
        );
      })}
      {segments.map((seg, k) => (
        <g key={k}>
          <polygon className={s.pocket} points={[...seg.map((p) => `${p.x},${p.gm}`), ...[...seg].reverse().map((p) => `${p.x},${p.bottom}`)].join(' ')} />
          <polyline className={s.lineGm} points={seg.map((p) => `${p.x},${p.gm}`).join(' ')} />
          <polyline className={s.lineAl} points={seg.map((p) => `${p.x},${p.bottom}`).join(' ')} />
        </g>
      ))}
      {segments.flat().map((p) => {
        const tooth = toothOf(content, p.t);
        const pd = tooth.pd[p.site]!;
        const marks = [];
        if (highlight.has('bop') && tooth.bop[p.site]) marks.push(<circle key="b" cx={p.x} cy={p.gm} r={3.4} className={s.markBop} />);
        if (highlight.has('plaque') && tooth.plaque[p.site]) marks.push(<circle key="p" cx={p.x} cy={yAt(3)} r={3} className={s.markPlaque} />);
        if (highlight.has('pd5') && pd === 5) marks.push(<circle key="5" cx={p.x} cy={p.bottom} r={3.6} className={s.mark5} />);
        if (highlight.has('pd6') && pd >= 6) marks.push(<circle key="6" cx={p.x} cy={p.bottom} r={3.6} className={s.mark6} />);
        if (active && active.tooth === p.t && active.site === p.site) marks.push(<circle key="a" cx={p.x} cy={active.field === 'gm' ? p.gm : p.bottom} r={5.5} className={s.markActive} />);
        return marks.length ? <g key={`${p.t}-${p.site}`}>{marks}</g> : null;
      })}
    </svg>
  );
}
