import type { Side } from '@/domain/perio';

/*
  Силуэты зубов сбоку для графика пародонтограммы, в миллиметрах.
  Начало координат — эмалево-цементная граница по центру зуба; +y — к режущему краю (коронка), −y — к верхушке корня.
  Размеры усреднённые анатомические: важны пропорции и положение границы, а не точный контур конкретного зуба.
*/

interface Dims {
  /** ширина шейки у эмалево-цементной границы */
  neck: number;
  /** наибольшая ширина коронки */
  crownW: number;
  crownH: number;
  rootL: number;
}

const UPPER: Record<number, Dims> = {
  1: { neck: 6.4, crownW: 8.5, crownH: 10.5, rootL: 13 },
  2: { neck: 5, crownW: 6.5, crownH: 9, rootL: 13 },
  3: { neck: 5.5, crownW: 7.5, crownH: 10, rootL: 17 },
  4: { neck: 5, crownW: 7, crownH: 8.5, rootL: 14 },
  5: { neck: 5, crownW: 6.8, crownH: 8, rootL: 14 },
  6: { neck: 7.5, crownW: 10, crownH: 7.5, rootL: 12.5 },
  7: { neck: 7, crownW: 9, crownH: 7, rootL: 11.5 },
  8: { neck: 6.5, crownW: 8.5, crownH: 6.5, rootL: 10 },
};

const LOWER: Record<number, Dims> = {
  1: { neck: 3.5, crownW: 5, crownH: 9, rootL: 12.5 },
  2: { neck: 4, crownW: 5.5, crownH: 9.5, rootL: 14 },
  3: { neck: 5.5, crownW: 7, crownH: 11, rootL: 16 },
  4: { neck: 5, crownW: 7, crownH: 8.5, rootL: 14 },
  5: { neck: 5, crownW: 7, crownH: 8, rootL: 14.5 },
  6: { neck: 8, crownW: 11, crownH: 7.5, rootL: 14 },
  7: { neck: 7.5, crownW: 10.5, crownH: 7, rootL: 13 },
  8: { neck: 7, crownW: 10, crownH: 6.5, rootL: 11 },
};

export function toothDims(t: number): Dims {
  const n = t % 10;
  return (Math.floor(t / 10) <= 2 ? UPPER : LOWER)[n]!;
}

const f = (v: number) => Math.round(v * 100) / 100;

/** Контур коронки: от шейки к самой широкой части и к режущему краю или буграм. */
function crownPath(t: number, d: Dims): string {
  const n = t % 10;
  const a = d.neck / 2;
  const w = d.crownW / 2;
  const h = d.crownH;
  const sides = `M${f(-a)} 0 C${f(-a - 0.3)} ${f(h * 0.25)} ${f(-w)} ${f(h * 0.4)} ${f(-w)} ${f(h * 0.62)}`;
  const back = `C${f(w)} ${f(h * 0.4)} ${f(a + 0.3)} ${f(h * 0.25)} ${f(a)} 0 Z`;
  let edge: string;
  if (n <= 2) {
    // резцы: ровный режущий край
    edge = `C${f(-w)} ${f(h * 0.85)} ${f(-w * 0.85)} ${f(h)} ${f(-w * 0.6)} ${f(h)} L${f(w * 0.6)} ${f(h)} C${f(w * 0.85)} ${f(h)} ${f(w)} ${f(h * 0.85)} ${f(w)} ${f(h * 0.62)}`;
  } else if (n === 3) {
    // клык: один острый бугор
    edge = `C${f(-w)} ${f(h * 0.78)} ${f(-w * 0.55)} ${f(h * 0.86)} 0 ${f(h)} C${f(w * 0.55)} ${f(h * 0.86)} ${f(w)} ${f(h * 0.78)} ${f(w)} ${f(h * 0.62)}`;
  } else if (n <= 5) {
    // премоляр: один бугор шире клыка
    edge = `C${f(-w)} ${f(h * 0.82)} ${f(-w * 0.5)} ${f(h)} 0 ${f(h)} C${f(w * 0.5)} ${f(h)} ${f(w)} ${f(h * 0.82)} ${f(w)} ${f(h * 0.62)}`;
  } else {
    // моляр: два бугра с бороздой между ними
    edge = `C${f(-w)} ${f(h * 0.88)} ${f(-w * 0.75)} ${f(h)} ${f(-w * 0.45)} ${f(h)} C${f(-w * 0.2)} ${f(h)} ${f(-w * 0.12)} ${f(h * 0.9)} 0 ${f(h * 0.9)} C${f(w * 0.12)} ${f(h * 0.9)} ${f(w * 0.2)} ${f(h)} ${f(w * 0.45)} ${f(h)} C${f(w * 0.75)} ${f(h)} ${f(w)} ${f(h * 0.88)} ${f(w)} ${f(h * 0.62)}`;
  }
  return `${sides} ${edge} ${back}`;
}

/** Один корень: сужается к верхушке, слегка смещённой от центра. */
function singleRoot(x0: number, x1: number, apexX: number, length: number): string {
  const L = -length;
  return `M${f(x0)} 0 C${f(x0)} ${f(L * 0.45)} ${f(apexX - 0.9)} ${f(L * 0.85)} ${f(apexX)} ${f(L)} C${f(apexX + 0.9)} ${f(L * 0.85)} ${f(x1)} ${f(L * 0.45)} ${f(x1)} 0 Z`;
}

/** Два корня из общего ствола: фуркация на 3–4 мм от шейки. */
function twoRoots(d: Dims): string {
  const a = d.neck / 2;
  const L = -d.rootL;
  const furc = -3.5;
  return [
    `M${f(-a)} 0`,
    `C${f(-a - 0.2)} ${f(L * 0.5)} ${f(-a * 0.75)} ${f(L * 0.9)} ${f(-a * 0.55)} ${f(L)}`,
    `C${f(-a * 0.35)} ${f(L * 0.92)} ${f(-a * 0.25)} ${f(L * 0.55)} ${f(-0.6)} ${f(furc - 0.8)}`,
    `C${f(-0.3)} ${f(furc)} ${f(0.3)} ${f(furc)} ${f(0.6)} ${f(furc - 0.8)}`,
    `C${f(a * 0.25)} ${f(L * 0.55)} ${f(a * 0.35)} ${f(L * 0.92)} ${f(a * 0.55)} ${f(L)}`,
    `C${f(a * 0.75)} ${f(L * 0.9)} ${f(a + 0.2)} ${f(L * 0.5)} ${f(a)} 0 Z`,
  ].join(' ');
}

/** Имплантат: абатмент и винт с витками вместо корня. */
function implantPaths(d: Dims): string[] {
  const r = Math.min(d.neck, 5) / 2;
  const L = Math.min(d.rootL, 12);
  const body = `M${f(-r)} 0 L${f(-r)} ${f(-L + 1.2)} Q${f(-r)} ${f(-L)} 0 ${f(-L)} Q${f(r)} ${f(-L)} ${f(r)} ${f(-L + 1.2)} L${f(r)} 0 Z`;
  const threads: string[] = [];
  for (let y = -1.2; y > -L + 1.2; y -= 1.1) threads.push(`M${f(-r)} ${f(y)} L${f(r)} ${f(y - 0.5)}`);
  return [body, threads.join(' ')];
}

export interface ToothShape {
  crown: string;
  roots: string[];
  /** Витки винта имплантата: линии без заливки. */
  threads?: string;
  dims: Dims;
}

export function toothShape(t: number, side: Side, implant: boolean): ToothShape {
  const d = toothDims(t);
  const crown = crownPath(t, d);
  if (implant) {
    const [body, threads] = implantPaths(d);
    return { crown, roots: [body!], threads: threads!, dims: d };
  }
  const n = t % 10;
  const upper = Math.floor(t / 10) <= 2;
  const a = d.neck / 2;
  let roots: string[];
  if (n >= 6) {
    // верхний моляр с нёба виден одним широким нёбным корнем, с щеки — двумя щёчными; нижний — мезиальным и дистальным
    roots = upper && side === 'oral' ? [singleRoot(-a, a, 0, d.rootL * 1.05)] : [twoRoots(d)];
  } else if (upper && n === 4) {
    roots = [twoRoots({ ...d, neck: d.neck * 0.95 })];
  } else roots = [singleRoot(-a, a, 0.3, d.rootL)];
  return { crown, roots, dims: d };
}
