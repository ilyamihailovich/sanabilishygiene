'use client';

import { useMemo } from 'react';
import { listElements } from '@/domain/brushMap';
import type { Arch } from '@/domain/teeth';
import type { IssueSnapshot } from '@/schemas/snapshot';
import { archBox } from '../brush-map/geometry';
import { SchemeView } from '../brush-map/scheme/SchemeView';
import { useSnapshotVisual } from './PatientCardView';

/** Векторная схема одной челюсти для PDF: размеры подписаны текстом у маркеров. */
export function PrintScheme({ snapshot, arch }: { snapshot: IssueSnapshot; arch: Arch }) {
  const visual = useSnapshotVisual(snapshot);
  const map = snapshot.brushMap;
  const elements = useMemo(() => (map ? listElements(map.content).filter((e) => e.active && e.arch === arch) : []), [map, arch]);
  if (!map) return null;
  return <SchemeView content={map.content} elements={elements} visual={visual} box={archBox(arch)} readOnly print markerRadius={15} />;
}
