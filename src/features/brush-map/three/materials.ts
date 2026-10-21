import * as THREE from 'three';

export type QualityTier = 'high' | 'mid' | 'low';

/*
  Материалы задаются в коде, параметры из файла модели игнорируются.
  Зубы: слоновая кость, сатин, лёгкое просвечивание режущего края; десна: бледно-розовая, мягкая;
  кость в «Анатомии»: молочный акрил; имплантат: сатиновый титан без хрома.
*/
export function createMaterials(tier: QualityTier) {
  const physical = tier !== 'low';
  const enamel = physical
    ? new THREE.MeshPhysicalMaterial({
        color: '#f6efe1',
        roughness: 0.33,
        metalness: 0,
        ior: 1.62,
        specularIntensity: 0.55,
        clearcoat: 0.22,
        clearcoatRoughness: 0.4,
        sheen: 0.25,
        sheenRoughness: 0.6,
        sheenColor: new THREE.Color('#fffaf0'),
        ...(tier === 'high'
          ? { transmission: 0.12, thickness: 0.0025, attenuationColor: new THREE.Color('#f1dfc0'), attenuationDistance: 0.006 }
          : {}),
      })
    : new THREE.MeshStandardMaterial({ color: '#f4ecdc', roughness: 0.42 });
  const root = physical
    ? new THREE.MeshPhysicalMaterial({ color: '#e6d9bf', roughness: 0.55, sheen: 0.2, sheenColor: new THREE.Color('#f5ecd8') })
    : new THREE.MeshStandardMaterial({ color: '#e6d9bf', roughness: 0.6 });
  const gum = physical
    ? new THREE.MeshPhysicalMaterial({
        color: '#efa4a4',
        roughness: 0.55,
        sheen: 0.55,
        sheenRoughness: 0.5,
        sheenColor: new THREE.Color('#f7cfca'),
        clearcoat: 0.06,
        clearcoatRoughness: 0.6,
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
