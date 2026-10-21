'use client';

import { useMemo, useState } from 'react';
import { ui } from '@/content/ui.ru';
import { SEXTANT_TEETH, summarizePsr } from '@/domain/psr';
import { SEXTANTS, type PsrCode, type PsrContent } from '@/schemas/psr';
import { Button } from '@/ui/Button';
import { Card, CardHeader } from '@/ui/Card';
import { CounterChip, ToggleChip } from '@/ui/Chip';
import { IconTrash } from '@/ui/icons';
import { Notice } from '@/ui/Notice';
import { ToggleGroup } from '@/ui/ToggleGroup';
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
  const save = useAutosave(documentId, rev, content);
  const summary = useMemo(() => summarizePsr(content), [content]);
  const text = (code: string) => texts.find((t) => t.code === code);

  const setSextant = (id: (typeof SEXTANTS)[number]['id'], patch: Partial<PsrContent['sextants']['S1']>) =>
    setContent((c) => ({ ...c, sextants: { ...c.sextants, [id]: { ...c.sextants[id], ...patch } } }));

  const renderSextant = (sx: (typeof SEXTANTS)[number]) => {
    const value = content.sextants[sx.id];
    const furcation = SEXTANT_TEETH[sx.id].some((t) => furcationTeeth.includes(t));
    return (
      <Card key={sx.id} className={s.sextant} padding={20}>
        <div className={s.sextantHead}>
          <span className={s.range}>{sx.label}</span>
          <ToggleChip pressed={value.asterisk} onPressedChange={(v) => setSextant(sx.id, { asterisk: v })} aria-label={ui.psr.asterisk}>
            *
          </ToggleChip>
        </div>
        <div className={s.codes}>
          <ToggleGroup
            label={`${ui.psr.code}, ${sx.label}`}
            deselectable
            size={44}
            value={value.code === null ? null : String(value.code)}
            onChange={(v) => setSextant(sx.id, { code: v === null ? null : (CODES.find((c) => c.value === v)?.code ?? null) })}
            options={CODES.map((c) => ({
              value: c.value,
              label: c.value === 'X' ? ui.psr.excludedHint : `${ui.psr.code} ${c.value}`,
              content: <span className={s.code}>{c.value}</span>,
            }))}
          />
        </div>
        {furcation && !value.asterisk && <span className={s.hint}>{ui.psr.furcationHint}</span>}
      </Card>
    );
  };

  const resultText = summary.maxCode !== null ? text(String(summary.maxCode)) : undefined;
  const starText = summary.asterisk ? text('*') : undefined;

  return (
    <div className={s.root}>
      <div className={s.grid}>
        <span className={s.archLabel}>{ui.map.upper}</span>
        {SEXTANTS.filter((x) => x.arch === 'upper').map(renderSextant)}
        <span className={s.archLabel}>{ui.map.lower}</span>
        {SEXTANTS.filter((x) => x.arch === 'lower').map(renderSextant)}
      </div>
      <aside className={s.aside}>
        <Card>
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
