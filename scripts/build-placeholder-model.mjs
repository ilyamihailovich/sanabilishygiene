// TODO(модель клиники): временная модель-заглушка. Заменяется файлом от моделлера по docs/3d-model-spec.md.
// Структура (имена, иерархия, якоря, пивот) соответствует ТЗ, чтобы загрузчик и сцена работали без изменений.
// Запуск: node scripts/build-placeholder-model.mjs public/models/jaws.glb
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// GLTFExporter в Node: минимальный FileReader поверх Blob
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buf) => {
      this.result = buf;
      this.onloadend?.();
    });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((buf) => {
      this.result = `data:${blob.type};base64,${Buffer.from(buf).toString('base64')}`;
      this.onloadend?.();
    });
  }
};

const out = process.argv[2] ?? 'public/models/jaws.glb';

const ORDER = {
  upper: [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28],
  lower: [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38],
};
const idx = (t) => t % 10;
// ширина, глубина, высота коронки, длина корня (мм) — усреднённые пропорции для заглушки
const DIM = {
  upper: { w: [8.5, 6.6, 7.6, 7.0, 6.6, 10.2, 9.2, 8.6], d: [7.0, 6.2, 8.0, 9.0, 9.0, 11.0, 10.8, 10.5], h: [10.5, 9.0, 10.0, 8.5, 7.8, 7.5, 7.0, 6.5], r: [13, 13, 17, 14, 14, 13, 12, 11] },
  lower: { w: [5.2, 5.8, 6.8, 7.0, 7.1, 11.0, 10.4, 10.0], d: [5.8, 6.0, 7.5, 7.6, 8.0, 10.4, 10.1, 9.8], h: [9.0, 9.5, 11.0, 8.5, 8.0, 7.5, 7.0, 6.5], r: [12.5, 14, 16, 14, 14, 14, 13, 11] },
};
const ARCH = { upper: { rx: 25.5, ry: 41, cz: -6 }, lower: { rx: 24, ry: 38, cz: -5.5 } };
const GAP = 0.35;
const OCCLUSAL = 0.25;

function archLayout(arch) {
  const a = ARCH[arch];
  const from = (200 * Math.PI) / 180;
  const to = (-20 * Math.PI) / 180;
  const N = 3000;
  const pts = [];
  let s = 0;
  let prev = null;
  for (let i = 0; i <= N; i++) {
    const t = from + ((to - from) * i) / N;
    // пациент справа — отрицательный X; передние зубы — положительный Z
    const p = { x: a.rx * Math.cos(t), z: a.cz + a.ry * Math.sin(t) };
    if (prev) s += Math.hypot(p.x - prev.x, p.z - prev.z);
    pts.push({ ...p, s });
    prev = p;
  }
  const at = (target) => {
    let i = pts.findIndex((p) => p.s >= target);
    if (i < 1) i = 1;
    const p = pts[i];
    const q = pts[i - 1];
    const tx = p.x - q.x;
    const tz = p.z - q.z;
    const len = Math.hypot(tx, tz) || 1;
    let nx = tz / len;
    let nz = -tx / len;
    if (p.x * nx + (p.z - a.cz) * nz < 0) {
      nx = -nx;
      nz = -nz;
    }
    return { x: p.x, z: p.z, tx: tx / len, tz: tz / len, nx, nz };
  };
  const total = pts[pts.length - 1].s;
  const dim = DIM[arch];
  const widths = ORDER[arch].map((t) => dim.w[idx(t) - 1] + GAP);
  const scale = total / widths.reduce((x, y) => x + y, 0);
  let cursor = 0;
  return ORDER[arch].map((tooth, i) => {
    const slot = widths[i] * scale;
    const center = cursor + slot / 2;
    cursor += slot;
    return { tooth, s: center, slot, ...at(center), at };
  });
}

function outline(tooth, w, d) {
  const i = idx(tooth);
  const n = i >= 6 ? 3.2 : i >= 4 ? 2.3 : i === 3 ? 2.1 : 2.4;
  const shape = new THREE.Shape();
  const steps = 48;
  for (let k = 0; k <= steps; k++) {
    const t = (k / steps) * Math.PI * 2;
    const c = Math.cos(t);
    const sn = Math.sin(t);
    let x = (w / 2) * Math.sign(c) * Math.abs(c) ** (2 / n);
    let y = (d / 2) * Math.sign(sn) * Math.abs(sn) ** (2 / n);
    if (i === 3 && y > 0) x *= 1 - 0.25 * (y / (d / 2)); // клык: сужение к вестибулярной стороне
    if (k === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  return shape;
}

/** Коронка: экструзия окклюзионного контура со скруглением, бугры, сужение к шейке и режущему краю. */
function crownGeometry(tooth, arch) {
  const i = idx(tooth);
  const dim = DIM[arch];
  const w = dim.w[i - 1];
  const d = dim.d[i - 1];
  const h = dim.h[i - 1];
  const bevel = Math.min(w, d) * 0.22;
  const g = new THREE.ExtrudeGeometry(outline(tooth, w - bevel * 1.6, d - bevel * 1.6), {
    depth: h - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.8,
    bevelSegments: 6,
    curveSegments: 32,
    steps: 6,
  });
  // экструзия вдоль Z → высота по +Y, контур в плоскости XZ (x — вдоль дуги, +z — вестибулярно)
  g.rotateX(Math.PI / 2);
  g.translate(0, h - bevel, 0);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  for (let k = 0; k < pos.count; k++) {
    v.fromBufferAttribute(pos, k);
    const t = THREE.MathUtils.clamp(v.y / h, 0, 1); // 0 — шейка, 1 — жевательная поверхность
    const cervical = 0.82 + 0.18 * Math.sin(Math.min(t, 0.6) / 0.6 * Math.PI / 2);
    let sx = cervical;
    let sz = cervical;
    if (i <= 2) sz *= 1 - 0.62 * t ** 1.6; // резцы: режущий край
    if (i === 3) {
      sx *= 1 - 0.45 * t ** 2.2;
      sz *= 1 - 0.4 * t ** 2;
    }
    v.x *= sx;
    v.z *= sz;
    if (t > 0.7 && i >= 4) {
      // бугры жевательных зубов
      const cx = Math.cos((v.x / (w / 2)) * Math.PI * (i >= 6 ? 1 : 0.5));
      const cz = Math.cos((v.z / (d / 2)) * Math.PI);
      v.y += (t - 0.7) * h * 0.18 * (cx * cz - 0.4);
    }
    if (i === 3 && t > 0.75) v.y += (t - 0.75) * h * 0.25 * (1 - Math.abs(v.x) / (w / 2));
    pos.setXYZ(k, v.x, v.y, v.z);
  }
  const merged = mergeVertices(g.deleteAttribute('uv') && g, 0.02);
  merged.computeVertexNormals();
  return { geometry: merged, h, w, d };
}

function rootGeometry(tooth, arch, w, d) {
  const i = idx(tooth);
  const len = DIM[arch].r[i - 1];
  const parts = [];
  const count = i >= 6 ? (arch === 'upper' ? 3 : 2) : arch === 'upper' && i === 4 ? 2 : 1;
  for (let k = 0; k < count; k++) {
    const r = (Math.min(w, d) * (count === 1 ? 0.36 : 0.22));
    const c = new THREE.CylinderGeometry(r * 0.25, r, len, 20, 6);
    c.translate(0, -len / 2, 0);
    const spread = count === 1 ? 0 : w * 0.24;
    const offX = count === 1 ? 0 : (k === 0 ? -spread : k === 1 ? spread : 0);
    const offZ = count === 3 && k === 2 ? -d * 0.25 : count >= 2 ? d * 0.08 : 0;
    c.rotateZ(offX ? Math.sign(offX) * 0.08 : 0);
    c.translate(offX, 0.2, offZ);
    parts.push(c);
  }
  const g = mergeGeometries(parts.map((p) => p.toNonIndexed()));
  g.computeVertexNormals();
  return g;
}

/** Сегмент десны вокруг шейки с сосочками по краям; ridge — без лунки и сосочков. Тело закрывает корни. */
function gumGeometry(slot, d, ridge) {
  const W = slot + 1.4;
  const D = d * 1.6;
  const H = 13;
  const g = new THREE.BoxGeometry(W, H, D, 18, 16, 16);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  for (let k = 0; k < pos.count; k++) {
    v.fromBufferAttribute(pos, k);
    const top = (v.y + H / 2) / H; // 0 — у основания, 1 — у десневого края
    const ex = (v.x / (W / 2)) ** 2;
    // поперечное сечение: мягкий валик у края, к основанию стенки сходятся
    const roundTop = Math.sqrt(Math.max(0, 1 - Math.max(0, (top - 0.7) / 0.3) ** 2));
    const roundBase = Math.sqrt(Math.max(0, 1 - Math.max(0, (0.25 - top) / 0.25) ** 2));
    const taper = 0.8 + 0.2 * top;
    v.z *= taper * (0.7 + 0.3 * roundTop) * (0.55 + 0.45 * roundBase);
    if (top > 0.6) {
      const ez = (v.z / (D / 2)) ** 2;
      const scallop = ridge ? -1.4 * (1 - 0.5 * ez) : -2.4 * (1 - ex) * (1 - 0.6 * ez) + 0.7 * ex;
      v.y += scallop * ((top - 0.6) / 0.4);
    }
    pos.setXYZ(k, v.x, v.y, v.z);
  }
  g.deleteAttribute('uv');
  const merged = mergeVertices(g, 0.01);
  merged.computeVertexNormals();
  merged.translate(0, -H / 2, 0);
  return merged;
}

function implantGeometry() {
  const parts = [];
  const body = new THREE.CylinderGeometry(2.0, 1.6, 10, 32, 1);
  body.translate(0, -5, 0);
  parts.push(body.toNonIndexed());
  for (let k = 0; k < 9; k++) {
    const ring = new THREE.TorusGeometry(1.95 - k * 0.04, 0.22, 8, 32);
    ring.rotateX(Math.PI / 2);
    ring.translate(0, -1.2 - k * 1.0, 0);
    parts.push(ring.toNonIndexed());
  }
  const abut = new THREE.CylinderGeometry(1.4, 1.9, 2.2, 32);
  abut.translate(0, 1.1, 0);
  parts.push(abut.toNonIndexed());
  const g = mergeGeometries(parts);
  g.computeVertexNormals();
  return g;
}

/** Правая тройка осей: X по касательной (при необходимости развёрнут), Y задан, Z — наружу. */
function basisFor(t, y, outward) {
  let x = t.clone();
  let z = new THREE.Vector3().crossVectors(x, y);
  if (z.dot(outward) < 0) {
    x = x.negate();
    z = new THREE.Vector3().crossVectors(x, y);
  }
  return new THREE.Matrix4().makeBasis(x, y, z.normalize());
}

/** Отражение по Y с сохранением направления граней. */
function flipY(g) {
  g.scale(1, -1, 1);
  const index = g.index;
  if (index) {
    for (let k = 0; k < index.count; k += 3) {
      const a = index.getX(k + 1);
      index.setX(k + 1, index.getX(k + 2));
      index.setX(k + 2, a);
    }
  }
  g.computeVertexNormals();
  return g;
}

const mat = (name, color) => new THREE.MeshStandardMaterial({ name, color, roughness: 0.5 });
const M = {
  enamel: mat('mat_enamel', 0xeee8da),
  root: mat('mat_root', 0xe6dcc6),
  gum: mat('mat_gingiva', 0xe8a6a2),
  bone: mat('mat_bone', 0xf3efe8),
  ti: mat('mat_titanium', 0x8d9096),
};

function placeTooth(group, layoutItem, arch) {
  const { tooth, x, z, tx, tz, nx, nz } = layoutItem;
  const sign = arch === 'upper' ? 1 : -1; // вверх от окклюзионной плоскости — верхняя челюсть
  const crown = crownGeometry(tooth, arch);
  const node = new THREE.Group();
  node.name = `tooth_${tooth}`;
  // локальный базис: X — по касательной, Y — длинная ось к коронке, Z — наружу
  const basis = basisFor(new THREE.Vector3(tx, 0, tz), new THREE.Vector3(0, -sign, 0), new THREE.Vector3(nx, 0, nz));
  node.quaternion.setFromRotationMatrix(basis);
  // наклон резцов вперёд
  const i = idx(tooth);
  const tilt = i <= 3 ? (arch === 'upper' ? 0.22 : 0.12) * (1 - (i - 1) * 0.25) : 0;
  // наклон коронки вестибулярно: поворот вокруг локальной X в сторону +Z
  node.rotateX(tilt);
  node.position.set(x, sign * (OCCLUSAL + crown.h), z);
  // коронка строится от шейки (y=0) к жевательной поверхности (y=h): ось +Y узла направлена к коронке
  const crownMesh = new THREE.Mesh(crown.geometry, M.enamel);
  crownMesh.name = `tooth_${tooth}_crown`;
  const rootMesh = new THREE.Mesh(rootGeometry(tooth, arch, crown.w, crown.d), M.root);
  rootMesh.name = `tooth_${tooth}_root`;
  node.add(crownMesh, rootMesh);
  group.add(node);
  return { node, crown };
}

function empty(name, position, normal) {
  const o = new THREE.Object3D();
  o.name = name;
  o.position.copy(position);
  if (normal) {
    const z = normal.clone().normalize();
    const y = new THREE.Vector3(0, 1, 0);
    const x = new THREE.Vector3().crossVectors(y, z).normalize();
    o.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, new THREE.Vector3().crossVectors(z, x), z));
  }
  return o;
}

function buildArch(arch) {
  const group = new THREE.Group();
  group.name = arch === 'upper' ? 'maxilla' : 'mandible';
  const gums = new THREE.Group();
  gums.name = arch === 'upper' ? 'gingiva_upper' : 'gingiva_lower';
  const bones = [];
  const layout = archLayout(arch);
  const sign = arch === 'upper' ? 1 : -1;
  const placed = new Map();

  for (const item of layout) {
    const { crown } = placeTooth(group, item, arch);
    placed.set(item.tooth, { item, crown });
    const margin = sign * (OCCLUSAL + crown.h * 0.78);
    const basis = basisFor(new THREE.Vector3(item.tx, 0, item.tz), new THREE.Vector3(0, 1, 0), new THREE.Vector3(item.nx, 0, item.nz));
    for (const ridge of [false, true]) {
      // верх сегмента (y=0) на уровне десневого края, тело уходит к корням
      const g = gumGeometry(item.slot, crown.d, ridge);
      if (sign > 0) flipY(g);
      const mesh = new THREE.Mesh(g, M.gum);
      mesh.name = `${ridge ? 'ridge' : 'gum'}_${item.tooth}`;
      mesh.quaternion.setFromRotationMatrix(basis);
      mesh.position.set(item.x, margin + sign * (ridge ? 0.4 : 0), item.z);
      gums.add(mesh);
    }
    const b = new THREE.BoxGeometry(item.slot + 0.4, 20, crown.d * 1.35, 2, 2, 2);
    b.translate(0, sign * 10, 0);
    b.applyMatrix4(basis);
    b.translate(item.x, margin + sign * 1.5, item.z);
    bones.push(b.toNonIndexed());

    // якоря зуба
    const n = new THREE.Vector3(item.nx, 0, item.nz);
    const t = new THREE.Vector3(item.tx, 0, item.tz);
    const papilla = margin + sign * 0.6;
    for (const surf of ['m', 'd']) {
      const towardNext = (surf === 'm') === (ORDER[arch].indexOf(item.tooth) < 8);
      const p = new THREE.Vector3(item.x, papilla, item.z)
        .addScaledVector(t, (towardNext ? 1 : -1) * (crown.w / 2))
        .addScaledVector(n, crown.d * 0.62);
      group.add(empty(`px_${item.tooth}_${surf}`, p, n));
    }
    const axis = empty(`ax_${item.tooth}`, new THREE.Vector3(item.x, sign * (OCCLUSAL + crown.h), item.z));
    axis.quaternion.setFromRotationMatrix(basisFor(t, new THREE.Vector3(0, -sign, 0), n));
    group.add(axis);
    const i = idx(item.tooth);
    if (i >= 6 || (arch === 'upper' && i === 4)) {
      group.add(empty(`fx_${item.tooth}`, new THREE.Vector3(item.x, margin, item.z).addScaledVector(n, crown.d * 0.55), n));
    }
  }

  // межзубные промежутки: середина между соседями на уровне сосочка, с вестибулярной стороны
  for (let k = 0; k + 1 < layout.length; k++) {
    const a = placed.get(layout[k].tooth);
    const b = placed.get(layout[k + 1].tooth);
    const p = layout[k].at((a.item.s + b.item.s) / 2);
    const margin = sign * (OCCLUSAL + Math.min(a.crown.h, b.crown.h) * 0.78 + 0.6);
    const n = new THREE.Vector3(p.nx, 0, p.nz);
    const depth = Math.min(a.crown.d, b.crown.d) * 0.62;
    group.add(empty(`ip_${a.item.tooth}_${b.item.tooth}`, new THREE.Vector3(p.x, margin, p.z).addScaledVector(n, depth), n));
    group.add(empty(`ipo_${a.item.tooth}_${b.item.tooth}`, new THREE.Vector3(p.x, margin, p.z).addScaledVector(n, -depth), n.clone().negate()));
  }

  const bone = new THREE.Mesh(mergeGeometries(bones), M.bone);
  bone.name = arch === 'upper' ? 'bone_upper' : 'bone_lower';
  bone.geometry.computeVertexNormals();
  group.add(gums, bone);
  return group;
}

const root = new THREE.Group();
root.name = 'root';
const maxilla = buildArch('upper');
const mandible = buildArch('lower');
const pivot = new THREE.Group();
pivot.name = 'mandible_pivot';
// шарнирная ось ВНЧС: позади и выше дуги
pivot.position.set(0, 24, -42);
mandible.position.set(0, -24, 42);
pivot.add(mandible);
const implant = new THREE.Mesh(implantGeometry(), M.ti);
implant.name = 'implant_fixture';

root.add(maxilla, pivot, implant);
root.userData.placeholder = 'TODO: временная модель, заменить моделью клиники';
// миллиметры → метры
root.scale.setScalar(0.001);
const scene = new THREE.Scene();
scene.add(root);
scene.updateMatrixWorld(true);

const glb = await new GLTFExporter().parseAsync(scene, { binary: true, onlyVisible: false });
await mkdir(path.dirname(out), { recursive: true });
await writeFile(out, Buffer.from(glb));
console.log(`Записано ${out}: ${(glb.byteLength / 1024).toFixed(0)} КБ`);
