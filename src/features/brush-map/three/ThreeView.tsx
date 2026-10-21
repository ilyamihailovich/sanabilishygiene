'use client';

import { ContactShadows, Environment, Html, Lightformer, OrbitControls, PerformanceMonitor, useGLTF } from '@react-three/drei';
import { Canvas, createPortal, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Fragment, Suspense, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { MapElement } from '@/domain/brushMap';
import { SvgMarker } from '../scheme/SvgMarker';
import type { ViewKey } from '../useMapKeyboard';
import { createMaterials, setFade, type JawMaterials, type QualityTier } from './materials';
import { MODEL_URL, OPEN_ANGLE, anchorFor, indexNodes, type JawNodes } from './model';
import { webgl2Available, type ThreeViewProps } from './types';
import s from './three.module.css';

declare global {
  interface Window {
    __sanabilisReady?: boolean;
  }
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const INTRO_MS = 1500;
const VIEW_MS = 650;

function initialTier(): QualityTier {
  if (typeof navigator === 'undefined') return 'mid';
  const cores = navigator.hardwareConcurrency ?? 4;
  const mobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
  if (cores >= 8 && !mobile) return 'high';
  return 'mid';
}

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Невидимый DOM-якорь в точке клика по зубу: к нему привязывается поповер. */
function pointAnchor(x: number, y: number): HTMLElement {
  let el = document.getElementById('three-point-anchor');
  if (!el) {
    el = document.createElement('div');
    el.id = 'three-point-anchor';
    Object.assign(el.style, { position: 'fixed', width: '1px', height: '1px', pointerEvents: 'none' });
    document.body.appendChild(el);
  }
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  return el;
}

export function ThreeView(props: ThreeViewProps) {
  const [tier, setTier] = useState<QualityTier>(() => (props.capture ? 'mid' : initialTier()));
  const skip = useRef(false);
  const { onFallback } = props;

  useEffect(() => {
    if (!webgl2Available()) onFallback?.('webgl');
  }, [onFallback]);

  return (
    <div className={s.root} onPointerDown={() => (skip.current = true)}>
      <Canvas
        className={s.canvas}
        dpr={props.capture ? 1.5 : tier === 'low' ? 1 : tier === 'mid' ? [1, 1.5] : [1, 2]}
        camera={{ fov: 28, near: 0.005, far: 3, position: [0, 0.01, 0.2] }}
        gl={{
          antialias: true,
          alpha: true,
          toneMapping: THREE.AgXToneMapping,
          toneMappingExposure: 1.18,
          outputColorSpace: THREE.SRGBColorSpace,
          preserveDrawingBuffer: Boolean(props.capture),
          powerPreference: 'high-performance',
        }}
        onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      >
        {!props.capture && (
          <PerformanceMonitor
            flipflops={4}
            onDecline={() => setTier((t) => (t === 'high' ? 'mid' : 'low'))}
            onIncline={() => setTier((t) => (t === 'low' ? 'mid' : t))}
            onFallback={() => onFallback?.('slow')}
          />
        )}
        <Lights tier={tier} />
        <Suspense fallback={null}>
          <Scene {...props} tier={tier} skip={skip} />
        </Suspense>
      </Canvas>
    </div>
  );
}

function Lights({ tier }: { tier: QualityTier }) {
  return (
    <>
      <ambientLight intensity={0.12} />
      <directionalLight position={[0.15, 0.4, 0.6]} intensity={1.0} />
      <directionalLight position={[0, -0.5, 0.35]} intensity={0.55} />
      <Environment resolution={tier === 'low' ? 64 : 256} frames={1}>
        {/* студийный свет: мягкий ключевой спереди, центр ярче, мягкие боковые заполняющие */}
        <Lightformer form="rect" intensity={2.6} position={[0, 0.4, 3]} scale={[3.5, 2.2, 1]} />
        <Lightformer form="circle" intensity={1.6} position={[0, 0.2, 2.5]} scale={[1.2, 1.2, 1]} />
        <Lightformer form="rect" intensity={0.9} position={[0, 3, 0.5]} rotation-x={Math.PI / 2} scale={[4, 4, 1]} />
        <Lightformer form="rect" intensity={0.55} position={[-3, 0.3, 0.6]} rotation-y={Math.PI / 2} scale={[3, 2, 1]} />
        <Lightformer form="rect" intensity={0.55} position={[3, 0.3, 0.6]} rotation-y={-Math.PI / 2} scale={[3, 2, 1]} />
        <Lightformer form="rect" intensity={1.1} position={[0, -3, 0.6]} rotation-x={-Math.PI / 2} scale={[4, 4, 1]} color="#f4f1ec" />
      </Environment>
    </>
  );
}

interface SceneProps extends ThreeViewProps {
  tier: QualityTier;
  skip: MutableRefObject<boolean>;
}

function Scene({
  content,
  elements,
  visual,
  view,
  selectedKey,
  highlight,
  anatomy,
  intro,
  readOnly,
  capture,
  tier,
  skip,
  onElement,
  onTooth,
  onHover,
}: SceneProps) {
  const gltf = useGLTF(MODEL_URL, false, true);
  const nodes = useMemo(() => indexNodes(gltf.scene), [gltf.scene]);
  const upperMats = useMemo(() => createMaterials(tier), [tier]);
  const lowerMats = useMemo(() => createMaterials(tier), [tier]);
  const implants = useRef<THREE.Object3D[]>([]);
  const opening = useRef(intro && !capture && !reducedMotion() ? 0 : 1);
  const fades = useRef({ upper: 1, lower: 1 });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    assignMaterials(nodes.maxilla, upperMats);
    assignMaterials(nodes.mandible, lowerMats);
    if (nodes.implant) nodes.implant.visible = false;
    return () => {
      for (const m of [...Object.values(upperMats), ...Object.values(lowerMats)]) m.dispose();
    };
  }, [nodes, upperMats, lowerMats]);

  // состояние зубов: отсутствует, имплантат, промежуточная часть; режим «Анатомия»
  useEffect(() => {
    for (const o of implants.current) o.removeFromParent();
    implants.current = [];
    for (const [tooth, parts] of nodes.teeth) {
      const state = content.teeth[String(tooth)]?.state ?? 'PRESENT';
      parts.node.visible = state !== 'MISSING';
      // корни видны только в «Анатомии»: в обычном режиме их закрывают десна и кость
      if (parts.root) parts.root.visible = state === 'PRESENT' && Boolean(anatomy);
      const g = nodes.gums.get(tooth);
      const solid = state === 'PRESENT' || state === 'IMPLANT';
      if (g?.gum) g.gum.visible = solid || !g.ridge;
      if (g?.ridge) g.ridge.visible = !solid;
      if (state === 'IMPLANT' && nodes.implant) {
        const axis = nodes.anchors.get(`ax_${tooth}`);
        if (axis) {
          const fixture = nodes.implant.clone();
          fixture.visible = true;
          fixture.position.set(0, 0, 0);
          fixture.quaternion.identity();
          fixture.material = tooth >= 30 ? lowerMats.titanium : upperMats.titanium;
          axis.add(fixture);
          implants.current.push(fixture);
        }
      }
    }
    for (const b of nodes.bones) b.visible = Boolean(anatomy);
    for (const mats of [upperMats, lowerMats]) {
      mats.gum.transparent = Boolean(anatomy);
      mats.gum.opacity = anatomy ? 0.32 : 1;
      mats.gum.depthWrite = !anatomy;
      mats.gum.userData.baseOpacity = mats.gum.opacity;
      mats.gum.needsUpdate = true;
    }
  }, [content.teeth, nodes, anatomy, upperMats, lowerMats]);

  useFrame((_, delta) => {
    if (opening.current < 1) {
      opening.current = skip.current ? 1 : Math.min(1, opening.current + (delta * 1000) / INTRO_MS);
    }
    nodes.pivot.rotation.x = OPEN_ANGLE * easeInOut(opening.current);
    const hidden = capture ? 0 : 0.08;
    const target = { upper: view === 'lower' ? hidden : 1, lower: view === 'upper' ? hidden : 1 };
    const k = capture ? 1 : Math.min(1, delta * 8);
    fades.current.upper += (target.upper - fades.current.upper) * k;
    fades.current.lower += (target.lower - fades.current.lower) * k;
    setFade(Object.values(upperMats), fades.current.upper);
    setFade(Object.values(lowerMats), fades.current.lower);
    nodes.maxilla.visible = fades.current.upper > 0.02;
    nodes.mandible.visible = fades.current.lower > 0.02;
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (readOnly || !onTooth) return;
    const m = /^tooth_(\d{2})_/.exec(e.object.name);
    if (!m) return;
    e.stopPropagation();
    onTooth(Number(m[1]), pointAnchor(e.nativeEvent.clientX, e.nativeEvent.clientY));
  };

  return (
    <>
      <primitive object={gltf.scene} onClick={handleClick} />
      <CameraRig nodes={nodes} view={view} opening={opening} capture={Boolean(capture)} onReady={() => setReady(true)} />
      {tier !== 'low' && <Shadows nodes={nodes} />}
      {ready && (
        <Markers
          nodes={nodes}
          elements={elements}
          visual={visual}
          selectedKey={selectedKey ?? null}
          highlight={highlight ?? null}
          readOnly={Boolean(readOnly)}
          capture={Boolean(capture)}
          fades={fades}
          onElement={onElement}
          onHover={onHover}
        />
      )}
      <Furcations nodes={nodes} content={content} view={view} />
      {capture && <CaptureSignal view={view} />}
    </>
  );
}

function assignMaterials(group: THREE.Object3D, mats: JawMaterials) {
  group.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const n = o.name;
    if (n.endsWith('_crown')) o.material = mats.enamel;
    else if (n.endsWith('_root')) o.material = mats.root;
    else if (n.startsWith('gum_') || n.startsWith('ridge_') || n.startsWith('gingiva')) o.material = mats.gum;
    else if (n.startsWith('bone')) o.material = mats.bone;
    else if (n.startsWith('implant')) o.material = mats.titanium;
  });
}

function Shadows({ nodes }: { nodes: JawNodes }) {
  const y = useMemo(() => {
    const box = new THREE.Box3().setFromObject(nodes.root);
    return box.min.y - 0.004;
  }, [nodes]);
  return <ContactShadows position={[0, y, 0]} opacity={0.32} scale={0.3} blur={2.6} far={0.12} resolution={512} color="#3a3340" />;
}

interface Preset {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

function computePresets(nodes: JawNodes, aspect: number): Record<ViewKey, Preset> {
  const prev = nodes.pivot.rotation.x;
  nodes.pivot.rotation.x = OPEN_ANGLE;
  nodes.root.updateMatrixWorld(true);
  const upper = new THREE.Box3().setFromObject(nodes.maxilla).getCenter(new THREE.Vector3());
  const lower = new THREE.Box3().setFromObject(nodes.mandible).getCenter(new THREE.Vector3());
  nodes.pivot.rotation.x = prev;
  nodes.root.updateMatrixWorld(true);
  const mid = upper.clone().add(lower).multiplyScalar(0.5);
  const far = aspect < 1 ? Math.min(1.9, 0.9 / aspect) : 1;
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).multiplyScalar(far);
  const lowerNormal = new THREE.Vector3(0, Math.cos(OPEN_ANGLE), Math.sin(OPEN_ANGLE));
  return {
    overview: { target: mid.clone().add(new THREE.Vector3(0, 0, 0.004)), position: mid.clone().add(v(0, 0.032, 0.185)) },
    upper: { target: upper.clone(), position: upper.clone().add(v(0, -0.135, 0.04)) },
    lower: {
      target: lower.clone(),
      position: lower.clone().add(lowerNormal.multiplyScalar(0.135 * far)).add(new THREE.Vector3(0, 0, 0.04 * far)),
    },
    right: { target: mid.clone().add(new THREE.Vector3(-0.012, 0, -0.006)), position: mid.clone().add(v(-0.15, 0.012, 0.035)) },
    left: { target: mid.clone().add(new THREE.Vector3(0.012, 0, -0.006)), position: mid.clone().add(v(0.15, 0.012, 0.035)) },
    front: { target: mid.clone().add(new THREE.Vector3(0, 0, 0.02)), position: mid.clone().add(v(0, 0.004, 0.16)) },
  };
}

function CameraRig({
  nodes,
  view,
  opening,
  capture,
  onReady,
}: {
  nodes: JawNodes;
  view: ViewKey;
  opening: MutableRefObject<number>;
  capture: boolean;
  onReady: () => void;
}) {
  const { camera, size } = useThree();
  const controls = useRef<OrbitControlsImpl>(null);
  const aspect = size.width / Math.max(1, size.height);
  const presets = useMemo(() => computePresets(nodes, aspect), [nodes, aspect]);
  const tween = useRef<{ from: Preset; to: Preset; t: number; ms: number } | null>(null);
  const started = useRef(false);

  useEffect(() => {
    const to = presets[view];
    if (!started.current) {
      started.current = true;
      if (opening.current < 1) {
        // начало: модель в смыкании, камера спереди ближе, затем переход в обзор вместе с раскрытием
        const from = {
          position: to.position.clone().add(new THREE.Vector3(0, -0.02, -0.05)),
          target: to.target.clone().add(new THREE.Vector3(0, 0.012, 0)),
        };
        camera.position.copy(from.position);
        tween.current = { from, to, t: 0, ms: INTRO_MS };
      } else {
        camera.position.copy(to.position);
        controls.current?.target.copy(to.target);
        tween.current = null;
      }
      onReady();
      return;
    }
    const from = { position: camera.position.clone(), target: controls.current?.target.clone() ?? to.target.clone() };
    tween.current = capture ? null : { from, to, t: 0, ms: VIEW_MS };
    if (capture) {
      camera.position.copy(to.position);
      controls.current?.target.copy(to.target);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, presets]);

  useFrame((_, delta) => {
    const c = controls.current;
    const tw = tween.current;
    if (tw && c) {
      tw.t = Math.min(1, tw.t + (delta * 1000) / tw.ms);
      const k = easeInOut(tw.t);
      camera.position.lerpVectors(tw.from.position, tw.to.position, k);
      c.target.lerpVectors(tw.from.target, tw.to.target, k);
      if (tw.t >= 1) tween.current = null;
    }
    c?.update();
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      enableDamping
      dampingFactor={0.12}
      rotateSpeed={0.55}
      zoomSpeed={0.7}
      minDistance={0.07}
      maxDistance={0.34}
      minPolarAngle={0.06}
      maxPolarAngle={Math.PI - 0.06}
      minAzimuthAngle={-Math.PI * 0.62}
      maxAzimuthAngle={Math.PI * 0.62}
      onStart={() => (tween.current = null)}
    />
  );
}

interface MarkersProps {
  nodes: JawNodes;
  elements: MapElement[];
  visual: ThreeViewProps['visual'];
  selectedKey: string | null;
  highlight: ReadonlySet<string> | null;
  readOnly: boolean;
  capture: boolean;
  fades: MutableRefObject<{ upper: number; lower: number }>;
  onElement: ThreeViewProps['onElement'];
  onHover: ThreeViewProps['onHover'];
}

/** HTML-маркеры над якорями: чёткие, постоянного экранного размера, приглушаются, если смотрят от камеры. */
function Markers({ nodes, elements, visual, selectedKey, highlight, readOnly, capture, fades, onElement, onHover }: MarkersProps) {
  const refs = useRef(new Map<string, HTMLElement>());
  const { camera } = useThree();
  const shown = elements.filter((e) => e.active || !readOnly);
  const tmp = useMemo(() => ({ p: new THREE.Vector3(), n: new THREE.Vector3(), c: new THREE.Vector3() }), []);

  useFrame(() => {
    for (const el of shown) {
      const node = refs.current.get(el.key);
      const anchor = anchorFor(nodes, el);
      if (!node || !anchor) continue;
      anchor.getWorldPosition(tmp.p);
      anchor.getWorldDirection(tmp.n);
      tmp.c.copy(camera.position).sub(tmp.p).normalize();
      const facing = tmp.n.dot(tmp.c);
      const jawFade = el.arch === 'upper' ? fades.current.upper : fades.current.lower;
      const visible = facing > -0.45 && jawFade > 0.5;
      const opacity = !visible ? (capture ? 0 : 0.12) : facing > -0.15 ? 1 : 0.55;
      node.style.opacity = String(opacity);
      node.style.pointerEvents = visible ? 'auto' : 'none';
    }
  });

  return (
    <>
      {shown.map((el) => {
        const anchor = anchorFor(nodes, el);
        if (!anchor) return null;
        const v = visual(el);
        const dimmed = Boolean(highlight && !highlight.has(el.key));
        const marker = (
          <svg width="40" height="40" viewBox="-20 -20 40 40" aria-hidden="true">
            <SvgMarker x={0} y={-2} r={11} data={el.data} visual={v} active={el.active} selected={selectedKey === el.key} dimmed={dimmed} />
          </svg>
        );
        return (
          <Fragment key={el.key}>
          {createPortal(
          <Html center zIndexRange={[20, 0]}>
            <div
              ref={(n) => {
                if (n) refs.current.set(el.key, n);
                else refs.current.delete(el.key);
              }}
              className={capture ? `${s.markerWrap} ${s.captureWrap}` : s.markerWrap}
            >
              {readOnly || !onElement ? (
                <span className={s.marker}>{marker}</span>
              ) : (
                <button
                  type="button"
                  data-key={el.key}
                  className={s.marker}
                  aria-label={`${el.kind === 'edge' ? 'Поверхность' : 'Промежуток'} ${el.label}`}
                  aria-pressed={selectedKey === el.key}
                  onClick={(e) => onElement(el.key, e.currentTarget)}
                  onPointerEnter={(e) => e.pointerType === 'mouse' && onHover?.(el.key, e.currentTarget)}
                  onPointerLeave={(e) => e.pointerType === 'mouse' && onHover?.(null, null)}
                >
                  {marker}
                </button>
              )}
              {capture && el.active && (v.label || el.data.alternative) && (
                <span className={s.captureLabel}>{v.label ?? (el.data.alternative === 'FLOSS' ? 'нить' : '—')}</span>
              )}
            </div>
          </Html>,
          anchor,
        )}
          </Fragment>
        );
      })}
    </>
  );
}

function Furcations({ nodes, content, view }: { nodes: JawNodes; content: ThreeViewProps['content']; view: ViewKey }) {
  const marked = Object.entries(content.teeth).filter(
    ([tooth, t]) => t.furcation && t.state !== 'MISSING' && !(view === 'upper' && Number(tooth) > 30) && !(view === 'lower' && Number(tooth) < 30),
  );
  return (
    <>
      {marked.map(([tooth]) => {
        const anchor = nodes.anchors.get(`fx_${tooth}`);
        if (!anchor) return null;
        return (
          <Fragment key={tooth}>
          {createPortal(
          <Html center zIndexRange={[15, 0]}>
            <span className={s.furcation} title={`Фуркация ${tooth}`} aria-label={`Открытая фуркация, зуб ${tooth}`}>
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path d="M9 15V9M9 9 4 3M9 9l5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
              </svg>
            </span>
          </Html>,
          anchor,
        )}
          </Fragment>
        );
      })}
    </>
  );
}

/** Сигнал для сервиса рендера: модель загружена и отрисована. */
function CaptureSignal({ view }: { view: ViewKey }) {
  const frames = useRef(0);
  useEffect(() => {
    frames.current = 0;
    window.__sanabilisReady = false;
  }, [view]);
  useFrame(() => {
    frames.current++;
    if (frames.current === 3) window.__sanabilisReady = true;
  });
  useEffect(() => () => void (window.__sanabilisReady = false), []);
  return null;
}

useGLTF.preload(MODEL_URL, false, true);
