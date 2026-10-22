// Сборка интерактивного прототипа в один HTML-файл: node demo/build.mjs <out.html> [pdf-1.png pdf-2.png ...]
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { build } from 'esbuild';
import { MeshoptDecoder } from 'meshoptimizer';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// node demo/build.mjs out.html pdf-врача-1.png ... --public pdf-по-ссылке-1.png ...
const [out = 'prototype.html', ...rest] = process.argv.slice(2);
const split = rest.indexOf('--public');
const pages = split < 0 ? rest : rest.slice(0, split);
const publicPages = split < 0 ? [] : rest.slice(split + 1);
const shim = (name) => resolve(root, 'demo/shims', name);

const result = await build({
  entryPoints: [resolve(root, 'demo/entry.tsx')],
  bundle: true,
  format: 'iife',
  jsx: 'automatic',
  write: false,
  outdir: 'out',
  minifyWhitespace: true,
  minifySyntax: true,
  legalComments: 'none',
  loader: { '.module.css': 'local-css', '.svg': 'text', '.jpg': 'dataurl' },
  define: { 'process.env.NODE_ENV': '"production"' },
  tsconfig: resolve(root, 'tsconfig.json'),
  alias: {
    'next/navigation': shim('next-navigation.ts'),
    'next/link': shim('next-link.tsx'),
    'next/dynamic': shim('next-dynamic.tsx'),
  },
  // Шрифт клиники лицензирован и в прототип не встраивается: только системные шрифты
  external: ['/fonts.css'],
});

const js = result.outputFiles.find((f) => f.path.endsWith('.js')).text;
const css = result.outputFiles.find((f) => f.path.endsWith('.css'))?.text ?? '';
// В песочнице артефакта запрещены fetch и, возможно, WebAssembly: модель встраивается без сжатия meshopt
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const model = await io.read(resolve(root, 'public/models/jaws.glb'));
for (const ext of model.getRoot().listExtensionsUsed()) if (ext.extensionName === 'EXT_meshopt_compression') ext.dispose();
const glb = Buffer.from(await io.writeBinary(model)).toString('base64');
const toData = (p) => `data:image/png;base64,${readFileSync(p).toString('base64')}`;
const pdf = pages.map(toData);
const pdfPublic = publicPages.map(toData);
const esc = (s) => s.replace(/<\/script/gi, '<\\/script');

// Каркас документа (doctype, head, body) добавляет хостинг артефактов
const html = `<title>Прототип SANABILIS Гигиена</title>
<meta name="robots" content="noindex">
<style>:root{color-scheme:light}${css}</style>
<div id="root"></div>
<script>window.__SANABILIS_MODEL_DATA=${JSON.stringify(glb)};window.__DEMO_PDF_PAGES=${JSON.stringify(pdf)};window.__DEMO_PDF_PAGES_PUBLIC=${JSON.stringify(pdfPublic)};</script>
<script>${esc(js)}</script>
`;
writeFileSync(out, html);
console.log(`${out}: ${(html.length / 1024 / 1024).toFixed(2)} MB`);
