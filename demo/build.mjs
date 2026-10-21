// Сборка интерактивного прототипа в один HTML-файл: node demo/build.mjs <out.html> [pdf-1.png pdf-2.png ...]
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [out = 'prototype.html', ...pages] = process.argv.slice(2);
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
  loader: { '.module.css': 'local-css', '.svg': 'text' },
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
const glb = readFileSync(resolve(root, 'public/models/jaws.glb')).toString('base64');
const pdf = pages.map((p) => `data:image/png;base64,${readFileSync(p).toString('base64')}`);
const esc = (s) => s.replace(/<\/script/gi, '<\\/script');

// Каркас документа (doctype, head, body) добавляет хостинг артефактов
const html = `<title>Прототип SANABILIS Гигиена</title>
<meta name="robots" content="noindex">
<style>:root{color-scheme:light}${css}</style>
<div id="root"></div>
<script>window.__SANABILIS_MODEL_URL=${JSON.stringify(`data:model/gltf-binary;base64,${glb}`)};window.__DEMO_PDF_PAGES=${JSON.stringify(pdf)};</script>
<script>${esc(js)}</script>
`;
writeFileSync(out, html);
console.log(`${out}: ${(html.length / 1024 / 1024).toFixed(2)} MB`);
