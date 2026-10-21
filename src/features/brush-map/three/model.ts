import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three-stdlib';
import type { MapElement } from '@/domain/brushMap';

declare global {
  interface Window {
    /** Модель, встроенная в страницу как base64 GLB без meshopt (интерактивный прототип без сервера). */
    __SANABILIS_MODEL_DATA?: string;
  }
}

export const MODEL_URL = '/models/jaws.glb';
export const INLINE_MODEL = typeof window !== 'undefined' ? window.__SANABILIS_MODEL_DATA : undefined;

let inlinePromise: Promise<GLTF> | null = null;
/** Разбор встроенной модели без сетевых запросов: в песочнице прототипа fetch запрещён. */
export function inlineModel(data: string): Promise<GLTF> {
  inlinePromise ??= new GLTFLoader().parseAsync(Uint8Array.from(atob(data), (c) => c.charCodeAt(0)).buffer, '');
  return inlinePromise;
}
/** Угол раскрытия, рад. Рекомендуемый угол из записки моделлера заменит это значение. */
export const OPEN_ANGLE = 0.36;

export interface JawNodes {
  root: THREE.Object3D;
  maxilla: THREE.Object3D;
  mandible: THREE.Object3D;
  pivot: THREE.Object3D;
  implant: THREE.Mesh | null;
  teeth: Map<number, { node: THREE.Object3D; crown: THREE.Mesh | null; root: THREE.Mesh | null }>;
  gums: Map<number, { gum: THREE.Mesh | null; ridge: THREE.Mesh | null }>;
  bones: THREE.Mesh[];
  anchors: Map<string, THREE.Object3D>;
}

export function indexNodes(scene: THREE.Object3D): JawNodes {
  const byName = new Map<string, THREE.Object3D>();
  scene.traverse((o) => byName.set(o.name, o));
  const get = (n: string) => byName.get(n) ?? null;
  const teeth = new Map<number, { node: THREE.Object3D; crown: THREE.Mesh | null; root: THREE.Mesh | null }>();
  const gums = new Map<number, { gum: THREE.Mesh | null; ridge: THREE.Mesh | null }>();
  const anchors = new Map<string, THREE.Object3D>();
  for (const [name, o] of byName) {
    const tooth = /^tooth_(\d{2})$/.exec(name);
    if (tooth) {
      const t = Number(tooth[1]);
      teeth.set(t, { node: o, crown: get(`${name}_crown`) as THREE.Mesh | null, root: get(`${name}_root`) as THREE.Mesh | null });
      gums.set(t, { gum: get(`gum_${t}`) as THREE.Mesh | null, ridge: get(`ridge_${t}`) as THREE.Mesh | null });
    }
    if (/^(ip|ipo|px|ax|fx)_/.test(name)) anchors.set(name, o);
  }
  return {
    root: scene,
    maxilla: get('maxilla') ?? scene,
    mandible: get('mandible') ?? get('mandible_pivot') ?? scene,
    pivot: get('mandible_pivot') ?? scene,
    implant: get('implant_fixture') as THREE.Mesh | null,
    teeth,
    gums,
    bones: ['bone_upper', 'bone_lower'].map(get).filter((x): x is THREE.Mesh => x instanceof THREE.Mesh),
    anchors,
  };
}

/** Якорь маркера элемента карты: ip_A_B, px_T_m/d; для дополнительных — оральная точка промежутка. */
export function anchorFor(nodes: JawNodes, el: Pick<MapElement, 'kind' | 'teeth' | 'surface' | 'key'>): THREE.Object3D | null {
  if (el.kind === 'edge') return nodes.anchors.get(`px_${el.teeth[0]}_${el.surface}`) ?? null;
  const [a, b] = el.teeth;
  if (el.kind === 'interspace') return nodes.anchors.get(`ip_${a}_${b}`) ?? nodes.anchors.get(`ip_${b}_${a}`) ?? null;
  return (
    nodes.anchors.get(`ipo_${a}_${b}`) ?? nodes.anchors.get(`ipo_${b}_${a}`) ?? nodes.anchors.get(`ip_${a}_${b}`) ?? nodes.anchors.get(`ip_${b}_${a}`) ?? null
  );
}
