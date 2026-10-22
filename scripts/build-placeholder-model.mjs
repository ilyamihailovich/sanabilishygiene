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
// Зазор между соседними коронками в точке контакта: почти касаются, промежуток ниже образуется сужением к шейке
const GAP = 0.08;
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
  // резцы почти прямоугольные в сечении: соседние смыкаются по всей вестибулярной кромке, без тёмной щели
  const n = i >= 6 ? 3.2 : i >= 4 ? 2.3 : i === 3 ? 2.1 : 4.2;
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
function crownGeometry(tooth, arch, slot) {
  const i = idx(tooth);
  const dim = DIM[arch];
  // ширина коронки по месту на дуге: соседние зубы смыкаются в точке контакта, без щели
  const w = slot ? slot - GAP : dim.w[i - 1];
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
    // Мезиодистально: узкая шейка, наибольшая ширина в зоне контакта (около 70 % высоты) —
    // между соседями остаётся треугольный межзубной промежуток, его заполняет сосочек
    // резцы: шейка шире и контакт ниже — межзубной промежуток узкий, как у центральных резцов в норме
    const contact = i <= 2 ? 0.46 : i === 3 ? 0.78 : 0.68;
    const neck = i <= 2 ? 0.9 : i === 3 ? 0.72 : 0.66;
    const sm = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b);
    let sx = neck + (1 - neck) * sm(0, contact, t) - (i >= 4 ? 0.07 : i === 3 ? 0.02 : 0) * sm(contact, 1, t);
    // Вестибулооральная выпуклость: максимум у шейки и в средней трети
    let sz = 0.86 + 0.14 * Math.sin(Math.min(1, t / 0.45) * Math.PI * 0.5) - (i >= 4 ? 0.16 : 0) * sm(0.55, 1, t);
    if (i <= 2) sz *= 1 - 0.68 * t ** 1.5; // резцы: тонкий режущий край
    if (i === 3) {
      sx *= 1 - 0.42 * t ** 2.2;
      sz *= 1 - 0.38 * t ** 2;
    }
    v.x *= sx;
    v.z *= sz;
    // резцы и клыки: вестибулярная поверхность выпуклая, оральная — вогнутая
    if (i <= 3) v.z += 0.35 * Math.sin(t * Math.PI) * (d / 8);
    if (t > 0.72 && i >= 4) {
      // бугры: премоляры — щёчный и язычный, моляры — четыре; между ними фиссура
      const nxp = v.x / (w / 2);
      const nzp = v.z / (d / 2);
      const k = (t - 0.72) / 0.28;
      const bump = (cx, cz, r) => Math.exp(-((nxp - cx) ** 2 + (nzp - cz) ** 2) / r);
      const cusps =
        i >= 6
          ? bump(-0.45, 0.45, 0.12) + bump(0.45, 0.45, 0.12) + bump(-0.45, -0.45, 0.12) + bump(0.45, -0.45, 0.12)
          : bump(0, 0.5, 0.16) + 0.85 * bump(0, -0.5, 0.16);
      const fissure = Math.exp(-(nzp ** 2) / 0.02) + (i >= 6 ? Math.exp(-(nxp ** 2) / 0.02) * 0.7 : 0);
      v.y += k * h * (0.2 * cusps - 0.09 * fissure - 0.06);
    }
    if (i === 3 && t > 0.72) v.y += (t - 0.72) * h * 0.3 * (1 - Math.abs(v.x) / (w / 2));
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

/*
  Десна: одна непрерывная поверхность вдоль дуги, разрезанная на сегменты по позициям зубов.
  Сечение — валик с лабиальной и оральной стенкой и скруглённым гребнем; высота гребня
  у шейки зуба ниже (десневой край), между зубами выше (сосочек). Сегменты gum_XX и ridge_XX
  одной позиции совпадают на границах по вершинам и нормалям: на стыке высота — у сосочка,
  наклон скаллопа нулевой, поэтому любые сочетания стыкуются без шва (ТЗ, раздел о десне).
*/
const PROFILE = 40;
const ALONG = 26;

/** Сечение в координатах (q — наружу от линии дуги, v — к верхушке корня). */
function gumProfile(wl, wi, crest, base, r) {
  const pts = [];
  const arc = (cx, cy, a0, a1, n) => {
    for (let k = 0; k <= n; k++) {
      const a = a0 + ((a1 - a0) * k) / n;
      pts.push([cx + r * Math.cos(a), cy - r * Math.sin(a)]);
    }
  };
  // альвеолярный валик слегка выпуклый, к основанию сходится
  pts.push([wl * 0.9, base]);
  pts.push([wl * 1.12, base - (base - crest) * 0.4]);
  pts.push([wl * 1.04, base - (base - crest) * 0.75]);
  arc(wl - r, crest + r, 0, Math.PI / 2, 8);
  arc(-(wi - r), crest + r, Math.PI / 2, Math.PI, 8);
  pts.push([-wi * 1.04, base - (base - crest) * 0.75]);
  pts.push([-wi * 1.12, base - (base - crest) * 0.4]);
  pts.push([-wi * 0.9, base]);
  // основание замыкает сечение: десна — цельное тело, как гипсовая модель, без открытого верха
  pts.push([0, base]);
  pts.push([wl * 0.9, base]);
  // равномерная переразбивка по длине, чтобы у всех сечений одинаковое число точек
  const len = [0];
  for (let k = 1; k < pts.length; k++) len.push(len[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
  const total = len[len.length - 1];
  const out = [];
  for (let j = 0; j < PROFILE; j++) {
    const target = (total * j) / (PROFILE - 1);
    // последняя точка — конец сечения: из-за округления findIndex может её не найти
    let k = j === PROFILE - 1 ? len.length - 1 : len.findIndex((l) => l >= target);
    if (k < 1) k = k < 0 ? len.length - 1 : 1;
    const f = (target - len[k - 1]) / (len[k] - len[k - 1] || 1);
    out.push([pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * f, pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * f]);
  }
  return out;
}

/** Параметры дуги десны по длине s: точка, нормаль наружу, ширина и высота гребня. */
function gumField(arch, layout, crowns) {
  const sign = arch === 'upper' ? 1 : -1;
  const at = layout[0].at;
  const total = layout[layout.length - 1].s + layout[layout.length - 1].slot / 2;
  const point = (s) => {
    // за концами дуги — продолжение по касательной
    const c = Math.min(Math.max(s, 0.01), total - 0.01);
    const p = at(c);
    return { ...p, x: p.x + p.tx * (s - c), z: p.z + p.tz * (s - c) };
  };
  const bounds = layout.map((it) => [it.s - it.slot / 2, it.s + it.slot / 2]);
  const papilla = (k) => {
    // высота сосочка на границе k (между зубами k-1 и k) — по более низкой коронке
    const a = crowns[Math.max(0, k - 1)];
    const b = crowns[Math.min(crowns.length - 1, k)];
    return OCCLUSAL + Math.min(a.h, b.h) * 0.5;
  };
  const depthAt = (s) => {
    const k = layout.findIndex((it) => it.s >= s);
    if (k < 0) return crowns[crowns.length - 1].d;
    if (k === 0) return crowns[0].d;
    const f = (s - layout[k - 1].s) / (layout[k].s - layout[k - 1].s);
    return crowns[k - 1].d + (crowns[k].d - crowns[k - 1].d) * f;
  };
  return { sign, point, bounds, papilla, depthAt, total };
}

function gumSegment(field, k, crown, ridge, isFirst, isLast) {
  const [s0, s1] = field.bounds[k];
  const ext = 3.5; // десна за последним зубом закругляется
  const from = isFirst ? s0 - ext : s0;
  const to = isLast ? s1 + ext : s1;
  const pLeft = field.papilla(k);
  const pRight = field.papilla(k + 1);
  const cervical = OCCLUSAL + crown.h * 0.8;
  const surface = (s, j) => {
    const x = THREE.MathUtils.clamp((s - s0) / (s1 - s0), 0, 1);
    // плавный переход между сосочками: наклон на стыке нулевой, нормали соседних сегментов совпадают
    const lerp = pLeft + (pRight - pLeft) * x * x * (3 - 2 * x);
    // скаллоп: у шейки зуба край уходит к корню, у границ — сосочек; наклон на границах нулевой
    const dip = (1 - Math.cos(2 * Math.PI * x)) / 2;
    const crest = lerp + (ridge ? 0.35 : cervical - lerp) * dip;
    // за концами дуги валик сходится в точку
    const endFade =
      isFirst && s < s0 ? Math.sin((Math.max(0, s - from) / (s0 - from)) * Math.PI / 2) : isLast && s > s1 ? Math.cos((Math.min(to - s1, s - s1) / (to - s1)) * Math.PI / 2) : 1;
    const d = field.depthAt(Math.min(Math.max(s, s0), s1));
    // стенка десны прилегает к шейке: чуть шире коронки у шейки
    const w = (d * 0.43 + 0.7) * Math.max(0.04, endFade);
    // общее основание для всех сегментов: сечения соседей на стыке совпадают
    const base = OCCLUSAL + 16;
    // торец дуги сходится и по ширине, и по высоте: без тонкой вертикальной пластины
    const prof = gumProfile(w, w, crest + (1 - endFade) * (base - crest - 0.5), base, Math.min(1.2, w * 0.5));
    let [q, v] = prof[j];
    // объём десны: валик над корнем каждого зуба с вестибулярной стороны; на стыках сегментов он нулевой
    if (!ridge && q > 0 && v > crest) {
      const along = Math.sin(Math.PI * x) ** 2;
      const height = Math.sin(Math.PI * Math.min(1, (v - crest) / (base - crest)));
      q += 0.75 * along * height ** 0.8;
    }
    const p = field.point(s);
    return new THREE.Vector3(p.x + p.nx * q, field.sign * v, p.z + p.nz * q);
  };
  const positions = [];
  const normals = [];
  const eps = 0.4;
  for (let a = 0; a <= ALONG; a++) {
    const s = from + ((to - from) * a) / ALONG;
    for (let j = 0; j < PROFILE; j++) {
      const P = surface(s, j);
      const ds = surface(s + eps, j).sub(surface(s - eps, j));
      const du = surface(s, Math.min(PROFILE - 1, j + 1)).sub(surface(s, Math.max(0, j - 1)));
      const n = new THREE.Vector3().crossVectors(du, ds).normalize().multiplyScalar(field.sign);
      positions.push(P.x, P.y, P.z);
      normals.push(n.x, n.y, n.z);
    }
  }
  const index = [];
  for (let a = 0; a < ALONG; a++) {
    for (let j = 0; j < PROFILE - 1; j++) {
      const i0 = a * PROFILE + j;
      const i1 = i0 + PROFILE;
      if (field.sign > 0) index.push(i0, i0 + 1, i1, i0 + 1, i1 + 1, i1);
      else index.push(i0, i1, i0 + 1, i0 + 1, i1, i1 + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  g.setIndex(index);
  return g;
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
  const crown = crownGeometry(tooth, arch, layoutItem.slot);
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
    // кость под десной: не выше её основания, иначе торчит из-за дуги
    const b = new THREE.BoxGeometry(item.slot + 0.4, 11, crown.d * 1.2, 2, 2, 2);
    b.translate(0, sign * 5.5, 0);
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

  // десна: непрерывные сегменты вдоль дуги
  const crowns = layout.map((it) => placed.get(it.tooth).crown);
  const field = gumField(arch, layout, crowns);
  const segs = layout.map((item, k) => ({
    gum: gumSegment(field, k, crowns[k], false, k === 0, k === layout.length - 1),
    ridge: gumSegment(field, k, crowns[k], true, k === 0, k === layout.length - 1),
  }));
  // На стыке одна нормаль на все четыре сочетания (десна или гребень слева и справа): шва нет ни в одном варианте
  for (let k = 0; k + 1 < segs.length; k++) {
    const sides = [
      [segs[k].gum, ALONG],
      [segs[k].ridge, ALONG],
      [segs[k + 1].gum, 0],
      [segs[k + 1].ridge, 0],
    ];
    for (let j = 0; j < PROFILE; j++) {
      const n = new THREE.Vector3();
      for (const [g, row] of sides) n.add(new THREE.Vector3().fromBufferAttribute(g.attributes.normal, row * PROFILE + j));
      n.normalize();
      for (const [g, row] of sides) g.attributes.normal.setXYZ(row * PROFILE + j, n.x, n.y, n.z);
    }
  }
  layout.forEach((item, k) => {
    for (const ridge of [false, true]) {
      const mesh = new THREE.Mesh(ridge ? segs[k].ridge : segs[k].gum, M.gum);
      mesh.name = `${ridge ? 'ridge' : 'gum'}_${item.tooth}`;
      gums.add(mesh);
    }
  });

  // межзубные промежутки: середина между соседями чуть выше вершины сосочка, с вестибулярной стороны
  for (let k = 0; k + 1 < layout.length; k++) {
    const a = placed.get(layout[k].tooth);
    const b = placed.get(layout[k + 1].tooth);
    const p = layout[k].at((a.item.s + b.item.s) / 2);
    // ёршик вводится между вершиной сосочка и точкой контакта
    const margin = sign * (OCCLUSAL + Math.min(a.crown.h, b.crown.h) * 0.5 - 0.5);
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
