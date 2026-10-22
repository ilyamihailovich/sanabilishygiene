'use client';

import { useMemo, useRef, useState } from 'react';
import { ui } from '@/content/ui.ru';
import { SEXTANT_TEETH, summarizePsr } from '@/domain/psr';
import { SEXTANTS, type PsrCode, type PsrContent } from '@/schemas/psr';
import { Button } from '@/ui/Button';
import { Card, CardHeader } from '@/ui/Card';
import { CounterChip } from '@/ui/Chip';
import { cx } from '@/ui/cx';
import { useTouchLayout } from '@/ui/hooks/useMediaQuery';
import { IconTrash } from '@/ui/icons';
import { Notice } from '@/ui/Notice';
import { ToggleGroup } from '@/ui/ToggleGroup';
import { psrTone, toneStyle } from '@/ui/tone';
import { SaveIndicator } from '../visit/SaveIndicator';
import { useAutosave } from '../visit/useAutosave';
import s from './psr.module.css';

const CODES: Array<{ value: string; code: PsrCode }> = [
  { value: '0', code: 0 },
  { value: '1', code: 1 },
  { value: '2', code: 2 },
  { value: '3', code: 3 },
  { value: '4', code: 4 },
  { value: 'X', code: 'X' },
];

/** Расшифровка кодов для сотрудника: под выбранным кодом, чтобы не держать шкалу в голове. */
const MEANING: Record<string, string> = {
  '0': 'Цветная зона видна, без кровоточивости и камня',
  '1': 'Кровоточивость при зондировании',
  '2': 'Камень или нависающие края реставраций',
  '3': 'Карман 3,5–5,5 мм: цветная зона видна частично',
  '4': 'Карман больше 5,5 мм: цветная зона не видна',
  X: 'Секстант исключён: меньше двух зубов',
};

const PLACE: Record<(typeof SEXTANTS)[number]['id'], string> = {
  S1: 'верхний правый',
  S2: 'верхний передний',
  S3: 'верхний левый',
  S4: 'нижний правый',
  S5: 'нижний передний',
  S6: 'нижний левый',
};

interface Props {
  documentId: string;
  rev: number;
  initial: PsrContent;
  texts: Array<{ code: string; staffText: string; approved: boolean }>;
  furcationTeeth: number[];
  onRemove: () => void;
}

export function PsrEditor({ documentId, rev, initial, texts, furcationTeeth, onRemove }: Props) {
  const [content, setContent] = useState(initial);
  const touch = useTouchLayout();
  const cards = useRef(new Map<string, HTMLDivElement>());
  const save = useAutosave(documentId, rev, content);
  const summary = useMemo(() => summarizePsr(content), [content]);
  const text = (code: string) => texts.find((t) => t.code === code);

  const setSextant = (id: (typeof SEXTANTS)[number]['id'], patch: Partial<PsrContent['sextants']['S1']>) =>
    setContent((c) => ({ ...c, sextants: { ...c.sextants, [id]: { ...c.sextants[id], ...patch } } }));

  // На телефоне после выбора кода экран переходит к следующему незаполненному секстанту
  const advance = (from: (typeof SEXTANTS)[number]['id']) => {
    if (!touch) return;
    const order = SEXTANTS.map((x) => x.id);
    const next = order.slice(order.indexOf(from) + 1).find((id) => content.sextants[id].code === null);
    const el = next ? cards.current.get(next) : null;
    if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 250);
  };

  const renderSextant = (sx: (typeof SEXTANTS)[number]) => {
    const value = content.sextants[sx.id];
    const furcation = SEXTANT_TEETH[sx.id].some((t) => furcationTeeth.includes(t));
    const meaning = value.code === null ? null : MEANING[String(value.code)];
    return (
      <Card
        key={sx.id}
        ref={(n: HTMLDivElement | null) => {
          if (n) cards.current.set(sx.id, n);
          else cards.current.delete(sx.id);
        }}
        className={cx(s.sextant, value.code === null && s.empty)}
        padding={20}
        style={typeof value.code === 'number' ? toneStyle(psrTone(value.code)) : undefined}
      >
        <div className={s.sextantHead}>
          <span className={s.range}>{sx.label}</span>
          <span className={s.place}>{PLACE[sx.id]}</span>
        </div>
        <div className={s.codes}>
          <ToggleGroup
            label={`${ui.psr.code}, ${sx.label}`}
            deselectable
            size={44}
            value={value.code === null ? null : String(value.code)}
            onChange={(v) => {
              setSextant(sx.id, { code: v === null ? null : (CODES.find((c) => c.value === v)?.code ?? null) });
              if (v !== null && value.code === null) advance(sx.id);
            }}
            options={CODES.map((c) => ({
              value: c.value,
              label: c.value === 'X' ? ui.psr.excludedHint : `${ui.psr.code} ${c.value}`,
              content: <span className={s.code}>{c.value}</span>,
            }))}
          />
        </div>
        <span className={cx(s.meaning, !meaning && s.meaningEmpty)}>{meaning ?? 'Выберите наибольший код в секстанте'}</span>
        <button
          type="button"
          role="switch"
          aria-checked={value.asterisk}
          className={s.star}
          disabled={value.code === 'X'}
          onClick={() => setSextant(sx.id, { asterisk: !value.asterisk })}
        >
          <span className={s.starMark} aria-hidden="true">
            *
          </span>
          <span>
            <span className={s.starTitle}>Доп. признак</span>
            <span className={s.starText}>фуркация, подвижность, рецессия от 3,5 мм</span>
          </span>
        </button>
        {furcation && !value.asterisk && <span className={s.hint}>{ui.psr.furcationHint}: отметьте доп. признак</span>}
      </Card>
    );
  };

  const resultText = summary.maxCode !== null ? text(String(summary.maxCode)) : undefined;
  const starText = summary.asterisk ? text('*') : undefined;

  return (
    <div className={s.root}>
      <div className={s.grid}>
        <p className={s.lead}>Отметьте наибольший код в каждом секстанте. Итог и текст для пациента подбираются автоматически.</p>
        <span className={s.archLabel}>{ui.map.upper}</span>
        {SEXTANTS.filter((x) => x.arch === 'upper').map(renderSextant)}
        <span className={s.archLabel}>{ui.map.lower}</span>
        {SEXTANTS.filter((x) => x.arch === 'lower').map(renderSextant)}
      </div>
      <aside className={s.aside}>
        <Card style={summary.maxCode === null ? undefined : toneStyle(psrTone(summary.maxCode))}>
          <CardHeader title={ui.psr.result} meta={<CounterChip>{`${summary.filled} из ${summary.total}`}</CounterChip>} />
          {summary.maxCode === null ? (
            <p className={s.muted} style={{ marginTop: 'var(--space-3)' }}>
              Отметьте коды секстантов
            </p>
          ) : (
            <div className={s.result}>
              <span className={s.resultValue}>
                {summary.maxCode}
                {summary.asterisk ? '*' : ''}
              </span>
              <span className={s.muted}>наибольший код</span>
            </div>
          )}
          {resultText && (
            <p className={s.text}>
              {resultText.staffText}
              {!resultText.approved && (
                <>
                  <br />
                  <Notice>{ui.psr.notApproved}</Notice>
                </>
              )}
            </p>
          )}
          {starText && <p className={s.text}>* {starText.staffText}</p>}
        </Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <SaveIndicator state={save} />
          <Button variant="ghost" size="sm" leading={<IconTrash size={18} />} onClick={onRemove}>
            {ui.visit.removeDocument}
          </Button>
        </div>
      </aside>
    </div>
  );
}
