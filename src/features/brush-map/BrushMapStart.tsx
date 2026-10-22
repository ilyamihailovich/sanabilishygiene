'use client';

import { useMemo, useState } from 'react';
import { countLabel } from '@/content/plural';
import { ui } from '@/content/ui.ru';
import { emptyBrushMap, listElements } from '@/domain/brushMap';
import type { ToothState } from '@/domain/teeth';
import type { BrushMapContent } from '@/schemas/brushMap';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { formatDate } from '@/ui/format';
import { cx } from '@/ui/cx';
import s from './start.module.css';

export interface MapStartChoice {
  from: 'empty' | 'previous';
  teeth?: BrushMapContent['teeth'];
}

const QUADRANTS: Array<{ label: string; teeth: number[] }> = [
  { label: 'Верхняя правая', teeth: [18, 17, 16, 15, 14, 13, 12, 11] },
  { label: 'Верхняя левая', teeth: [21, 22, 23, 24, 25, 26, 27, 28] },
  { label: 'Нижняя правая', teeth: [48, 47, 46, 45, 44, 43, 42, 41] },
  { label: 'Нижняя левая', teeth: [31, 32, 33, 34, 35, 36, 37, 38] },
];

const CYCLE: ToothState[] = ['PRESENT', 'MISSING', 'IMPLANT', 'PONTIC'];
const STATE_LABEL: Record<ToothState, string> = {
  PRESENT: 'на месте',
  MISSING: 'отсутствует',
  IMPLANT: 'имплантат',
  PONTIC: 'промежуточная часть моста',
};

/**
 * Старт карты ёршиков: откуда начать, формула до осмотра, порядок осмотра.
 * Формула задаётся до первого промежутка, чтобы карта сразу показала только нужные промежутки.
 */
export function BrushMapStart({ previousDate, disabled, onStart }: { previousDate: string | null; disabled: boolean; onStart: (choice: MapStartChoice) => void }) {
  const [from, setFrom] = useState<'empty' | 'previous'>(previousDate ? 'previous' : 'empty');
  const [teeth, setTeeth] = useState(() => emptyBrushMap().teeth);

  const interspaces = useMemo(
    () => listElements({ ...emptyBrushMap(), teeth }).filter((e) => e.kind === 'interspace' && e.active).length,
    [teeth],
  );
  const changed = useMemo(() => {
    const base = emptyBrushMap().teeth;
    return Object.entries(teeth).filter(([k, t]) => t.state !== base[k]?.state).length;
  }, [teeth]);

  const toggle = (tooth: number) =>
    setTeeth((all) => {
      const cur = all[String(tooth)] ?? { state: 'PRESENT' as const, furcation: false };
      const next = CYCLE[(CYCLE.indexOf(cur.state) + 1) % CYCLE.length]!;
      return { ...all, [String(tooth)]: { ...cur, state: next } };
    });

  return (
    <Card className={s.start}>
      <div className={s.intro}>
        <h3 className={s.title}>Новая карта ёршиков</h3>
        <p className={s.lead}>
          Карта хранит формулу зубов, размер ёршика для каждого промежутка и кровоточивость. Из неё строятся схема пациенту, PDF и индекс BOIB.
        </p>
      </div>

      {previousDate && (
        <div className={s.sources} role="radiogroup" aria-label="С чего начать">
          <button type="button" role="radio" aria-checked={from === 'previous'} className={s.source} onClick={() => setFrom('previous')}>
            <span className={s.sourceTitle}>Перенести карту от {formatDate(previousDate)}</span>
            <span className={s.sourceText}>Формула и размеры сохранятся, кровоточивость и болезненность обнулятся. Удобно на повторном визите.</span>
          </button>
          <button type="button" role="radio" aria-checked={from === 'empty'} className={s.source} onClick={() => setFrom('empty')}>
            <span className={s.sourceTitle}>Начать с чистой карты</span>
            <span className={s.sourceText}>Сначала формула зубов, затем все промежутки по порядку.</span>
          </button>
        </div>
      )}

      {from === 'empty' && (
        <section className={s.formula} aria-label="Формула зубов">
          <div className={s.formulaHead}>
            <span className={s.sectionTitle}>Формула зубов</span>
            <span className={s.counter}>
              {countLabel(interspaces, ui.map.interspaces)} к осмотру{changed ? ` · изменено зубов: ${changed}` : ''}
            </span>
          </div>
          <p className={s.hint}>Нажмите на зуб, чтобы сменить состояние. Третьи моляры по умолчанию отсутствуют. Формулу можно поправить и на карте.</p>
          <div className={s.quadrants}>
            {QUADRANTS.map((q) => (
              <div key={q.label} className={s.quadrant}>
                <span className={s.quadrantLabel}>{q.label}</span>
                <div className={s.teeth}>
                  {q.teeth.map((t) => {
                    const st = teeth[String(t)]?.state ?? 'PRESENT';
                    return (
                      <button
                        key={t}
                        type="button"
                        className={cx(s.tooth, s[st])}
                        aria-label={`Зуб ${t}: ${STATE_LABEL[st]}`}
                        title={`${t}: ${STATE_LABEL[st]}`}
                        onClick={() => toggle(t)}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className={s.legend}>
            {CYCLE.map((st) => (
              <span key={st} className={s.legendItem}>
                <span className={cx(s.legendSwatch, s[st])} aria-hidden="true" />
                {STATE_LABEL[st]}
              </span>
            ))}
          </div>
        </section>
      )}

      <section aria-label="Порядок осмотра">
        <span className={s.sectionTitle}>Как проходит осмотр</span>
        <ol className={s.steps}>
          <li>
            <span className={s.stepNum}>1</span>
            <span>
              <b>Промежутки по порядку</b>: верхняя челюсть 18→28, затем нижняя 38→48. Стрелки на клавиатуре ведут по этому порядку.
            </span>
          </li>
          <li>
            <span className={s.stepNum}>2</span>
            <span>
              <b>Размер ёршика</b>: клавиши 1–9 и 0 или выбор в карточке промежутка. Если ёршик не проходит, отметьте зубную нить (F) или «не требуется» (N).
            </span>
          </li>
          <li>
            <span className={s.stepNum}>3</span>
            <span>
              <b>Кровоточивость</b>: клавиша B или переключатель в карточке. BOIB считается по промежуткам с отметкой или размером.
            </span>
          </li>
          <li>
            <span className={s.stepNum}>4</span>
            <span>
              <b>Зеркало</b>: заполненную сторону можно перенести на противоположную в пределах челюсти, затем поправить отличия.
            </span>
          </li>
        </ol>
      </section>

      <div className={s.actions}>
        <Button disabled={disabled} onClick={() => onStart(from === 'previous' ? { from } : { from, teeth })}>
          {from === 'previous' ? 'Перенести и начать осмотр' : 'Начать осмотр'}
        </Button>
      </div>
    </Card>
  );
}
