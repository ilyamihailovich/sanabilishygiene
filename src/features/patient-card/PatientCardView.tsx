'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ui } from '@/content/ui.ru';
import { listElements, type MapElement } from '@/domain/brushMap';
import type { Arch } from '@/domain/teeth';
import type { IssueSnapshot } from '@/schemas/snapshot';
import { Button } from '@/ui/Button';
import { CounterChip } from '@/ui/Chip';
import { GlassPanel, glassClass } from '@/ui/Glass';
import { Heading } from '@/ui/Heading';
import { IconDownload, IconShare } from '@/ui/icons';
import { Logo } from '@/ui/Logo';
import { Popover } from '@/ui/Popover';
import { Segmented } from '@/ui/Segmented';
import { ToggleGroup } from '@/ui/ToggleGroup';
import { cx } from '@/ui/cx';
import { boibTone, psrTone, toneStyle } from '@/ui/tone';
import { archBox, elementAnchor, toothGeom } from '../brush-map/geometry';
import { SchemeView } from '../brush-map/scheme/SchemeView';
import { SchemeZoom } from '../brush-map/scheme/SchemeZoom';
import type { MarkerVisual } from '../brush-map/scheme/SvgMarker';
import { webgl2Available } from '../brush-map/three/types';
import { VIEW_ORDER, type ViewKey } from '../brush-map/useMapKeyboard';
import { viewIconsPublic } from './viewIcons';
import { AlternativesNote, Bleeding, BrushList, Contacts, DocumentBody, HowTo, NextVisit, Screening, brushRows } from './blocks';
import { ElementInfo } from './ElementInfo';
import { dateLong, greeting } from './format';
import s from './card.module.css';

const ThreeView = dynamic(() => import('../brush-map/three/ThreeView').then((m) => m.ThreeView), {
  ssr: false,
  loading: () => <div className={s.hint} style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>{ui.map.loading3d}</div>,
});

/** Начало осмотра на челюсти: к нему схема приближается после открытия. */
const jawStart = (jaw: Arch) => {
  const [a, b] = (jaw === 'upper' ? [17, 16] : [37, 36]).map(toothGeom) as [ReturnType<typeof toothGeom>, ReturnType<typeof toothGeom>];
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
};

export function useSnapshotVisual(snapshot: IssueSnapshot) {
  return useCallback(
    (el: MapElement): MarkerVisual => {
      const size = el.data.size;
      if (!size) return { color: null, label: null };
      if ('freeText' in size) return { color: size.color ?? null, label: size.freeText };
      const c = snapshot.brushMap?.sizes[size.catalogId];
      return { color: c?.colorHex ?? null, label: c?.label ?? null };
    },
    [snapshot],
  );
}

/** Онлайн-карта пациента. Блоки выводятся, только если заполнены. Номера медкарты здесь нет. */
export function PatientCardView({ snapshot, pdfUrl, calendarUrl = null }: { snapshot: IssueSnapshot; pdfUrl: string; calendarUrl?: string | null }) {
  const [scrolled, setScrolled] = useState(false);
  const [mode, setMode] = useState<'three' | 'scheme'>('three');
  const [view, setView] = useState<ViewKey>('overview');
  const [picked, setPicked] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);
  const [jaw, setJaw] = useState<Arch>('upper');
  const [zoomTarget, setZoomTarget] = useState(() => jawStart('upper'));
  const jawBounds = useMemo(() => archBox(jaw), [jaw]);
  const [info, setInfo] = useState<string | null>(null);
  const infoAnchor = useRef<HTMLElement | null>(null);
  const visual = useSnapshotVisual(snapshot);
  const showInfo = useCallback((key: string, target: Element) => {
    infoAnchor.current = target as HTMLElement;
    setInfo((k) => (k === key ? null : key));
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener('scroll', onScroll, { passive: true });
    setCanShare(typeof navigator.share === 'function');
    if (!webgl2Available()) setMode('scheme');
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const map = snapshot.brushMap;
  const elements = useMemo(() => (map ? listElements(map.content).filter((e) => e.active) : []), [map]);
  const infoEl = info ? (elements.find((e) => e.key === info) ?? null) : null;
  const rows = useMemo(() => brushRows(snapshot), [snapshot]);
  const highlight = useMemo(() => {
    const row = rows.find((r) => r.ref === picked);
    if (!row || !map) return null;
    const set = new Set<string>();
    for (const el of elements) {
      const sz = el.data.size;
      if (!sz) continue;
      const ref = 'catalogId' in sz ? `c:${sz.catalogId}` : `f:${sz.freeText.toLowerCase()}`;
      if (ref === row.ref) set.add(el.key);
    }
    return set;
  }, [picked, rows, elements, map]);

  const share = async () => {
    try {
      await navigator.share({ title: ui.appName, url: window.location.href });
    } catch {
      /* пользователь отменил */
    }
  };

  return (
    <div className={s.page}>
      <header className={cx(s.header, scrolled && glassClass, scrolled && s.headerScrolled)}>
        <div className={s.headerInner}>
          <span className={s.brand}>
            <Logo height={14} />
          </span>
        </div>
      </header>

      <main className={s.main}>
        <div className={s.hero}>
          <Heading as="h1" level="title1">
            {greeting(snapshot.patientName)}
          </Heading>
          <div className={s.heroMeta}>
            <CounterChip>
              {ui.patient.visitDate}: {dateLong(snapshot.visitDate)}
            </CounterChip>
            {snapshot.clinician && (
              <CounterChip>
                {ui.patient.doctor}: {snapshot.clinician.name}
              </CounterChip>
            )}
          </div>
        </div>

        {map && (
          <section className={cx(s.block, s.mapBlock)} aria-labelledby="pc-map">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <h2 id="pc-map" className={s.blockTitle}>
                {ui.patient.brushMap}
              </h2>
              <Segmented
                label={ui.mapMode.label}
                value={mode}
                onChange={(m) => {
                  setInfo(null);
                  setMode(m);
                }}
                options={[
                  { value: 'three', label: ui.mapMode.three },
                  { value: 'scheme', label: ui.mapMode.scheme },
                ]}
              />
            </div>
            <div className={s.stage}>
              {mode === 'three' ? (
                <>
                  <ThreeView
                    content={map.content}
                    elements={elements}
                    visual={visual}
                    view={view}
                    highlight={highlight}
                    intro
                    readOnly
                    selectedKey={info}
                    onElement={showInfo}
                    onFallback={() => setMode('scheme')}
                  />
                  <div className={s.stageViews}>
                    <GlassPanel aria-label={ui.views.label}>
                      <ToggleGroup
                        label={ui.views.label}
                        value={view}
                        size={46}
                        onChange={(v) => {
                          setInfo(null);
                          if (v) setView(v);
                        }}
                        options={VIEW_ORDER.map((v) => ({ value: v, label: ui.views[v], content: viewIconsPublic[v] }))}
                      />
                    </GlassPanel>
                  </div>
                </>
              ) : (
                <>
                  <SchemeZoom bounds={jawBounds} target={zoomTarget}>
                    {(box) => (
                      <SchemeView
                        content={map.content}
                        elements={elements}
                        visual={visual}
                        highlight={highlight}
                        selectedKey={info}
                        box={box}
                        live
                        arch={jaw}
                        readOnly
                        markerRadius={15}
                        onElement={(key, target) => {
                          const el = elements.find((e) => e.key === key);
                          if (el) setZoomTarget(elementAnchor(el));
                          showInfo(key, target);
                        }}
                      />
                    )}
                  </SchemeZoom>
                  <div className={s.stageViews}>
                    <GlassPanel aria-label="Челюсть">
                      <Segmented
                        label="Челюсть"
                        value={jaw}
                        onChange={(v) => {
                          setInfo(null);
                          setJaw(v);
                          setZoomTarget(jawStart(v));
                        }}
                        options={[
                          { value: 'upper', label: 'Верхняя' },
                          { value: 'lower', label: 'Нижняя' },
                        ]}
                      />
                    </GlassPanel>
                  </div>
                </>
              )}
              <Popover open={infoEl !== null} onClose={() => setInfo(null)} anchor={infoAnchor} label="Промежуток" track={info} narrow>
                {infoEl && <ElementInfo element={infoEl} snapshot={snapshot} />}
              </Popover>
            </div>
          </section>
        )}

        {rows.length > 0 && (
          <section className={s.block} aria-labelledby="pc-brushes">
            <h2 id="pc-brushes" className={s.blockTitle}>
              {ui.patient.yourBrushes}
            </h2>
            <p className={s.hint}>{ui.patient.tapHint}</p>
            <BrushList rows={rows} active={picked} onPick={(ref) => setPicked((p) => (p === ref ? null : ref))} />
            <AlternativesNote snapshot={snapshot} />
          </section>
        )}

        {snapshot.brushSteps && map && (
          <section className={s.block} aria-labelledby="pc-howto">
            <h2 id="pc-howto" className={s.blockTitle}>
              {ui.patient.howTo}
            </h2>
            <HowTo steps={snapshot.brushSteps} />
          </section>
        )}

        {snapshot.hygienePlan && (
          <section className={s.block} aria-labelledby="pc-plan">
            <h2 id="pc-plan" className={s.blockTitle}>
              {snapshot.hygienePlan.title || ui.patient.hygienePlan}
            </h2>
            <DocumentBody doc={snapshot.hygienePlan} brushes={rows} />
          </section>
        )}

        {snapshot.aftercare.map((doc, i) => (
          <section key={i} className={s.block} aria-label={doc.title}>
            <h2 className={s.blockTitle}>{doc.title}</h2>
            <DocumentBody doc={doc} brushes={rows} />
          </section>
        ))}

        {snapshot.psr && snapshot.psr.summary.maxCode !== null && (
          <section className={cx(s.block, s.roomy)} aria-labelledby="pc-psr" style={toneStyle(psrTone(snapshot.psr.summary.maxCode))}>
            <h2 id="pc-psr" className={s.blockTitle}>
              {ui.patient.screening}
            </h2>
            <Screening snapshot={snapshot} />
          </section>
        )}

        {map && map.boib.pct !== null && (
          <section className={cx(s.block, s.roomy)} aria-labelledby="pc-boib" style={toneStyle(boibTone(map.boib.pct))}>
            <h2 id="pc-boib" className={s.blockTitle}>
              {ui.patient.bleeding}
            </h2>
            <Bleeding snapshot={snapshot} />
          </section>
        )}

        {(snapshot.nextVisit.date || snapshot.nextVisit.months) && (
          <section className={s.block} aria-labelledby="pc-next">
            <h2 id="pc-next" className={s.blockTitle}>
              {ui.patient.nextVisit}
            </h2>
            <NextVisit snapshot={snapshot} />
            {calendarUrl && (
              <a href={calendarUrl} className={s.reminder}>
                <Button variant="glass" block tabIndex={-1}>
                  Установить напоминание
                </Button>
              </a>
            )}
          </section>
        )}

        <section className={s.block} aria-labelledby="pc-contacts">
          <h2 id="pc-contacts" className={s.blockTitle}>
            {ui.patient.contacts}
          </h2>
          <Contacts snapshot={snapshot} />
        </section>
      </main>

      <div className={cx(glassClass, s.actionBar)}>
        <a href={pdfUrl} download>
          <Button leading={<IconDownload size={18} />} tabIndex={-1}>
            {ui.patient.download}
          </Button>
        </a>
        {canShare && (
          <Button variant="glass" leading={<IconShare size={18} />} onClick={share}>
            {ui.patient.share}
          </Button>
        )}
      </div>
    </div>
  );
}
