import type { ElementData } from '@/schemas/brushMap';

export interface MarkerVisual {
  color: string | null;
  label: string | null;
}

interface SvgMarkerProps {
  x: number;
  y: number;
  r: number;
  data: ElementData;
  visual: MarkerVisual;
  active: boolean;
  selected: boolean;
  dimmed: boolean;
}

/**
 * Маркер промежутка в SVG. Состояние читается без цвета: пустой — серый контур; размер — заливка с обводкой;
 * свой размер — белая заливка с точкой; нить — горизонтальная черта; «не требуется» — тире; капля — кровоточивость.
 */
export function SvgMarker({ x, y, r, data, visual, active, selected, dimmed }: SvgMarkerProps) {
  const opacity = dimmed ? 0.22 : 1;
  if (!active) {
    return <circle cx={x} cy={y} r={r * 0.45} fill="#fff" stroke="var(--marker-empty-stroke)" strokeWidth={1.25} strokeDasharray="3 3" opacity={0.8} />;
  }
  const assigned = data.size !== null;
  return (
    <g opacity={opacity} style={{ transition: 'opacity 250ms' }}>
      {selected && <circle cx={x} cy={y} r={r + 7} fill="none" stroke="var(--marker-ring-selected)" strokeWidth={2.5} />}
      {assigned && visual.color && (
        <>
          <circle cx={x} cy={y} r={r} fill={visual.color} />
          <circle cx={x} cy={y} r={r} fill="none" stroke="var(--marker-outline)" strokeWidth={1.25} />
          <circle cx={x} cy={y} r={r - 2.2} fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth={1.4} />
        </>
      )}
      {assigned && !visual.color && (
        <>
          <circle cx={x} cy={y} r={r} fill="#fff" stroke="var(--color-text)" strokeWidth={2} />
          <circle cx={x} cy={y} r={r * 0.3} fill="var(--color-text)" />
        </>
      )}
      {!assigned && (
        <circle cx={x} cy={y} r={r * 0.82} fill="#fff" stroke="var(--marker-empty-stroke)" strokeWidth={1.75} />
      )}
      {!assigned && data.alternative === 'FLOSS' && (
        <path d={`M${x - r * 0.5} ${y}H${x + r * 0.5}`} stroke="var(--color-text)" strokeWidth={2.2} strokeLinecap="round" />
      )}
      {!assigned && data.alternative === 'NONE' && (
        <path d={`M${x - r * 0.3} ${y}H${x + r * 0.3}`} stroke="var(--marker-empty-stroke)" strokeWidth={2.2} strokeLinecap="round" />
      )}
      {data.bleeding === true && (
        <g transform={`translate(${x + r * 0.62} ${y - r * 0.62})`}>
          <circle r={r * 0.52} fill="var(--color-signal)" stroke="#fff" strokeWidth={1.6} />
          <path
            d={`M0 ${-r * 0.32}c${r * 0.17} ${r * 0.2} ${r * 0.28} ${r * 0.36} ${r * 0.28} ${r * 0.5}a${r * 0.28} ${r * 0.28} 0 0 1 ${-r * 0.56} 0c0-${r * 0.14} ${r * 0.11}-${r * 0.3} ${r * 0.28}-${r * 0.5}Z`}
            fill="#fff"
          />
        </g>
      )}
      {(data.pain || data.openContact) && (
        <g transform={`translate(${x} ${y + r + 7})`}>
          {data.pain && <circle cx={data.openContact ? -5 : 0} r={2.8} fill="var(--color-text)" />}
          {data.openContact && (
            <path
              d={data.pain ? 'M2.5 -3.2v6.4M6.5 -3.2v6.4' : 'M-2 -3.2v6.4M2 -3.2v6.4'}
              stroke="var(--color-text)"
              strokeWidth={1.8}
              strokeLinecap="round"
            />
          )}
        </g>
      )}
    </g>
  );
}
