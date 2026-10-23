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
        // отражения студийного света вдвое ярче базовых
        specularIntensity: 2,
        envMapIntensity: 2,
        clearcoat: 1,
        clearcoatRoughness: 0.07,
        sheen: 0.1,
        sheenRoughness: 0.6,
        sheenColor: new THREE.Color('#fffaf0'),
        ...(tier === 'high'
          ? { transmission: 0.12, thickness: 0.0025, attenuationColor: new THREE.Color('#f1dfc0'), attenuationDistance: 0.006 }
          : {}),
      })
    : new THREE.MeshStandardMaterial({ color: '#faf5ea', emissive: new THREE.Color('#fff6e6'), emissiveIntensity: 0.08, roughness: 0.24, envMapIntensity: 2 });
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
  // искусственные коронки: керамика белее эмали и без тёплого оттенка, чтобы отличались от своих зубов;
  // коронка на имплантате — самая белая, с холодным отливом
  const restoration = (color: string, glow: string, intensity: number) =>
    physical
      ? new THREE.MeshPhysicalMaterial({
          color,
          emissive: new THREE.Color(glow),
          emissiveIntensity: intensity,
          roughness: 0.14,
          metalness: 0,
          ior: 1.7,
          specularIntensity: 2,
          envMapIntensity: 2.2,
          clearcoat: 1,
          clearcoatRoughness: 0.05,
        })
      : new THREE.MeshStandardMaterial({ color, emissive: new THREE.Color(glow), emissiveIntensity: intensity, roughness: 0.18, envMapIntensity: 2.2 });
  // коронка — с сиреневым отливом и ореолом (crownHalo), коронка на имплантате — самая белая
  const crown = restoration('#f6f1ff', '#e6d8ff', 0.3);
  const implantCrown = restoration('#ffffff', '#f2f7ff', 0.45);
  const crownHalo = createHalo('#9b6ee0');
  withImplantWindows(gum);
  return { enamel, root, gum, bone, titanium, crown, implantCrown, crownHalo };
}

export type JawMaterials = ReturnType<typeof createMaterials>;

/** Прозрачность для затухания челюсти в ракурсах «Верхняя» и «Нижняя». */
export function setFade(materials: THREE.Material[], opacity: number) {
  for (const m of materials) {
    const base = (m.userData.baseOpacity as number | undefined) ?? (m.userData.baseOpacity = m.opacity);
    m.opacity = base * opacity;
    // keepTransparent: материал прозрачен всегда (ореол) или пока есть окна имплантатов (десна)
    const keep = m.userData.keepTransparent === true;
    const transparent = keep || opacity < 0.999 || base < 1;
    if (m.transparent !== transparent) {
      m.transparent = transparent;
      m.needsUpdate = true;
    }
    m.depthWrite = keep ? m.userData.keepDepthWrite === true && base >= 1 && opacity >= 0.999 : !transparent;
  }
}

/** Мягкий ореол по контуру: оболочка чуть больше зуба, прозрачная в центре и цветная к краям силуэта. */
function createHalo(color: string) {
  const m = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 1 } },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 1.6);
        gl_FragColor = vec4(uColor, rim * 0.9 * uOpacity);
      }`,
    transparent: true,
    depthWrite: false,
  });
  m.userData.keepTransparent = true;
  return m;
}

export const MAX_IMPLANT_WINDOWS = 8;

/**
 * Окна в десне над имплантатами: вокруг центра имплантата десна плавно становится полупрозрачной, внутри виден винт.
 * Центры и радиусы задаются каждый кадр в userData.implantWindows (мировые координаты), число — в userData.implantCount.
 */
function withImplantWindows(m: THREE.Material) {
  const windows = Array.from({ length: MAX_IMPLANT_WINDOWS }, () => new THREE.Vector4(0, 0, 0, 0));
  const count = { value: 0 };
  m.userData.implantWindows = windows;
  m.userData.implantCount = count;
  m.customProgramCacheKey = () => 'gum-implant-windows';
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uImplants = { value: windows };
    shader.uniforms.uImplantCount = count;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vImplantWorld;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvImplantWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vImplantWorld;
        uniform vec4 uImplants[${MAX_IMPLANT_WINDOWS}];
        uniform int uImplantCount;`,
      )
      .replace(
        '#include <opaque_fragment>',
        `#include <opaque_fragment>
        float implantFade = 1.0;
        for (int i = 0; i < ${MAX_IMPLANT_WINDOWS}; i++) {
          if (i >= uImplantCount) break;
          float d = distance(vImplantWorld, uImplants[i].xyz) / uImplants[i].w;
          implantFade = min(implantFade, mix(0.22, 1.0, smoothstep(0.75, 1.45, d)));
        }
        gl_FragColor.a *= implantFade;`,
      );
  };
}
