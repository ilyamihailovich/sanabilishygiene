'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { ui } from '@/content/ui.ru';
import { listElements, type MapElement } from '@/domain/brushMap';
import type { BrushMapContent } from '@/schemas/brushMap';
import { GlassPanel } from '@/ui/Glass';
import { IconButton } from '@/ui/IconButton';
import { IconChevronLeft, IconExpand } from '@/ui/icons';
import { Segmented } from '@/ui/Segmented';
import { ToggleGroup } from '@/ui/ToggleGroup';
import { ToggleChip } from '@/ui/Chip';
import type { MarkerVisual } from '../brush-map/scheme/SvgMarker';
import { SchemeView } from '../brush-map/scheme/SchemeView';
import { VIEW_ORDER, type ViewKey } from '../brush-map/useMapKeyboard';
import { viewIconsPublic } from './viewIcons';
import s from './present.module.css';

const ThreeView = dynamic(() => import('../brush-map/three/ThreeView').then((m) => m.ThreeView), { ssr: false });

/** «Показать пациенту»: полноэкранная карта для объяснения в кресле, с режимом «Анатомия». */
export function PresentView({ visitId, content, catalog }: { visitId: string; content: BrushMapContent; catalog: Array<{ id: string; label: string; colorHex: string }> }) {
  const [view, setView] = useState<ViewKey>('overview');
  const [mode, setMode] = useState<'three' | 'scheme'>('three');
  const [anatomy, setAnatomy] = useState(false);
  const byId = useMemo(() => new Map(catalog.map((c) => [c.id, c])), [catalog]);
  const elements = useMemo(() => listElements(content).filter((e) => e.active), [content]);
  const visual = useCallback(
    (el: MapElement): MarkerVisual => {
      const sz = el.data.size;
      if (!sz) return { color: null, label: null };
      if ('freeText' in sz) return { color: null, label: sz.freeText };
      const c = byId.get(sz.catalogId);
      return { color: c?.colorHex ?? null, label: c?.label ?? null };
    },
    [byId],
  );

  return (
    <div className={s.root}>
      <div className={s.top}>
        <Link href={`/visits/${visitId}?step=issue`} aria-label={ui.common.back}>
          <IconButton label={ui.common.back} icon={<IconChevronLeft size={20} />} variant="glass" tabIndex={-1} />
        </Link>
        <div className={s.topRight}>
          {mode === 'three' && (
            <ToggleChip pressed={anatomy} onPressedChange={setAnatomy} className={s.glassChip}>
              {ui.views.anatomy}
            </ToggleChip>
          )}
          <Segmented
            label={ui.mapMode.label}
            value={mode}
            onChange={setMode}
            options={[
              { value: 'three', label: ui.mapMode.three },
              { value: 'scheme', label: ui.mapMode.scheme },
            ]}
          />
          <IconButton
            label="Во весь экран"
            icon={<IconExpand size={20} />}
            variant="glass"
            onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => undefined)}
          />
        </div>
      </div>
      {mode === 'three' ? (
        <ThreeView content={content} elements={elements} visual={visual} view={view} anatomy={anatomy} intro readOnly onFallback={() => setMode('scheme')} />
      ) : (
        <div className={s.scheme}>
          <SchemeView content={content} elements={elements} visual={visual} readOnly markerRadius={18} />
        </div>
      )}
      {mode === 'three' && (
        <div className={s.bottom}>
          <GlassPanel aria-label={ui.views.label}>
            <ToggleGroup
              label={ui.views.label}
              value={view}
              size={52}
              onChange={(v) => v && setView(v)}
              options={VIEW_ORDER.map((v) => ({ value: v, label: ui.views[v], content: viewIconsPublic[v] }))}
            />
          </GlassPanel>
        </div>
      )}
    </div>
  );
}
