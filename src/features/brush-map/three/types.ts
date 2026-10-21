import type { MapElement } from '@/domain/brushMap';
import type { BrushMapContent } from '@/schemas/brushMap';
import type { MarkerVisual } from '../scheme/SvgMarker';
import type { ViewKey } from '../useMapKeyboard';

export interface ThreeViewProps {
  content: BrushMapContent;
  elements: MapElement[];
  visual: (el: MapElement) => MarkerVisual;
  view: ViewKey;
  selectedKey?: string | null;
  highlight?: ReadonlySet<string> | null;
  anatomy?: boolean;
  /** Анимация раскрытия при открытии. */
  intro?: boolean;
  readOnly?: boolean;
  /** Режим рендера для PDF: без анимации, сигнал готовности в window. */
  capture?: boolean;
  onElement?: (key: string, target: Element) => void;
  onTooth?: (tooth: number, target: Element) => void;
  onHover?: (key: string | null, target: Element | null) => void;
  /** 3D недоступно или слишком медленно: переключиться на схему. */
  onFallback?: (reason: 'webgl' | 'slow' | 'error') => void;
}

export function webgl2Available(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2'));
  } catch {
    return false;
  }
}
