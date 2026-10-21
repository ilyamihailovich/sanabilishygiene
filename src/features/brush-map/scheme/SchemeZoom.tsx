'use client';

import { animate } from 'motion/react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import type { Box } from '../geometry';
import s from './scheme.module.css';

interface Camera {
  cx: number;
  cy: number;
  z: number;
}

interface Props {
  /** Границы челюсти в единицах схемы: при z = 1 видна вся челюсть. */
  bounds: Box;
  /** Куда приближаться после открытия (начало осмотра) и при выборе маркера. */
  target: { x: number; y: number };
  children: (box: Box) => ReactNode;
}

const MIN_Z = 1;
const MAX_Z = 4;
const START_Z = 2.2;
const TAP_SLOP = 8;

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Схема одной челюсти на телефоне: открывается целиком, затем приближается к началу осмотра; щипок меняет масштаб, палец сдвигает. */
export function SchemeZoom({ bounds, target, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [cam, setCam] = useState<Camera>({ cx: bounds.x + bounds.w / 2, cy: bounds.y + bounds.h / 2, z: MIN_Z });
  const camRef = useRef(cam);
  camRef.current = cam;
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const travel = useRef(0);
  const touched = useRef(false);
  const anim = useRef<{ stop: () => void } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => e && setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fit = size.w && size.h ? Math.min(size.w / bounds.w, size.h / bounds.h) : 1;

  const clamp = useCallback(
    (c: Camera): Camera => {
      const z = Math.min(MAX_Z, Math.max(MIN_Z, c.z));
      const sc = fit * z;
      const hw = size.w / (2 * sc);
      const hh = size.h / (2 * sc);
      const axis = (v: number, lo: number, len: number, half: number) =>
        half * 2 >= len ? lo + len / 2 : Math.min(lo + len - half, Math.max(lo + half, v));
      return { z, cx: axis(c.cx, bounds.x, bounds.w, hw), cy: axis(c.cy, bounds.y, bounds.h, hh) };
    },
    [bounds, fit, size],
  );

  const flyTo = useCallback(
    (to: Camera, delay = 0) => {
      anim.current?.stop();
      const from = camRef.current;
      const end = clamp(to);
      if (reducedMotion()) return setCam(end);
      anim.current = animate(0, 1, {
        delay,
        duration: 0.9,
        ease: [0.32, 0.72, 0, 1],
        onUpdate: (t) => setCam({ cx: from.cx + (end.cx - from.cx) * t, cy: from.cy + (end.cy - from.cy) * t, z: from.z + (end.z - from.z) * t }),
      });
    },
    [clamp],
  );

  // Открытие и смена челюсти: сначала вся челюсть, затем приближение к началу осмотра
  useEffect(() => {
    if (!size.w) return;
    touched.current = false;
    anim.current?.stop();
    setCam({ cx: bounds.x + bounds.w / 2, cy: bounds.y + bounds.h / 2, z: MIN_Z });
    camRef.current = { cx: bounds.x + bounds.w / 2, cy: bounds.y + bounds.h / 2, z: MIN_Z };
    flyTo({ cx: target.x, cy: target.y, z: START_Z }, 0.7);
    return () => anim.current?.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bounds, size.w > 0]);

  // Выбор маркера вне видимой области: плавный сдвиг к нему
  const lastTarget = useRef(target);
  useEffect(() => {
    if (lastTarget.current.x === target.x && lastTarget.current.y === target.y) return;
    lastTarget.current = target;
    if (!touched.current) return;
    flyTo({ cx: target.x, cy: target.y, z: Math.max(camRef.current.z, START_Z) });
  }, [target, flyTo]);

  const view = clamp(cam);
  const sc = fit * view.z;
  const box: Box = size.w
    ? { x: view.cx - size.w / (2 * sc), y: view.cy - size.h / (2 * sc), w: size.w / sc, h: size.h / sc }
    : bounds;

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    anim.current?.stop();
    touched.current = true;
    if (pointers.current.size === 0) travel.current = 0;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev || !ref.current) return;
    const pts = [...pointers.current.entries()];
    const c = camRef.current;
    const scale = fit * c.z;
    if (pts.length === 1) {
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      travel.current += Math.hypot(dx, dy);
      if (travel.current > TAP_SLOP) setCam(clamp({ ...c, cx: c.cx - dx / scale, cy: c.cy - dy / scale }));
    } else if (pts.length === 2) {
      const other = pts.find(([id]) => id !== e.pointerId)![1];
      const rect = ref.current.getBoundingClientRect();
      const oldMid = { x: (prev.x + other.x) / 2 - rect.left, y: (prev.y + other.y) / 2 - rect.top };
      const newMid = { x: (e.clientX + other.x) / 2 - rect.left, y: (e.clientY + other.y) / 2 - rect.top };
      const oldDist = Math.hypot(prev.x - other.x, prev.y - other.y) || 1;
      const newDist = Math.hypot(e.clientX - other.x, e.clientY - other.y);
      travel.current += TAP_SLOP;
      const vb = clamp(c);
      const ux = vb.cx - size.w / (2 * scale) + oldMid.x / scale;
      const uy = vb.cy - size.h / (2 * scale) + oldMid.y / scale;
      const z = Math.min(MAX_Z, Math.max(MIN_Z, c.z * (newDist / oldDist)));
      const ns = fit * z;
      setCam(clamp({ z, cx: ux - newMid.x / ns + size.w / (2 * ns), cy: uy - newMid.y / ns + size.h / (2 * ns) }));
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
  };

  return (
    <div
      ref={ref}
      className={s.zoom}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClickCapture={(e) => {
        // Сдвиг или щипок не считается нажатием на зуб или маркер
        if (travel.current > TAP_SLOP) {
          e.stopPropagation();
          e.preventDefault();
        }
      }}
    >
      {children(box)}
    </div>
  );
}
