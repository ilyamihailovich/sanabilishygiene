'use client';

import { ContactShadows, Environment, Html, Lightformer, OrbitControls, PerformanceMonitor, useGLTF } from '@react-three/drei';
import { Canvas, createPortal, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Component, Fragment, Suspense, use, useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { MapElement } from '@/domain/brushMap';
import { glassClass } from '@/ui/Glass';
import { SvgMarker } from '../scheme/SvgMarker';
import type { ViewKey } from '../useMapKeyboard';
import { createMaterials, setFade, type JawMaterials, type QualityTier } from './materials';
import { INLINE_MODEL, MODEL_URL, OPEN_ANGLE, inlineModel, anchorFor, indexNodes, type JawNodes } from './model';
import { webgl2Available, type ThreeViewProps } from './types';
import s from './three.module.css';

declare global {
  interface Window {
    __sanabilisReady?: boolean;
  }
}

const FOV = 28;
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
    <div className={s.root} data-three-root onPointerDown={() => (skip.current = true)}>
      <Canvas
        className={s.canvas}
        // PDF: 1200 px на 85 мм — около 360 dpi, больше не нужно, а программная отрисовка на сервере дорогая
        dpr={props.capture ? 1 : tier === 'low' ? 1 : tier === 'mid' ? [1, 1.5] : [1, 2]}
        camera={{ fov: FOV, near: 0.005, far: 3, position: [0, 0.01, 0.2] }}
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
            // Схема включается только вручную: колебания частоты кадров (фоновая вкладка, прокрутка) не должны переключать режим
            onFallback={() => setTier('low')}
          />
        )}
        <Lights tier={tier} />
        <SceneBoundary onError={() => onFallback?.('error')}>
          <Suspense fallback={null}>
            <Scene {...props} tier={tier} skip={skip} />
          </Suspense>
        </SceneBoundary>
      </Canvas>
    </div>
  );
}

/** Ошибка загрузки или разбора модели переключает на схему вместо пустого экрана. */
class SceneBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: unknown) {
    console.error('3D model failed', error);
    this.props.onError();
  }
  override render() {
    return this.state.failed ? null : this.props.children;
  }
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
  mirrored,
  focusKey,
  tier,
  skip,
  onElement,
  onTooth,
  onHover,
}: SceneProps) {
  // Источник модели постоянен на всё время работы страницы, порядок хуков не меняется
  const gltf = INLINE_MODEL ? use(inlineModel(INLINE_MODEL)) : useGLTF(MODEL_URL, false, true);
  const nodes = useMemo(() => indexNodes(gltf.scene), [gltf.scene]);
  // зеркало — отражение модели по горизонтали; модель одна на страницу, значение выставляется при каждом рендере сцены
  gltf.scene.scale.x = mirrored ? -1 : 1;
  const upperMats = useMemo(() => createMaterials(tier), [tier]);
  const lowerMats = useMemo(() => createMaterials(tier), [tier]);
  const implants = useRef<THREE.Object3D[]>([]);
  const opening = useRef(intro && !capture && !reducedMotion() ? 0 : 1);
  const fades = useRef({ upper: 1, lower: 1 });
  const [ready, setReady] = useState(false);
  // доворот камеры к выбранному месту: плашка открывается ближе к центру сцены, а не у края
  const [focus, setFocus] = useState<{ point: THREE.Vector3; n: number } | null>(null);
  const focusOn = (obj: THREE.Object3D | null | undefined) => {
    if (!obj || capture) return;
    const point = obj.getWorldPosition(new THREE.Vector3());
    setFocus((f) => ({ point, n: (f?.n ?? 0) + 1 }));
  };

  // курсор диктовки: камера облетает модель к промежутку, который сейчас диктуют
  useEffect(() => {
    if (!focusKey) return;
    const el = elements.find((e) => e.key === focusKey);
    if (el) focusOn(anchorFor(nodes, el));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);

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
      const mats = tooth >= 30 ? lowerMats : upperMats;
      if (parts.crown) parts.crown.material = state === 'IMPLANT' ? mats.implantCrown : state === 'CROWN' ? mats.crown : mats.enamel;
      // коронка: сиреневый ореол — оболочка чуть больше коронки вокруг её центра
      if (state === 'CROWN' && parts.crown) {
        const geo = parts.crown.geometry;
        if (!geo.boundingBox) geo.computeBoundingBox();
        const center = geo.boundingBox!.getCenter(new THREE.Vector3());
        const halo = new THREE.Mesh(geo, mats.crownHalo);
        const s = 1.14;
        halo.scale.setScalar(s);
        halo.position.copy(center).multiplyScalar(1 - s);
        halo.renderOrder = 2;
        halo.raycast = () => undefined;
        halo.onBeforeRender = () => {
          mats.crownHalo.uniforms.uOpacity!.value = mats.crownHalo.opacity;
        };
        parts.crown.add(halo);
        implants.current.push(halo);
      }
      // корни видны только в «Анатомии»: в обычном режиме их закрывают десна и кость
      if (parts.root) parts.root.visible = (state === 'PRESENT' || state === 'CROWN') && Boolean(anatomy);
      const g = nodes.gums.get(tooth);
      const solid = state === 'PRESENT' || state === 'IMPLANT' || state === 'CROWN';
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
          fixture.userData.implantTooth = tooth;
          axis.add(fixture);
          implants.current.push(fixture);
        }
      }
    }
    // окна в десне над имплантатами: десна прозрачна, пока на челюсти есть имплантат
    for (const [mats, lower] of [[upperMats, false], [lowerMats, true]] as const) {
      const has = implants.current.some((o) => o.userData.implantTooth !== undefined && o.userData.implantTooth >= 30 === lower);
      mats.gum.userData.keepTransparent = has;
      mats.gum.userData.keepDepthWrite = true;
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
    // центры окон в десне — по текущему положению имплантатов (челюсть раскрывается и вращается)
    for (const [mats, lower] of [[upperMats, false], [lowerMats, true]] as const) {
      const windows = mats.gum.userData.implantWindows as THREE.Vector4[];
      const count = mats.gum.userData.implantCount as { value: number };
      let n = 0;
      for (const o of implants.current) {
        const tooth = o.userData.implantTooth as number | undefined;
        if (tooth === undefined || tooth >= 30 !== lower || n >= windows.length) continue;
        windowBox.setFromObject(o);
        windowBox.getCenter(windowCenter);
        windows[n++]!.set(windowCenter.x, windowCenter.y, windowCenter.z, windowBox.getSize(windowSize).length() * 0.5);
      }
      count.value = n;
    }
    nodes.maxilla.visible = fades.current.upper > 0.02;
    nodes.mandible.visible = fades.current.lower > 0.02;
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (readOnly || !onTooth) return;
    const m = /^tooth_(\d{2})_/.exec(e.object.name);
    if (!m) return;
    e.stopPropagation();
    focusOn(nodes.anchors.get(`ax_${m[1]}`));
    onTooth(Number(m[1]), pointAnchor(e.nativeEvent.clientX, e.nativeEvent.clientY));
  };

  return (
    <>
      <primitive object={gltf.scene} onClick={handleClick} />
      <CameraRig nodes={nodes} view={view} opening={opening} capture={Boolean(capture)} mirrored={Boolean(mirrored)} focus={focus} onReady={() => setReady(true)} />
      {tier !== 'low' && !capture && <Shadows nodes={nodes} />}
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
          onElement={
            onElement &&
            ((key, target) => {
              const el = elements.find((x) => x.key === key);
              if (el) focusOn(anchorFor(nodes, el));
              onElement(key, target);
            })
          }
          onHover={onHover}
        />
      )}
      {/* фуркация — пометка для врача, пациенту не показывается */}
      {!readOnly && <Furcations nodes={nodes} content={content} view={view} onTooth={onTooth} onOpen={(t) => focusOn(nodes.anchors.get(`fx_${t}`))} />}
      {capture && <CaptureSignal view={view} />}
    </>
  );
}

const windowBox = new THREE.Box3();
const windowCenter = new THREE.Vector3();
const windowSize = new THREE.Vector3();

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
  // плоскость тени — под нижней челюстью в раскрытом положении, иначе при раскрытии челюсть уходит «в тень»
  const y = useMemo(() => {
    const prev = nodes.pivot.rotation.x;
    nodes.pivot.rotation.x = OPEN_ANGLE;
    nodes.root.updateMatrixWorld(true);
    const box = new THREE.Box3();
    nodes.root.traverse((o) => {
      if (o instanceof THREE.Mesh && o.visible && !/_root$|^bone|^implant/.test(o.name)) box.expandByObject(o);
    });
    nodes.pivot.rotation.x = prev;
    nodes.root.updateMatrixWorld(true);
    return box.min.y - 0.006;
  }, [nodes]);
  return <ContactShadows position={[0, y, 0]} opacity={0.32} scale={0.3} blur={2.6} far={0.12} resolution={512} color="#3a3340" />;
}

interface Preset {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

function computePresets(nodes: JawNodes, aspect: number, mirrored: boolean): Record<ViewKey, Preset> {
  const prev = nodes.pivot.rotation.x;
  nodes.pivot.rotation.x = OPEN_ANGLE;
  nodes.root.updateMatrixWorld(true);
  const upper = new THREE.Box3().setFromObject(nodes.maxilla).getCenter(new THREE.Vector3());
  const lower = new THREE.Box3().setFromObject(nodes.mandible).getCenter(new THREE.Vector3());
  // Окклюзионные ракурсы: камера подбирается по проекции челюсти, чтобы обе дуги занимали кадр одинаково
  const points = (obj: THREE.Object3D) => {
    const pts: THREE.Vector3[] = [];
    const p = new THREE.Vector3();
    obj.traverse((o) => {
      // корни, кость и имплантат в окклюзионном виде не видны и в кадр не входят
      if (!(o instanceof THREE.Mesh) || !o.geometry.attributes.position || /_root$|^bone|^implant/.test(o.name)) return;
      const pos = o.geometry.attributes.position;
      const step = Math.max(1, Math.floor(pos.count / 400));
      for (let i = 0; i < pos.count; i += step) pts.push(p.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).clone());
    });
    return pts;
  };
  const upperPts = points(nodes.maxilla);
  const lowerPts = points(nodes.mandible);
  nodes.pivot.rotation.x = prev;
  nodes.root.updateMatrixWorld(true);
  const occlusal = (target: THREE.Vector3, normal: THREE.Vector3, pts: THREE.Vector3[]): Preset => {
    const dir = normal.clone().multiplyScalar(0.96).add(new THREE.Vector3(0, 0, 0.28)).normalize();
    const cam = new THREE.PerspectiveCamera(FOV, aspect, 0.001, 5);
    let t = target.clone();
    let dist = 0.135;
    for (let pass = 0; pass < 3; pass++) {
      cam.position.copy(t).addScaledVector(dir, dist);
      cam.lookAt(t);
      cam.updateMatrixWorld(true);
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      const v3 = new THREE.Vector3();
      for (const q of pts) {
        v3.copy(q).project(cam);
        minX = Math.min(minX, v3.x);
        maxX = Math.max(maxX, v3.x);
        minY = Math.min(minY, v3.y);
        maxY = Math.max(maxY, v3.y);
      }
      // центр проекции в центр кадра, большая сторона — 84 % кадра
      const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
      const halfH = Math.tan((FOV / 2) * (Math.PI / 180)) * dist;
      t = t.clone().addScaledVector(right, ((minX + maxX) / 2) * halfH * aspect).addScaledVector(up, ((minY + maxY) / 2) * halfH);
      dist *= Math.max(maxX - minX, maxY - minY) / 2 / 0.84;
    }
    return { target: t, position: t.clone().addScaledVector(dir, dist) };
  };
  const mid = upper.clone().add(lower).multiplyScalar(0.5);
  const side = mirrored ? -1 : 1;
  const far = aspect < 1 ? Math.min(1.9, 0.9 / aspect) : 1;
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).multiplyScalar(far);
  const lowerNormal = new THREE.Vector3(0, Math.cos(OPEN_ANGLE), Math.sin(OPEN_ANGLE));
  return {
    overview: { target: mid.clone().add(new THREE.Vector3(0, 0, 0.004)), position: mid.clone().add(v(0, 0.032, 0.185)) },
    upper: occlusal(upper, new THREE.Vector3(0, -1, 0), upperPts),
    lower: occlusal(lower, lowerNormal, lowerPts),
    // правая сторона пациента у врача слева (−x), в зеркале — справа
    right: { target: mid.clone().add(new THREE.Vector3(-0.012 * side, 0, -0.006)), position: mid.clone().add(v(-0.15 * side, 0.012, 0.035)) },
    left: { target: mid.clone().add(new THREE.Vector3(0.012 * side, 0, -0.006)), position: mid.clone().add(v(0.15 * side, 0.012, 0.035)) },
    front: { target: mid.clone().add(new THREE.Vector3(0, 0, 0.02)), position: mid.clone().add(v(0, 0.004, 0.16)) },
  };
}

function CameraRig({
  nodes,
  view,
  opening,
  capture,
  mirrored,
  focus,
  onReady,
}: {
  nodes: JawNodes;
  view: ViewKey;
  opening: MutableRefObject<number>;
  capture: boolean;
  mirrored: boolean;
  focus: { point: THREE.Vector3; n: number } | null;
  onReady: () => void;
}) {
  const { camera, size } = useThree();
  const controls = useRef<OrbitControlsImpl>(null);
  const aspect = size.width / Math.max(1, size.height);
  const presets = useMemo(() => computePresets(nodes, aspect, mirrored), [nodes, aspect, mirrored]);
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

  // поворот к выбранному месту: камера облетает челюсть и смотрит на точку снаружи дуги, точка — в центре, чуть ближе
  useEffect(() => {
    const c = controls.current;
    if (!focus || !c || capture) return;
    const p = focus.point;
    const centers = [nodes.maxilla, nodes.mandible].map((o) => new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()));
    const center = centers.reduce((a, b) => (a.distanceTo(p) <= b.distanceTo(p) ? a : b));
    const outward = p.clone().sub(center).setY(0);
    if (outward.lengthSq() < 1e-8) outward.set(0, 0, 1);
    outward.normalize();
    const camDir = camera.position.clone().sub(c.target).normalize();
    const dir = outward.multiplyScalar(0.8).add(camDir.clone().multiplyScalar(0.2));
    dir.y = camDir.y;
    dir.normalize();
    // приближение не накапливается от касания к касанию: не ближе 0,13
    const dist = THREE.MathUtils.clamp(camera.position.distanceTo(c.target) * 0.78, 0.13, 0.3);
    const from = { position: camera.position.clone(), target: c.target.clone() };
    const to = { position: p.clone().addScaledVector(dir, dist), target: p.clone() };
    tween.current = { from, to, t: 0, ms: 900 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.n]);

  useFrame((_, delta) => {
    const c = controls.current;
    const tw = tween.current;
    if (tw && c) {
      tw.t = Math.min(1, tw.t + (delta * 1000) / tw.ms);
      const k = easeInOut(tw.t);
      // облёт вокруг цели: направление по сфере, расстояние отдельно, чтобы камера не проходила сквозь модель
      c.target.lerpVectors(tw.from.target, tw.to.target, k);
      const a = tw.from.position.clone().sub(tw.from.target);
      const b = tw.to.position.clone().sub(tw.to.target);
      const len = THREE.MathUtils.lerp(a.length(), b.length(), k);
      const q = new THREE.Quaternion().setFromUnitVectors(a.clone().normalize(), b.clone().normalize());
      const dir = a.normalize().applyQuaternion(new THREE.Quaternion().slerp(q, k));
      camera.position.copy(c.target).addScaledVector(dir, len);
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
              {!onElement ? (
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

/** Плашка, привязанная к точке модели, не уходит за край сцены: сдвигается внутрь с отступом 12 px. */
function keepInside(el: HTMLElement | null) {
  if (!el) return;
  const root = el.closest('[data-three-root]');
  if (!root) return;
  const M = 12;
  let dx = 0;
  let dy = 0;
  const tick = () => {
    if (!el.isConnected) return;
    const r = el.getBoundingClientRect();
    const c = root.getBoundingClientRect();
    const left = r.left - dx;
    const top = r.top - dy;
    dx = left < c.left + M ? c.left + M - left : left + r.width > c.right - M ? c.right - M - (left + r.width) : 0;
    dy = top < c.top + M ? c.top + M - top : top + r.height > c.bottom - M ? c.bottom - M - (top + r.height) : 0;
    el.style.setProperty('--dx', `${dx}px`);
    el.style.setProperty('--dy', `${dy}px`);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function Furcations({
  nodes,
  content,
  view,
  onTooth,
  onOpen,
}: {
  nodes: JawNodes;
  content: ThreeViewProps['content'];
  view: ViewKey;
  onTooth?: ThreeViewProps['onTooth'];
  onOpen: (tooth: string) => void;
}) {
  const marked = Object.entries(content.teeth).filter(
    ([tooth, t]) => t.furcation && t.state !== 'MISSING' && !(view === 'upper' && Number(tooth) > 30) && !(view === 'lower' && Number(tooth) < 30),
  );
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      {marked.map(([tooth]) => {
        const anchor = nodes.anchors.get(`fx_${tooth}`);
        if (!anchor) return null;
        return (
          <Fragment key={tooth}>
          {createPortal(
          <Html center zIndexRange={[24, 21]}>
            {/* компактная метка «Ф»; нажатие показывает пояснение и ведёт в карточку зуба */}
            <span className={s.furcationWrap}>
              <button
                type="button"
                className={s.furcation}
                aria-label={`Открытая фуркация, зуб ${tooth}`}
                aria-expanded={open === tooth}
                onClick={() => {
                  if (open !== tooth) onOpen(tooth);
                  setOpen((o) => (o === tooth ? null : tooth));
                }}
              >
                Ф
              </button>
              {open === tooth && (
                <span ref={keepInside} className={`${glassClass} ${s.furcationTip}`} role="tooltip">
                  <button type="button" className={s.tipClose} aria-label="Закрыть" onClick={() => setOpen(null)}>
                    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                      <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                  </button>
                  <b>Фуркация, зуб {tooth}</b>
                  <span>Открытая фуркация: убыль кости в области разветвления корней многокорневого зуба. Отметка ставится и снимается в карточке зуба.</span>
                  {onTooth && (
                    <button
                      type="button"
                      className={s.furcationLink}
                      onClick={(e) => {
                        setOpen(null);
                        onTooth(Number(tooth), e.currentTarget);
                      }}
                    >
                      Карточка зуба
                    </button>
                  )}
                </span>
              )}
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

if (!INLINE_MODEL) useGLTF.preload(MODEL_URL, false, true);
