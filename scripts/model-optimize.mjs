// Сжатие модели для веба: дедупликация, сварка вершин, квантование и meshopt.
// node scripts/model-optimize.mjs <вход.glb> <выход.glb>
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error('Использование: node scripts/model-optimize.mjs <вход.glb> <выход.glb>');
  process.exit(1);
}
await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.decoder': MeshoptDecoder,
  'meshopt.encoder': MeshoptEncoder,
});
const doc = await io.read(input);
// prune оставляет пустые узлы-якоря: они нужны сцене
await doc.transform(dedup(), weld(), prune({ keepLeaves: true, keepAttributes: false }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write(output, doc);
const { statSync } = await import('node:fs');
console.log(`${output}: ${(statSync(output).size / 1024).toFixed(0)} КБ`);
