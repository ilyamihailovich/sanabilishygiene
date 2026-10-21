/*
  Линейные иллюстрации шагов «Как пользоваться ёршиком». Временные, собственные:
  заменяются иллюстрациями клиники без изменения разметки (по номеру шага).
*/

const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

function Tooth({ x }: { x: number }) {
  return <path {...common} d={`M${x} 92c-2-18 2-38 8-46 4-6 12-8 18-4 6-4 14-2 18 4 6 8 10 28 8 46`} />;
}

function Gum() {
  return <path {...common} strokeWidth={1.6} d="M8 96c14-8 24-8 36-2s22 6 34 0 22-6 36 0 22 6 34 2" opacity={0.55} />;
}

function Brush({ x, y, angle = 0, head = 'right' }: { x: number; y: number; angle?: number; head?: 'right' | 'left' }) {
  const dir = head === 'right' ? 1 : -1;
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`}>
      <path {...common} d={`M${-70 * dir} 0H${-6 * dir}`} />
      <path {...common} d={`M${-70 * dir} -5H${-34 * dir}M${-70 * dir} 5H${-34 * dir}`} strokeWidth={1.4} opacity={0.6} />
      <path {...common} strokeWidth={1.4} d={`M${-6 * dir} 0H${34 * dir}`} />
      {Array.from({ length: 9 }, (_, i) => (
        <path key={i} {...common} strokeWidth={1.1} d={`M${(-2 + i * 4) * dir} -6V6`} />
      ))}
    </g>
  );
}

export function StepIllustration({ step }: { step: number }) {
  return (
    <svg viewBox="0 0 160 120" width="100%" height="auto" aria-hidden="true" style={{ display: 'block', color: 'var(--color-text)' }}>
      {step === 0 && (
        <>
          <circle cx="56" cy="60" r="20" {...common} />
          <circle cx="104" cy="60" r="12" {...common} />
          <path {...common} d="M56 34v-8M104 42v-8" opacity={0.5} />
          <path {...common} strokeWidth={1.4} d="M44 60h24M98 60h12" opacity={0.6} />
        </>
      )}
      {step === 1 && (
        <>
          <Gum />
          <Tooth x={44} />
          <Tooth x={86} />
          <Brush x={78} y={78} angle={-12} />
        </>
      )}
      {step === 2 && (
        <>
          <Gum />
          <Tooth x={44} />
          <Tooth x={86} />
          <Brush x={78} y={78} />
          <path {...common} strokeWidth={1.6} d="M60 104h40M64 100l-4 4 4 4M96 100l4 4-4 4" />
        </>
      )}
      {step === 3 && (
        <>
          <path {...common} d="M60 40h40l-4 56H64Z" />
          <path {...common} strokeWidth={1.6} d="M66 56c6 4 22 4 28 0" opacity={0.6} />
          <path {...common} strokeWidth={1.4} d="M80 24c0 6-6 8-6 14M88 20c0 6-6 8-6 14" opacity={0.5} />
        </>
      )}
    </svg>
  );
}
