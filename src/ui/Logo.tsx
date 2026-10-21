import { LOGO_PATHS, LOGO_VIEWBOX, MARK_OVAL, MARK_S_TRANSFORM, MARK_VIEWBOX } from './brand/paths';

const LOGO_RATIO = 1224.8 / 191.81;

/** Словесный знак SANABILIS, цвет наследуется (currentColor). height задаёт высоту прописных. */
export function Logo({ height = 14 }: { height?: number }) {
  return (
    <svg
      viewBox={LOGO_VIEWBOX}
      width={Math.round(height * LOGO_RATIO)}
      height={height}
      fill="currentColor"
      role="img"
      aria-label="SANABILIS"
      style={{ display: 'block', flex: 'none' }}
    >
      {LOGO_PATHS.map((d) => (
        <path key={d.slice(0, 24)} d={d} />
      ))}
    </svg>
  );
}

/** Знак «S в овале». */
export function Mark({ size = 32 }: { size?: number }) {
  const S_PATH = LOGO_PATHS[0] ?? '';
  return (
    <svg viewBox={MARK_VIEWBOX} width={size} height={Math.round((size * 1104) / 1448)} role="img" aria-label="SANABILIS" style={{ display: 'block', flex: 'none' }}>
      <path d={MARK_OVAL} fill="none" stroke="currentColor" strokeWidth="70" />
      <path d={S_PATH} transform={MARK_S_TRANSFORM} fill="currentColor" />
    </svg>
  );
}
