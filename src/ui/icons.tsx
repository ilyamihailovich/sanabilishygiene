import type { SVGProps } from 'react';

/* Собственный набор линейных иконок: сетка 24, штрих 1.75, скруглённые окончания. */

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 20, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconArrowRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);

export const IconArrowUpRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 17 17 7M9 7h8v8" />
  </Svg>
);

export const IconChevronLeft = (p: IconProps) => (
  <Svg {...p}>
    <path d="m15 5-7 7 7 7" />
  </Svg>
);

export const IconChevronRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="m9 5 7 7-7 7" />
  </Svg>
);

export const IconClose = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);

export const IconPlus = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const IconCheck = (p: IconProps) => (
  <Svg {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Svg>
);

export const IconSearch = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.4-4.4" />
  </Svg>
);

export const IconUndo = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </Svg>
);

export const IconRedo = (p: IconProps) => (
  <Svg {...p}>
    <path d="m15 14 5-5-5-5" />
    <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
  </Svg>
);

export const IconMirror = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3v18" strokeDasharray="2 3" />
    <path d="M8 7 4 12l4 5V7ZM16 7l4 5-4 5V7Z" />
  </Svg>
);

export const IconRotate = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 12a8 8 0 1 0 2.4-5.7" />
    <path d="M4 4v4.5h4.5" />
  </Svg>
);

export const IconQr = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="4" width="6" height="6" rx="1.2" />
    <rect x="14" y="4" width="6" height="6" rx="1.2" />
    <rect x="4" y="14" width="6" height="6" rx="1.2" />
    <path d="M14 14h2.5v2.5H14zM17.5 17.5H20V20h-2.5zM20 14v1.5M14 20h1.5" />
  </Svg>
);

export const IconDownload = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" />
  </Svg>
);

export const IconShare = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 15V4M8 8l4-4 4 4" />
    <path d="M7 11H6a1.5 1.5 0 0 0-1.5 1.5v6A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5v-6A1.5 1.5 0 0 0 18 11h-1" />
  </Svg>
);

export const IconPrint = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 9V4h10v5" />
    <rect x="4" y="9" width="16" height="7.5" rx="2" />
    <path d="M7 14h10v6H7z" />
  </Svg>
);

export const IconLink = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </Svg>
);

export const IconKeyboard = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="6" width="18" height="12" rx="2.5" />
    <path d="M7 10h.01M10.5 10h.01M14 10h.01M17.5 10h.01M8 14h8" />
  </Svg>
);

export const IconDrop = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.5c3 3.6 5.5 6.9 5.5 10a5.5 5.5 0 0 1-11 0c0-3.1 2.5-6.4 5.5-10Z" />
  </Svg>
);

export const IconAlert = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5v5.5M12 16.2v.3" />
  </Svg>
);

export const IconUser = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="8.5" r="3.5" />
    <path d="M5 19.5c1.2-3.2 3.8-4.8 7-4.8s5.8 1.6 7 4.8" />
  </Svg>
);

/* Иконки ракурсов карты: схематичные дуги челюстей */

export const IconViewOverview = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 10.5c0-3.6 3.1-6 7-6s7 2.4 7 6" />
    <path d="M5 13.5c0 3.6 3.1 6 7 6s7-2.4 7-6" />
  </Svg>
);

export const IconViewUpper = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5.5 17c0-6.5 2.9-11 6.5-11s6.5 4.5 6.5 11" strokeWidth={2.25} />
  </Svg>
);

export const IconViewLower = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5.5 7c0 6.5 2.9 11 6.5 11s6.5-4.5 6.5-11" strokeWidth={2.25} />
  </Svg>
);

export const IconViewFront = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 11.2h16M4 12.8h16" strokeOpacity={0.5} />
    <path d="M7 11V8.5M10 11V7.5M14 11V7.5M17 11V8.5M7 13v2.5M10 13v3M14 13v3M17 13v2.5" />
  </Svg>
);

export const IconViewRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 11.2h16M4 12.8h16" strokeOpacity={0.5} />
    <path d="M5 11V8M9 11V7.5M13 11V8M5 13v3M9 13v3.5M13 13v3" />
    <path d="M17 9.5 19.5 12 17 14.5" />
  </Svg>
);

export const IconViewLeft = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 11.2h16M4 12.8h16" strokeOpacity={0.5} />
    <path d="M19 11V8M15 11V7.5M11 11V8M19 13v3M15 13v3.5M11 13v3" />
    <path d="M7 9.5 4.5 12 7 14.5" />
  </Svg>
);
