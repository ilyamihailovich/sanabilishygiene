import * as THREE from 'three';

export type QualityTier = 'high' | 'mid' | 'low';

/*
  Материалы задаются в коде, параметры из файла модели игнорируются.
  Зубы: слоновая кость, глянец эмали с бликами (лак), лёгкое просвечивание режущего края;
  десна: влажная поверхность с мягким бликом;
  кость в «Анатомии»: молочный акрил; имплантат: сатиновый титан без хрома.
*/
export function createMaterials(tier: QualityTier) {
  const physical = tier !== 'low';
  const enamel = physical
    ? new THREE.MeshPhysicalMaterial({
        // светлее и чуть самосветящаяся: эмаль не уходит в серое в тени
        color: '#fcf8ef',
        emissive: new THREE.Color('#fff6e6'),
        emissiveIntensity: 0.08,
        roughness: 0.2,
        metalness: 0,
        ior: 1.62,
        specularIntensity: 1,
        clearcoat: 1,
        clearcoatRoughness: 0.07,
        sheen: 0.1,
        sheenRoughness: 0.6,
        sheenColor: new THREE.Color('#fffaf0'),
        ...(tier === 'high'
          ? { transmission: 0.12, thickness: 0.0025, attenuationColor: new THREE.Color('#f1dfc0'), attenuationDistance: 0.006 }
          : {}),
      })
    : new THREE.MeshStandardMaterial({ color: '#faf5ea', emissive: new THREE.Color('#fff6e6'), emissiveIntensity: 0.08, roughness: 0.24 });
  const root = physical
    ? new THREE.MeshPhysicalMaterial({ color: '#e6d9bf', roughness: 0.55, sheen: 0.2, sheenColor: new THREE.Color('#f5ecd8') })
    : new THREE.MeshStandardMaterial({ color: '#e6d9bf', roughness: 0.6 });
  const gum = physical
    ? new THREE.MeshPhysicalMaterial({
        color: '#ec9c9e',
        roughness: 0.42,
        sheen: 0.6,
        sheenRoughness: 0.45,
        sheenColor: new THREE.Color('#f9d3cf'),
        clearcoat: 0.45,
        clearcoatRoughness: 0.28,
      })
    : new THREE.MeshStandardMaterial({ color: '#efa4a4', roughness: 0.6 });
  const bone = new THREE.MeshPhysicalMaterial({
    color: '#f4f1eb',
    roughness: 0.75,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const titanium = new THREE.MeshStandardMaterial({ color: '#8f9297', metalness: 0.82, roughness: 0.4 });
  return { enamel, root, gum, bone, titanium };
}

export type JawMaterials = ReturnType<typeof createMaterials>;

/** Прозрачность для затухания челюсти в ракурсах «Верхняя» и «Нижняя». */
export function setFade(materials: THREE.Material[], opacity: number) {
  for (const m of materials) {
    const base = (m.userData.baseOpacity as number | undefined) ?? (m.userData.baseOpacity = m.opacity);
    m.opacity = base * opacity;
    const transparent = opacity < 0.999 || base < 1;
    if (m.transparent !== transparent) {
      m.transparent = transparent;
      m.needsUpdate = true;
    }
    m.depthWrite = !transparent;
  }
}
