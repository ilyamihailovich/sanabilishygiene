'use client';

import { useEffect, useMemo, useState } from 'react';
import { listElements } from '@/domain/brushMap';
import type { IssueSnapshot } from '@/schemas/snapshot';
import { ThreeView } from '../brush-map/three/ThreeView';
import type { ViewKey } from '../brush-map/useMapKeyboard';
import { useSnapshotVisual } from './PatientCardView';

/** Сцена для серверного рендера ракурсов в PDF: без анимации, подписи размеров у маркеров. */
declare global {
  interface Window {
    __setCaptureView?: (view: ViewKey) => void;
  }
}

export function CaptureScene({ snapshot, view: initialView }: { snapshot: IssueSnapshot; view: ViewKey }) {
  const visual = useSnapshotVisual(snapshot);
  // Сервис рендера переключает ракурсы без перезагрузки страницы
  const [view, setView] = useState(initialView);
  useEffect(() => {
    window.__setCaptureView = setView;
  }, []);
  const map = snapshot.brushMap;
  const elements = useMemo(() => (map ? listElements(map.content).filter((e) => e.active) : []), [map]);
  if (!map) return null;
  return (
    <div
      data-capture
      style={{ position: 'relative', width: 1200, height: 1000, background: 'radial-gradient(120% 90% at 50% 45%, #f6f6f8 0%, #ececf0 100%)' }}
    >
      <ThreeView content={map.content} elements={elements} visual={visual} view={view} readOnly capture />
    </div>
  );
}
