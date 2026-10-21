'use client';

import { useMemo, useRef, useState } from 'react';
import { InterspaceForm, type InterspaceValue } from '@/features/brush-map/input/InterspaceForm';
import { ui } from '@/content/ui.ru';
import { BrushMarker } from '@/ui/brush/BrushMarker';
import { BrushSwatch } from '@/ui/brush/BrushSwatch';
import { countLabel } from '@/content/plural';
import { Button } from '@/ui/Button';
import { Card, CardHeader } from '@/ui/Card';
import { CounterChip } from '@/ui/Chip';
import { ConcentricBackdrop } from '@/ui/ConcentricBackdrop';
import { GlassPanel, glassClass } from '@/ui/Glass';
import { useTouchLayout } from '@/ui/hooks/useMediaQuery';
import { IconButton } from '@/ui/IconButton';
import {
  IconKeyboard,
  IconMirror,
  IconRedo,
  IconRotate,
  IconUndo,
  IconViewFront,
  IconViewLeft,
  IconViewLower,
  IconViewOverview,
  IconViewRight,
  IconViewUpper,
} from '@/ui/icons';
import { Notice } from '@/ui/Notice';
import { Popover } from '@/ui/Popover';
import { Segmented } from '@/ui/Segmented';
import { Sheet } from '@/ui/Sheet';
import { cx } from '@/ui/cx';
import { demoArc, demoSizes } from '../demo-data';
import { Section } from './Section';
import s from './map.module.css';

type Entry = InterspaceValue & { key: string; label: string; freeText?: string };
type ViewKey = 'overview' | 'upper' | 'lower' | 'right' | 'front' | 'left';

const views: Array<{ key: ViewKey; icon: React.ReactNode }> = [
  { key: 'overview', icon: <IconViewOverview size={22} /> },
  { key: 'upper', icon: <IconViewUpper size={22} /> },
  { key: 'lower', icon: <IconViewLower size={22} /> },
  { key: 'right', icon: <IconViewRight size={22} /> },
  { key: 'front', icon: <IconViewFront size={22} /> },
  { key: 'left', icon: <IconViewLeft size={22} /> },
];

const sizeById = new Map(demoSizes.map((x) => [x.id, x]));

function initialEntries(): Entry[] {
  return demoArc.map((d) => ({
    key: d.key,
    label: d.label,
    ...(d.freeText ? { freeText: d.freeText } : {}),
    sizeId: d.sizeId,
    approach: 'VESTIBULAR',
    method: 'THROUGH',
    bleeding: d.bleeding,
    pain: d.pain,
    openContact: d.openContact,
    alternative: null,
  }));
}

function describe(e: Entry): string {
  const size = e.sizeId ? sizeById.get(e.sizeId)?.label : e.freeText;
  const parts = [`Промежуток ${e.label}`, size ? `размер ${size}` : 'размер не назначен'];
  if (e.bleeding) parts.push('кровоточивость');
  if (e.pain) parts.push('болезненность');
  if (e.openContact) parts.push('открытый контакт');
  return parts.join(', ');
}

export function MapSection() {
  const touch = useTouchLayout();
  const [mode, setMode] = useState<'three' | 'scheme'>('three');
  const [view, setView] = useState<ViewKey>('upper');
  const [entries, setEntries] = useState(initialEntries);
  const [selected, setSelected] = useState<string | null>(null);
  const [brush, setBrush] = useState<string | null>(null);
  const markerRefs = useRef(new Map<string, HTMLButtonElement>());
  const anchorRef = useRef<HTMLButtonElement | null>(null);

  const visible = touch ? entries.slice(0, 7) : entries;
  const current = entries.find((e) => e.key === selected) ?? null;

  const positions = useMemo(() => {
    const [from, to] = touch ? [165, 25] : [172, 8];
    return visible.map((_, i) => {
      const t = visible.length === 1 ? 0.5 : i / (visible.length - 1);
      const deg = from + (to - from) * t;
      const rad = (deg * Math.PI) / 180;
      return { left: 50 + 50 * Math.cos(rad), top: 100 - 100 * Math.sin(rad) };
    });
  }, [visible, touch]);

  const summary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of entries) if (e.sizeId) counts.set(e.sizeId, (counts.get(e.sizeId) ?? 0) + 1);
    return demoSizes.filter((x) => counts.has(x.id)).map((x) => ({ ...x, count: counts.get(x.id) ?? 0 }));
  }, [entries]);

  const examined = entries.filter((e) => e.bleeding !== null).length;
  const bleeding = entries.filter((e) => e.bleeding === true).length;
  const boib = examined ? Math.round((bleeding / examined) * 100) : 0;

  const update = (next: InterspaceValue) =>
    setEntries((list) => list.map((e) => (e.key === selected ? { ...e, ...next } : e)));

  const onMarker = (key: string) => {
    if (brush) {
      setEntries((list) => list.map((e) => (e.key === key ? { ...e, sizeId: brush, alternative: null } : e)));
      return;
    }
    anchorRef.current = markerRefs.current.get(key) ?? null;
    setSelected((cur) => (cur === key ? null : key));
  };

  const form = current && (
    <InterspaceForm value={current} onChange={update} sizes={demoSizes} density={touch ? 'touch' : 'compact'} />
  );

  return (
    <Section id="map" title="Карта." rest="Стекло только у плавающих элементов." counter="13 промежутков">
      <div className={s.layout}>
        <div className={s.stage}>
          <ConcentricBackdrop className={s.rings} />

          <div className={s.topBar}>
            <div className={cx(glassClass, s.glassSeg)}>
              <Segmented
                label={ui.mapMode.label}
                value={mode}
                onChange={setMode}
                options={[
                  { value: 'three', label: ui.mapMode.three },
                  { value: 'scheme', label: ui.mapMode.scheme },
                ]}
              />
            </div>
            <Notice>{ui.catalog.notVerified}</Notice>
          </div>

          <div className={s.arc}>
            <svg className={s.arcLine} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <path
                d="M0 100 A50 100 0 0 1 100 100"
                fill="none"
                stroke="rgba(0,0,0,0.12)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            {visible.map((e, i) => {
              const size = e.sizeId ? sizeById.get(e.sizeId) : undefined;
              const pos = positions[i];
              return (
                <button
                  key={e.key}
                  type="button"
                  ref={(el) => {
                    if (el) markerRefs.current.set(e.key, el);
                    else markerRefs.current.delete(e.key);
                  }}
                  className={s.marker}
                  style={{ left: `${pos?.left ?? 0}%`, top: `${pos?.top ?? 0}%` }}
                  aria-pressed={selected === e.key}
                  aria-label={describe(e)}
                  title={describe(e)}
                  onClick={() => onMarker(e.key)}
                >
                  <BrushMarker
                    title={describe(e)}
                    color={size?.color ?? null}
                    assigned={Boolean(size || e.freeText)}
                    bleeding={e.bleeding === true}
                    pain={e.pain}
                    openContact={e.openContact}
                    selected={selected === e.key}
                    size={touch ? 44 : 40}
                  />
                  <span className={s.markerLabel}>{e.label}</span>
                </button>
              );
            })}
          </div>

          <GlassPanel orientation="vertical" className={s.side} aria-label="Инструменты">
            <IconButton label={ui.common.undo} icon={<IconUndo size={20} />} variant="ghost" size={40} />
            <IconButton label={ui.common.redo} icon={<IconRedo size={20} />} variant="ghost" size={40} disabled />
            <IconButton label="Зеркально на другую сторону" icon={<IconMirror size={20} />} variant="ghost" size={40} />
            {!touch && <IconButton label="Клавиши (?)" icon={<IconKeyboard size={20} />} variant="ghost" size={40} />}
          </GlassPanel>

          <div className={s.bottom}>
            {mode === 'three' ? (
              <>
                <GlassPanel aria-label={ui.views.label}>
                  {views.map((v) => (
                    <IconButton
                      key={v.key}
                      label={ui.views[v.key]}
                      icon={v.icon}
                      variant="ghost"
                      size={44}
                      active={view === v.key}
                      aria-pressed={view === v.key}
                      onClick={() => setView(v.key)}
                    />
                  ))}
                  {!touch && (
                    <IconButton
                      label={ui.views.reset}
                      icon={<IconRotate size={20} />}
                      variant="ghost"
                      onClick={() => setView('overview')}
                    />
                  )}
                </GlassPanel>
                <span className={s.viewCaption} aria-live="polite">
                  {ui.views[view]}
                </span>
              </>
            ) : (
              <>
                <GlassPanel aria-label="Кисть: размер для быстрого ввода">
                  {demoSizes.map((size) => (
                    <BrushSwatch
                      key={size.id}
                      color={size.color}
                      label={`Кисть: ${size.label}`}
                      pressed={brush === size.id}
                      onClick={() => setBrush((b) => (b === size.id ? null : size.id))}
                    />
                  ))}
                </GlassPanel>
                <span className={s.viewCaption} aria-live="polite">
                  {brush ? `Кисть: ${sizeById.get(brush)?.label}. Касания проставляют размер` : 'Выберите размер как кисть'}
                </span>
              </>
            )}
          </div>
        </div>

        <aside className={s.aside}>
          <Card>
            <CardHeader title="Что понадобится" meta={<CounterChip>{countLabel(summary.length, ['размер', 'размера', 'размеров'])}</CounterChip>} />
            <ul className={s.needList}>
              {summary.map((x) => (
                <li key={x.id} className={s.need}>
                  <span className={s.needDot} style={{ background: x.color }} aria-hidden="true" />
                  <span className={s.needLabel}>{x.label}</span>
                  <span className={s.needCount}>{countLabel(x.count, ['промежуток', 'промежутка', 'промежутков'])}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="BOIB" meta={<CounterChip>{`${examined} обследовано`}</CounterChip>} />
            <div className={s.index}>
              <span className={s.indexValue}>{boib} %</span>
              <span className={s.indexDelta}>прошлый визит 31 %, снижение</span>
            </div>
          </Card>
        </aside>
      </div>

      <div className={s.legend} role="list" aria-label="Состояния маркеров">
        {[
          { t: 'Не назначен', p: { color: null, assigned: false } },
          { t: 'Назначен размер', p: { color: demoSizes[2]?.color ?? null, assigned: true } },
          { t: 'Свободный ввод', p: { color: null, assigned: true } },
          { t: 'Кровоточивость', p: { color: demoSizes[1]?.color ?? null, assigned: true, bleeding: true } },
          { t: 'Болезненность, открытый контакт', p: { color: demoSizes[0]?.color ?? null, assigned: true, pain: true, openContact: true } },
          { t: 'Выбран', p: { color: demoSizes[3]?.color ?? null, assigned: true, selected: true } },
        ].map(({ t, p }) => (
          <div key={t} className={s.legendItem} role="listitem">
            <BrushMarker
              title={t}
              size={48}
              color={p.color}
              assigned={p.assigned}
              bleeding={'bleeding' in p ? Boolean(p.bleeding) : false}
              pain={'pain' in p ? Boolean(p.pain) : false}
              openContact={'openContact' in p ? Boolean(p.openContact) : false}
              selected={'selected' in p ? Boolean(p.selected) : false}
            />
            {t}
          </div>
        ))}
      </div>

      {!touch && (
        <Popover open={Boolean(current)} onClose={() => setSelected(null)} anchor={anchorRef} label={current ? `Промежуток ${current.label}` : ''}>
          {current && (
            <>
              <div className={s.popHead}>
                <span className={s.popTitle}>{current.label}</span>
                <CounterChip onSurface>Промежуток</CounterChip>
              </div>
              {form}
            </>
          )}
        </Popover>
      )}
      {touch && (
        <Sheet
          open={Boolean(current)}
          onClose={() => setSelected(null)}
          title={current ? `Промежуток ${current.label}` : ''}
          closeLabel={ui.common.close}
          modal={false}
        >
          {form}
          <div className={s.sheetFoot}>
            <Button block variant="secondary" onClick={() => setSelected(null)}>
              {ui.common.close}
            </Button>
          </div>
        </Sheet>
      )}
    </Section>
  );
}
