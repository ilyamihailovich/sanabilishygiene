'use client';

import { motion } from 'motion/react';
import { memo, type KeyboardEvent, type PointerEvent } from 'react';
import { ui } from '@/content/ui.ru';
import type { MapElement } from '@/domain/brushMap';
import { ARCH_ORDER, archOf, toothIndex, type Arch, type ToothState } from '@/domain/teeth';
import type { BrushMapContent } from '@/schemas/brushMap';
import { cx } from '@/ui/cx';
import { spring } from '@/ui/motion';
import { TEETH, VIEW_H, VIEW_W, elementAnchor, type Box } from '../geometry';
import { SvgMarker, type MarkerVisual } from './SvgMarker';
import { toothFissure, toothOutline } from './toothShapes';
import s from './scheme.module.css';

export interface SchemeViewProps {
  content: BrushMapContent;
  elements: MapElement[];
  visual: (el: MapElement) => MarkerVisual;
  selectedKey?: string | null;
  selectedTooth?: number | null;
  /** Подсветка: остальные маркеры приглушаются. */
  highlight?: ReadonlySet<string> | null;
  /** Область просмотра (камера схемы на смартфоне); по умолчанию обе челюсти. */
  box?: Box | null;
  /** Область меняется жестами: без анимации, схема заполняет контейнер по высоте. */
  live?: boolean;
  /** Только одна челюсть (схема на телефоне). */
  arch?: Arch;
  readOnly?: boolean;
  /** Печать: подписи размеров текстом рядом с маркерами, без интерактивности. */
  print?: boolean;
  markerRadius?: number;
  onElement?: (key: string, target: Element) => void;
  onTooth?: (tooth: number, target: Element) => void;
  onHover?: (key: string | null, target: Element | null) => void;
}

const FULL: Box = { x: 0, y: 0, w: VIEW_W, h: VIEW_H };

function toothClass(state: ToothState) {
  return state === 'MISSING' ? s.missing : state === 'PONTIC' ? s.pontic : undefined;
}

function SchemeViewImpl({
  content,
  elements,
  visual,
  selectedKey,
  selectedTooth,
  highlight,
  box,
  live,
  arch,
  readOnly,
  print,
  markerRadius = 16,
  onElement,
  onTooth,
  onHover,
}: SchemeViewProps) {
  const vb = box ?? FULL;
  const shown = (readOnly ? elements.filter((e) => e.active) : elements).filter((e) => !arch || e.arch === arch);
  const teeth = arch ? TEETH.filter((g) => archOf(g.tooth) === arch) : TEETH;
  const activate = (e: KeyboardEvent<SVGGElement>, fn: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fn();
    }
  };

  return (
    <div className={cx(s.wrap, live && s.live)}>
      <motion.svg
        className={s.svg}
        style={box ? { overflow: 'hidden' } : undefined}
        initial={false}
        animate={live ? undefined : { viewBox: `${vb.x} ${vb.y} ${vb.w} ${vb.h}` }}
        transition={spring}
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        role="group"
        aria-label={ui.map.title}
      >
        <defs>
          <pattern id="pontic-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="#fff" />
            <path d="M0 0V6" stroke="#cfcfd4" strokeWidth="1.5" />
          </pattern>
        </defs>

        {!box && (
          <>
            <text className={s.caption} x={18} y={VIEW_H / 2 + 6}>
              {ui.map.quadrantRight}
            </text>
            <text className={s.caption} x={VIEW_W - 18} y={VIEW_H / 2 + 6} textAnchor="end">
              {ui.map.quadrantLeft}
            </text>
          </>
        )}

        {teeth.map((g) => {
          const t = content.teeth[String(g.tooth)] ?? { state: 'PRESENT' as const, furcation: false };
          const rad = (g.angle * Math.PI) / 180;
          const flip = -Math.sin(rad) * g.nx + Math.cos(rad) * g.ny < 0;
          const transform = `translate(${g.x} ${g.y}) rotate(${g.angle}) scale(1 ${flip ? -1 : 1})`;
          const fissure = t.state === 'MISSING' ? null : toothFissure(g.tooth, g.w, g.d);
          const labelR = g.d / 2 + 30;
          const label = `${ui.map.tooth} ${g.tooth}`;
          const body = (
            <>
              <path className={s.toothShape} d={toothOutline(g.tooth, g.w * 0.94, g.d)} transform={transform} />
              {fissure && <path className={s.fissure} d={fissure} transform={transform} />}
              {t.state === 'IMPLANT' && (
                <g transform={`translate(${g.x} ${g.y})`} pointerEvents="none">
                  <circle r={Math.min(g.w, g.d) * 0.24} fill="none" stroke="var(--color-text)" strokeWidth={1.6} />
                  <circle r={Math.min(g.w, g.d) * 0.1} fill="var(--color-text)" />
                </g>
              )}
              {t.furcation && t.state !== 'MISSING' && !readOnly && !print && (
                <path
                  d={`M${g.x + g.nx * (g.d / 2 - 2)} ${g.y + g.ny * (g.d / 2 - 2)}l${-g.ny * 6 - g.nx * 9} ${g.nx * 6 - g.ny * 9}M${g.x + g.nx * (g.d / 2 - 2)} ${g.y + g.ny * (g.d / 2 - 2)}l${g.ny * 6 - g.nx * 9} ${-g.nx * 6 - g.ny * 9}`}
                  stroke="var(--accent)"
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  fill="none"
                  pointerEvents="none"
                />
              )}
              <text
                className={cx(s.number, t.state === 'MISSING' && s.numberMissing)}
                x={g.x + g.nx * labelR}
                y={g.y + g.ny * labelR + 6}
                textAnchor="middle"
              >
                {g.tooth}
              </text>
            </>
          );
          if (readOnly || !onTooth) return <g key={g.tooth} className={toothClass(t.state)}>{body}</g>;
          return (
            <g
              key={g.tooth}
              className={cx(s.tooth, toothClass(t.state), selectedTooth === g.tooth && s.toothSelected)}
              role="button"
              tabIndex={-1}
              aria-label={`${label}, ${t.state === 'PRESENT' ? 'присутствует' : t.state === 'MISSING' ? 'отсутствует' : t.state === 'IMPLANT' ? 'имплантат' : 'промежуточная часть'}`}
              onClick={(e) => onTooth(g.tooth, e.currentTarget)}
              onKeyDown={(e) => activate(e, () => onTooth(g.tooth, e.currentTarget))}
            >
              {body}
            </g>
          );
        })}

        {shown.map((el) => {
          const a = elementAnchor(el);
          const v = visual(el);
          const marker = (
            <SvgMarker
              x={a.x}
              y={a.y}
              r={markerRadius}
              data={el.data}
              visual={v}
              active={el.active}
              selected={selectedKey === el.key}
              dimmed={Boolean(highlight && !highlight.has(el.key))}
            />
          );
          const printLabel =
            print && el.active && (v.label || el.data.alternative) ? (
              <text
                className={s.printLabel}
                x={a.x + a.nx * (markerRadius + 16)}
                y={a.y + a.ny * (markerRadius + 16) + 5}
                textAnchor="middle"
              >
                {v.label ?? (el.data.alternative === 'FLOSS' ? 'нить' : '—')}
              </text>
            ) : null;
          if (!onElement) {
            return (
              <g key={el.key}>
                {marker}
                {printLabel}
              </g>
            );
          }
          return (
            <g
              key={el.key}
              data-key={el.key}
              className={s.marker}
              role="button"
              tabIndex={-1}
              aria-label={`${el.kind === 'edge' ? 'Поверхность' : 'Промежуток'} ${el.label}`}
              aria-pressed={selectedKey === el.key}
              onClick={(e) => onElement(el.key, e.currentTarget)}
              onKeyDown={(e) => activate(e, () => onElement(el.key, e.currentTarget))}
              onPointerEnter={(e: PointerEvent<SVGGElement>) => e.pointerType === 'mouse' && onHover?.(el.key, e.currentTarget)}
              onPointerLeave={(e: PointerEvent<SVGGElement>) => e.pointerType === 'mouse' && onHover?.(null, null)}
            >
              <circle className={s.hit} cx={a.x} cy={a.y} r={markerRadius + 10} />
              {marker}
            </g>
          );
        })}
      </motion.svg>
    </div>
  );
}

export const SchemeView = memo(SchemeViewImpl);

/** Соседние позиции по дуге для добавления дополнительного промежутка. */
export function neighboursOf(tooth: number): number[] {
  const order = ARCH_ORDER[archOf(tooth)];
  const i = order.indexOf(tooth);
  return [order[i - 1], order[i + 1]].filter((t): t is number => t !== undefined && toothIndex(t) > 0);
}
