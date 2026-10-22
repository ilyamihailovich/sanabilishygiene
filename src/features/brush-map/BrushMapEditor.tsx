'use client';

import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ui } from '@/content/ui.ru';
import {
  addExtra,
  computeBoib,
  keysLostByChange,
  listElements,
  mirrorSide,
  removeExtra,
  setFurcation,
  setToothState,
  summarizeSizes,
  updateElement,
  type BoibResult,
  type MapElement,
} from '@/domain/brushMap';
import { navigate } from '@/domain/navigation';
import type { ToothState } from '@/domain/teeth';
import type { BrushMapContent, ElementData } from '@/schemas/brushMap';
import type { CatalogItem } from '@/server/services/catalog';
import { api } from '@/ui/api';
import { ConfirmDialog } from '@/ui/Dialog';
import { CounterChip } from '@/ui/Chip';
import { GlassPanel, glassClass } from '@/ui/Glass';
import { useTouchLayout } from '@/ui/hooks/useMediaQuery';
import { IconButton } from '@/ui/IconButton';
import {
  IconKeyboard,
  IconMinus,
  IconMirror,
  IconPlus,
  IconRedo,
  IconRotate,
  IconUndo,
  IconViewFront,
  IconViewLeft,
  IconViewLower,
  IconViewOverview,
  IconViewRight,
  IconViewUpper,
} from '@/ui/icons';
import { Notice } from '@/ui/Notice';
import { Popover } from '@/ui/Popover';
import { Segmented } from '@/ui/Segmented';
import { Sheet } from '@/ui/Sheet';
import { ToggleGroup } from '@/ui/ToggleGroup';
import { useToast } from '@/ui/Toast';
import { SaveIndicator } from '../visit/SaveIndicator';
import { useAutosave } from '../visit/useAutosave';
import { VIEW_H, VIEW_W, archBox, elementAnchor, toothGeom } from './geometry';
import { HoverCard } from './HoverCard';
import { ElementForm } from './input/ElementForm';
import { ToothForm } from './input/ToothForm';
import { BoibCard, NeedCard, legendFromUsage } from './MapSummary';
import { MirrorDialog } from './MirrorDialog';
import { SchemeView, neighboursOf } from './scheme/SchemeView';
import { SchemeZoom, type SchemeZoomHandle } from './scheme/SchemeZoom';
import type { MarkerVisual } from './scheme/SvgMarker';
import { ShortcutsDialog } from './ShortcutsDialog';
import { webgl2Available } from './three/types';
import { useHistoryState } from './useHistoryState';
import { VIEW_ORDER, useMapKeyboard, type ViewKey } from './useMapKeyboard';
import s from './editor.module.css';

const ThreeView = dynamic(() => import('./three/ThreeView').then((m) => m.ThreeView), {
  ssr: false,
  loading: () => <div className={s.threeLoading}>{ui.map.loading3d}</div>,
});

export const viewIcons: Record<ViewKey, React.ReactNode> = {
  overview: <IconViewOverview size={22} />,
  upper: <IconViewUpper size={22} />,
  lower: <IconViewLower size={22} />,
  right: <IconViewRight size={22} />,
  front: <IconViewFront size={22} />,
  left: <IconViewLeft size={22} />,
};

type Jaw = 'upper' | 'lower';
const FULL_BOX = { x: 0, y: 0, w: VIEW_W, h: VIEW_H };
/** Начало осмотра: 18→28 на верхней, 38→48 на нижней челюсти. */
const JAW_START: Record<Jaw, [number, number]> = { upper: [17, 16], lower: [37, 36] };
const jawStart = (jaw: Jaw) => {
  const [a, b] = JAW_START[jaw].map(toothGeom) as [ReturnType<typeof toothGeom>, ReturnType<typeof toothGeom>];
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
};
type Mode = 'three' | 'scheme';

interface Props {
  documentId: string;
  rev: number;
  initial: BrushMapContent;
  catalog: CatalogItem[];
  hotkeyOrder: string[];
  initialMode: Mode;
  previousBoib: (BoibResult & { date: string }) | null;
  /** Куда вынести переключатель 3D / Схема (заголовок шага); без него — в шапке редактора. */
  headSlot?: HTMLElement | null;
}

export function BrushMapEditor({ documentId, rev, initial, catalog, hotkeyOrder, initialMode, previousBoib, headSlot }: Props) {
  const touch = useTouchLayout();
  const toast = useToast();
  const history = useHistoryState(initial);
  const content = history.value;
  const save = useAutosave(documentId, rev, content);

  const [mode, setModeState] = useState<Mode>(initialMode);
  const [view, setView] = useState<ViewKey>('overview');
  const [jaw, setJaw] = useState<Jaw>('upper');
  const [zoomTarget, setZoomTarget] = useState(() => jawStart('upper'));
  const jawBounds = useMemo(() => archBox(jaw), [jaw]);
  const zoom = useRef<SchemeZoomHandle>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [panel, setPanel] = useState<'element' | 'tooth' | null>(null);
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [brush, setBrush] = useState<string | null>(null);
  const [hover, setHover] = useState<{ key: string; target: Element } | null>(null);
  const [help, setHelp] = useState(false);
  const [mirror, setMirror] = useState(false);
  const [pendingTooth, setPendingTooth] = useState<{ tooth: number; state: ToothState; lost: string[] } | null>(null);
  const anchor = useRef<Element | null>(null);
  const anchorRef = useMemo(() => ({ get current() { return anchor.current as HTMLElement | null; } }), []);

  const elements = useMemo(() => listElements(content), [content]);
  const byKey = useMemo(() => new Map(elements.map((e) => [e.key, e])), [elements]);
  const selectedEl = selectedKey ? byKey.get(selectedKey) : undefined;
  // на компьютере кнопка «+» приближает к выбранному промежутку, без выбора — к началу осмотра
  const deskTarget = useMemo(() => (selectedEl ? elementAnchor(selectedEl) : jawStart('upper')), [selectedEl]);
  const catalogById = useMemo(() => new Map(catalog.map((c) => [c.id, c])), [catalog]);
  const hotkeyIds = useMemo(() => {
    const ordered = hotkeyOrder.filter((id) => catalogById.has(id));
    const rest = catalog.map((c) => c.id).filter((id) => !ordered.includes(id));
    return [...ordered, ...rest].slice(0, 10);
  }, [hotkeyOrder, catalog, catalogById]);
  const hotkeys = useMemo(() => new Map(hotkeyIds.map((id, i) => [id, i === 9 ? '0' : String(i + 1)])), [hotkeyIds]);
  const unverified = catalog.some((c) => !c.verified);

  const visual = useCallback(
    (el: MapElement): MarkerVisual => {
      const size = el.data.size;
      if (!size) return { color: null, label: null };
      if ('freeText' in size) return { color: size.color ?? null, label: size.freeText };
      const c = catalogById.get(size.catalogId);
      return { color: c?.colorHex ?? null, label: c?.label ?? '?' };
    },
    [catalogById],
  );

  const boib = useMemo(() => computeBoib(content), [content]);
  const legend = useMemo(
    () =>
      legendFromUsage(summarizeSizes(content), (id) => {
        const c = catalogById.get(id);
        // бренд и вид ёршика очевидны из контекста; врачу важен проход
        return c ? { label: c.label, meta: `проход ${c.passageMm.replace('.', ',')} мм`, color: c.colorHex } : null;
      }),
    [content, catalogById],
  );

  // 3D недоступно — сразу схема
  useEffect(() => {
    if (initialMode === 'three' && !webgl2Available()) {
      setModeState('scheme');
      toast(ui.fallback.noWebgl);
    }
  }, [initialMode, toast]);

  const setMode = (m: Mode) => {
    setModeState(m);
    setHover(null);
    api.patch('/api/v1/me/prefs', { mapMode: m }).catch(() => undefined);
  };

  const patchElement = useCallback(
    (key: string, patch: Partial<ElementData>) => history.apply((c) => updateElement(c, key, patch)),
    [history],
  );

  /** На смартфоне выбранный элемент прокручивается в верхнюю треть: ниже открывается лист. */
  const revealAboveSheet = (target: Element | null) => {
    if (!touch || !target) return;
    const r = target.getBoundingClientRect();
    const want = window.innerHeight * 0.22;
    if (Math.abs(r.top - want) > 40) window.scrollBy({ top: r.top - want, behavior: 'smooth' });
  };

  const select = (key: string, target: Element | null, openPanel: boolean) => {
    setSelectedKey(key);
    setSelectedTooth(null);
    if (target) anchor.current = target;
    if (openPanel) setPanel('element');
    revealAboveSheet(target);
  };

  const onElement = (key: string, target: Element) => {
    const el = byKey.get(key);
    if (brush && el && (el.active || el.kind === 'edge')) {
      patchElement(key, { size: { catalogId: brush }, alternative: null, ...(el.kind === 'edge' ? { enabled: true } : {}) });
      setSelectedKey(key);
      return;
    }
    if (selectedKey === key && panel === 'element') {
      setPanel(null);
      return;
    }
    select(key, target, true);
  };

  const onTooth = (tooth: number, target: Element) => {
    anchor.current = target;
    revealAboveSheet(target);
    setSelectedTooth(tooth);
    setSelectedKey(null);
    setPanel('tooth');
  };

  const changeTooth = (tooth: number, state: ToothState) => {
    const next = setToothState(content, tooth, state);
    const lost = keysLostByChange(content, next);
    if (lost.length) setPendingTooth({ tooth, state, lost });
    else history.apply(() => next);
  };

  const focusMarker = (key: string | null) => {
    if (!key) return;
    const el = byKey.get(key);
    const node = document.querySelector(`[data-key="${CSS.escape(key)}"]`);
    if (node) anchor.current = node;
    if (touch && el) {
      setJaw(el.arch);
      const a = elementAnchor(el);
      setZoomTarget({ x: a.x, y: a.y });
    }
    if (mode === 'three' && el) {
      setView(el.arch === 'upper' ? 'upper' : 'lower');
    }
  };

  // признак, что обработчики клавиатуры подключены (после гидратации); на него опираются браузерные тесты
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  useMapKeyboard(!touch, {
    navigate: (move) => {
      const next = navigate(elements, selectedKey, move);
      setSelectedKey(next);
      setSelectedTooth(null);
      focusMarker(next);
    },
    sizeByIndex: (i) => {
      const id = hotkeyIds[i];
      if (selectedKey && id) patchElement(selectedKey, { size: { catalogId: id }, alternative: null });
    },
    clearSize: () => selectedKey && patchElement(selectedKey, { size: null }),
    toggle: (field) => {
      const el = selectedKey ? byKey.get(selectedKey) : null;
      if (!el) return;
      const d = el.data;
      if (field === 'bleeding') patchElement(el.key, { bleeding: d.bleeding === true ? false : true });
      if (field === 'pain') patchElement(el.key, { pain: !d.pain });
      if (field === 'openContact') patchElement(el.key, { openContact: !d.openContact });
      if (field === 'floss') patchElement(el.key, d.alternative === 'FLOSS' ? { alternative: null } : { alternative: 'FLOSS', size: null });
      if (field === 'none') patchElement(el.key, d.alternative === 'NONE' ? { alternative: null } : { alternative: 'NONE', size: null });
    },
    cycle: (field) => {
      const el = selectedKey ? byKey.get(selectedKey) : null;
      if (!el) return;
      if (field === 'approach') patchElement(el.key, { approach: el.data.approach === 'VESTIBULAR' ? 'ORAL' : 'VESTIBULAR' });
      else {
        const order = ['THROUGH', 'ANGLED', 'BOTH'] as const;
        patchElement(el.key, { method: order[(order.indexOf(el.data.method) + 1) % 3]! });
      }
    },
    open: () => {
      if (!selectedKey) return;
      focusMarker(selectedKey);
      setPanel('element');
    },
    close: () => (panel ? setPanel(null) : setSelectedKey(null)),
    view: (v) => {
      if (mode === 'three') setView(v);
    },
    undo: history.undo,
    redo: history.redo,
    help: () => setHelp(true),
  });

  const selected = selectedKey ? (byKey.get(selectedKey) ?? null) : null;
  const toothData = selectedTooth ? (content.teeth[String(selectedTooth)] ?? { state: 'PRESENT' as const, furcation: false }) : null;

  const elementForm = selected && (
    <ElementForm
      key={selected.key}
      element={selected}
      catalog={catalog}
      hotkeys={hotkeys}
      density={touch ? 'touch' : 'compact'}
      onPatch={(p) => patchElement(selected.key, p)}
      {...(selected.kind === 'extra'
        ? {
            onRemoveExtra: () => {
              history.apply((c) => removeExtra(c, selected.key.slice(2)));
              setPanel(null);
              setSelectedKey(null);
            },
          }
        : {})}
    />
  );

  const toothForm = selectedTooth && toothData && (
    <ToothForm
      tooth={selectedTooth}
      state={toothData.state}
      furcation={toothData.furcation}
      neighbours={neighboursOf(selectedTooth).filter((n) => content.teeth[String(n)]?.state !== 'MISSING')}
      onState={(st) => changeTooth(selectedTooth, st)}
      onFurcation={(v) => history.apply((c) => setFurcation(c, selectedTooth, v))}
      onAddExtra={(n) => {
        const id = Math.random().toString(36).slice(2, 10);
        history.apply((c) => addExtra(c, { id, label: `${selectedTooth}/${n} доп.`, between: [selectedTooth, n] }));
        setPanel(null);
        setSelectedTooth(null);
        setSelectedKey(`x:${id}`);
        setTimeout(() => setPanel('element'), 50);
      }}
    />
  );

  const panelTitle = panel === 'element' && selected ? selected.label : panel === 'tooth' && selectedTooth ? `${ui.map.tooth} ${selectedTooth}` : '';
  const panelBody = panel === 'element' ? elementForm : panel === 'tooth' ? toothForm : null;
  const closePanel = () => setPanel(null);

  const hoverEl = hover ? (byKey.get(hover.key) ?? null) : null;

  const modeToggle = (
    <Segmented
      label={ui.mapMode.label}
      value={mode}
      onChange={setMode}
      options={[
        { value: 'three', label: ui.mapMode.three },
        { value: 'scheme', label: ui.mapMode.scheme },
      ]}
    />
  );

  // На телефоне пульт поверх сцены, на компьютере под ней
  const dock = (
    <div className={touch ? s.bottomDock : s.dockBelow}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={mode}
          className={s.bottom}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.2 }}
        >
          {mode === 'three' ? (
            <>
              <GlassPanel aria-label={ui.views.label}>
                <ToggleGroup
                  label={ui.views.label}
                  value={view}
                  size={touch ? 48 : 44}
                  onChange={(v) => v && setView(v)}
                  options={VIEW_ORDER.map((v) => ({ value: v, label: ui.views[v], content: viewIcons[v] }))}
                />
                {!touch && <IconButton label={ui.views.reset} icon={<IconRotate size={20} />} variant="ghost" onClick={() => setView('overview')} />}
              </GlassPanel>
              <span className={s.caption} aria-live="polite">
                {ui.views[view]}
              </span>
            </>
          ) : (
            <>
              <GlassPanel aria-label={ui.map.brush} className={s.brushRow}>
                <ToggleGroup
                  label={ui.map.brush}
                  thumb="ring"
                  deselectable
                  value={brush}
                  onChange={setBrush}
                  options={catalog.map((c) => ({
                    value: c.id,
                    label: `${ui.map.brush}: ${c.label}`,
                    content: <span className={s.swatch} style={{ background: c.colorHex }} />,
                  }))}
                />
              </GlassPanel>
              <span className={s.caption} aria-live="polite">
                {brush ? `${ui.map.brush}: ${catalogById.get(brush)?.label}. ${ui.map.brushHint}` : ui.map.brushPick}
              </span>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );

  return (
    <div className={s.root} data-ready={ready ? 'true' : undefined}>
      <div className={s.head}>
        <div className={s.headLeft}>
          {unverified && <Notice short={ui.catalog.notVerifiedShort}>{ui.catalog.notVerified}</Notice>}
          <SaveIndicator state={save} />
        </div>
        {headSlot ? createPortal(modeToggle, headSlot) : modeToggle}
      </div>

      <div className={`${s.stage} ${mode === 'three' || touch ? s.stageThree : ''}`}>
        {mode === 'scheme' && touch && (
          <div className={s.quadrants}>
            <div className={glassClass} style={{ borderRadius: 999, padding: 3, display: 'inline-block' }}>
              <Segmented
                label="Челюсть"
                value={jaw}
                onChange={(v) => {
                  setJaw(v);
                  setZoomTarget(jawStart(v));
                }}
                options={[
                  { value: 'upper', label: 'Верхняя' },
                  { value: 'lower', label: 'Нижняя' },
                ]}
              />
            </div>
          </div>
        )}

        <AnimatePresence mode="wait" initial={false}>
          {mode === 'scheme' ? (
            <motion.div
              key="scheme"
              className={`${s.scheme} ${touch ? s.schemeTouch : s.schemeFill}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {touch ? (
                <SchemeZoom bounds={jawBounds} target={zoomTarget}>
                  {(box) => (
                    <SchemeView
                      content={content}
                      elements={elements}
                      visual={visual}
                      selectedKey={selectedKey}
                      selectedTooth={selectedTooth}
                      box={box}
                      live
                      arch={jaw}
                      markerRadius={15}
                      onElement={onElement}
                      onTooth={onTooth}
                    />
                  )}
                </SchemeZoom>
              ) : (
                <SchemeZoom ref={zoom} bounds={FULL_BOX} intro={false} target={deskTarget}>
                  {(box) => (
                    <SchemeView
                      content={content}
                      elements={elements}
                      visual={visual}
                      selectedKey={selectedKey}
                      selectedTooth={selectedTooth}
                      box={box}
                      live
                      markerRadius={16}
                      onElement={onElement}
                      onTooth={onTooth}
                      onHover={(key, target) => setHover(key && target ? { key, target } : null)}
                    />
                  )}
                </SchemeZoom>
              )}
            </motion.div>
          ) : (
            <motion.div key="three" style={{ position: 'absolute', inset: 0 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <ThreeView
                content={content}
                elements={elements}
                visual={visual}
                view={view}
                selectedKey={selectedKey}
                intro
                onElement={onElement}
                onTooth={onTooth}
                onHover={(key, target) => setHover(key && target ? { key, target } : null)}
                onFallback={(reason) => {
                  setModeState('scheme');
                  toast(reason === 'webgl' ? ui.fallback.noWebgl : reason === 'error' ? ui.fallback.modelError : ui.fallback.schemeOpened);
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <GlassPanel orientation="vertical" className={s.side} aria-label="Инструменты">
          <IconButton label={ui.common.undo} icon={<IconUndo size={20} />} variant="ghost" size={40} disabled={!history.canUndo} onClick={history.undo} />
          <IconButton label={ui.common.redo} icon={<IconRedo size={20} />} variant="ghost" size={40} disabled={!history.canRedo} onClick={history.redo} />
          <IconButton label={ui.map.mirror} icon={<IconMirror size={20} />} variant="ghost" size={40} onClick={() => setMirror(true)} />
          {!touch && mode === 'scheme' && (
            <>
              <IconButton label="Приблизить (Ctrl + колесо)" icon={<IconPlus size={20} />} variant="ghost" size={40} onClick={() => zoom.current?.zoomBy(1.5)} />
              <IconButton label="Отдалить" icon={<IconMinus size={20} />} variant="ghost" size={40} onClick={() => zoom.current?.zoomBy(1 / 1.5)} />
            </>
          )}
          {!touch && <IconButton label={`${ui.map.shortcuts} (?)`} icon={<IconKeyboard size={20} />} variant="ghost" size={40} onClick={() => setHelp(true)} />}
        </GlassPanel>

        {touch && dock}
      </div>

      {!touch && dock}

      <aside className={s.aside}>
        <NeedCard legend={legend} />
        <BoibCard boib={boib} previous={previousBoib} />
      </aside>

      {!touch && (
        <Popover open={panel !== null && Boolean(panelBody)} onClose={closePanel} anchor={anchorRef} label={String(panelTitle)} track={`${panel}:${selectedKey}:${selectedTooth}`}>
          <div className={s.popHead}>
            <span className={s.popTitle}>{panelTitle}</span>
            {panel === 'element' && selected && (
              <CounterChip tone="glass">{selected.kind === 'edge' ? 'Поверхность' : selected.kind === 'extra' ? 'Дополнительный' : 'Промежуток'}</CounterChip>
            )}
          </div>
          {panelBody}
        </Popover>
      )}
      {touch && (
        <Sheet open={panel !== null && Boolean(panelBody)} onClose={closePanel} title={panelTitle} closeLabel={ui.common.close} modal={false}>
          {panelBody}
        </Sheet>
      )}

      {!touch && <HoverCard element={panel ? null : hoverEl} target={hover?.target ?? null} sizeLabel={hoverEl ? visual(hoverEl).label : null} />}
      <ShortcutsDialog open={help} onClose={() => setHelp(false)} />
      <MirrorDialog
        open={mirror}
        onClose={() => setMirror(false)}
        onApply={(arch, from) => {
          const r = mirrorSide(content, arch, from);
          history.apply(() => r.content);
          toast(`${ui.map.mirrorDone} ${r.copied}`);
        }}
      />
      <ConfirmDialog
        open={pendingTooth !== null}
        title={ui.map.toothState}
        text={pendingTooth ? `${ui.map.lostConfirm} ${pendingTooth.lost.map((k) => byKey.get(k)?.label ?? k).join(', ')}` : ''}
        confirmLabel={ui.common.confirm}
        onClose={() => setPendingTooth(null)}
        onConfirm={() => pendingTooth && history.apply((c) => setToothState(c, pendingTooth.tooth, pendingTooth.state))}
      />
    </div>
  );
}
