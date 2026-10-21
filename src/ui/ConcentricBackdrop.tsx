/** Тонкие концентрические окружности очень низкого контраста: фоновая графика за схемой дуг. */
export function ConcentricBackdrop({ rings = 7, className }: { rings?: number; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 800 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {Array.from({ length: rings }, (_, i) => (
        <circle
          key={i}
          cx="400"
          cy="400"
          r={90 + i * 55}
          fill="none"
          stroke="rgba(0,0,0,0.045)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}
