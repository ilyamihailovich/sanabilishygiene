import { useId } from 'react';

export interface MarkerState {
  /** HEX цвета размера; null: размер не назначен или введён свободно. */
  color: string | null;
  assigned: boolean;
  bleeding: boolean;
  pain: boolean;
  openContact: boolean;
  selected: boolean;
}

interface BrushMarkerProps extends MarkerState {
  size?: number;
  title: string;
}

/**
 * Маркер промежутка. Состояние читается без цвета:
 * пустой — серый контур; назначен — заливка с тёмной обводкой; свободный ввод — белая заливка с тёмным кольцом;
 * кровоточивость — значок капли; болезненность и открытый контакт — отдельные метки под маркером.
 */
export function BrushMarker({ color, assigned, bleeding, pain, openContact, selected, size = 40, title }: BrushMarkerProps) {
  const titleId = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" role="img" aria-labelledby={titleId}>
      <title id={titleId}>{title}</title>
      {selected && <circle cx="20" cy="18" r="15" fill="none" stroke="var(--marker-ring-selected)" strokeWidth="2" />}
      {!assigned && (
        <circle cx="20" cy="18" r="8.5" fill="#fff" stroke="var(--marker-empty-stroke)" strokeWidth="1.5" />
      )}
      {assigned && color && (
        <>
          <circle cx="20" cy="18" r="10" fill={color} />
          <circle cx="20" cy="18" r="10" fill="none" stroke="var(--marker-outline)" strokeWidth="1" />
          <circle cx="20" cy="18" r="8.6" fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth="1" />
        </>
      )}
      {assigned && !color && (
        <>
          <circle cx="20" cy="18" r="10" fill="#fff" stroke="var(--color-text)" strokeWidth="1.75" />
          <circle cx="20" cy="18" r="3" fill="var(--color-text)" />
        </>
      )}
      {bleeding && (
        <g transform="translate(26 3)">
          <circle cx="6" cy="6" r="6.5" fill="var(--color-signal)" stroke="#fff" strokeWidth="1.5" />
          <path d="M6 2.6c1.3 1.6 2.4 3 2.4 4.3a2.4 2.4 0 0 1-4.8 0c0-1.3 1.1-2.7 2.4-4.3Z" fill="#fff" />
        </g>
      )}
      {(pain || openContact) && (
        <g transform="translate(20 34)">
          {pain && <circle cx={openContact ? -4 : 0} cy="0" r="2.4" fill="var(--color-text)" />}
          {openContact && (
            <path
              d={openContact && pain ? 'M2 -2.6v5.2M5.5 -2.6v5.2' : 'M-1.8 -2.6v5.2M1.8 -2.6v5.2'}
              stroke="var(--color-text)"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          )}
        </g>
      )}
    </svg>
  );
}
