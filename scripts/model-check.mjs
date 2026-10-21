// Проверка 3D-модели по docs/3d-model-spec.md. node scripts/model-check.mjs public/models/jaws.glb
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

const file = process.argv[2] ?? 'public/models/jaws.glb';
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(file);
const nodes = doc.getRoot().listNodes();
const byName = new Map(nodes.map((n) => [n.getName(), n]));
const errors = [];
const warnings = [];

const UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
const ALL = [...UPPER, ...LOWER];
const need = (name) => byName.has(name) || errors.push(`нет объекта ${name}`);

for (const t of ALL) {
  need(`tooth_${t}`);
  need(`tooth_${t}_crown`);
  need(`tooth_${t}_root`);
  if (!byName.has(`gum_${t}`)) warnings.push(`нет сегмента десны gum_${t}`);
  if (!byName.has(`ridge_${t}`)) warnings.push(`нет сегмента ridge_${t}`);
  need(`ax_${t}`);
  need(`px_${t}_m`);
  need(`px_${t}_d`);
}
for (const order of [UPPER, LOWER]) for (let i = 0; i + 1 < order.length; i++) need(`ip_${order[i]}_${order[i + 1]}`);
for (const t of [16, 17, 18, 26, 27, 28, 36, 37, 38, 46, 47, 48, 14, 24]) need(`fx_${t}`);
for (const n of ['bone_upper', 'bone_lower', 'implant_fixture', 'mandible_pivot']) need(n);

// всё нижнее должно быть внутри mandible_pivot
const pivot = byName.get('mandible_pivot');
if (pivot) {
  const inside = new Set();
  const walk = (n) => n.listChildren().forEach((c) => (inside.add(c.getName()), walk(c)));
  walk(pivot);
  for (const t of LOWER) if (!inside.has(`tooth_${t}`)) errors.push(`tooth_${t} вне mandible_pivot`);
  if (!inside.has('bone_lower')) errors.push('bone_lower вне mandible_pivot');
}

let triangles = 0;
for (const mesh of doc.getRoot().listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const idx = prim.getIndices();
    triangles += (idx ? idx.getCount() : prim.getAttribute('POSITION').getCount()) / 3;
  }
}
if (triangles > 400_000) errors.push(`треугольников ${triangles}, бюджет 400 000`);
if (doc.getRoot().listCameras().length) errors.push('в файле есть камеры');
if (doc.getRoot().listAnimations().length) errors.push('в файле есть анимации');

console.log(`Объектов: ${nodes.length}, треугольников: ${Math.round(triangles)}`);
warnings.forEach((w) => console.log(`предупреждение: ${w}`));
if (errors.length) {
  errors.forEach((e) => console.log(`ошибка: ${e}`));
  process.exit(1);
}
console.log('Модель соответствует ТЗ');
