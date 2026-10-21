import { ui } from '@/content/ui.ru';

/** Временный текстовый логотип до получения SVG клиники (public/brand/logo.svg). */
export function Logo({ size = 17 }: { size?: number }) {
  return (
    <span
      style={{
        fontSize: size,
        fontWeight: 500,
        letterSpacing: '0.2em',
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}
    >
      {ui.brand}
    </span>
  );
}
