import { computeBoib, summarizeSizes } from './brushMap';
import { summarizePerio, type PerioSummary } from './perio';
import { summarizePsr } from './psr';
import { brushMapSchema } from '@/schemas/brushMap';
import { perioSchema } from '@/schemas/perio';
import { SEXTANTS, psrSchema, type PsrCode, type SextantId } from '@/schemas/psr';

/*
  Показатели визита для карточки пациента и отчёта: всё, что можно сравнить между приёмами.
  Считаются из документов визита теми же функциями, что и в редакторах.
*/

export type DocType = 'BRUSH_MAP' | 'PSR' | 'PERIO_CHART' | 'HYGIENE_PLAN' | 'AFTERCARE';

export interface BrushUse {
  ref: string;
  label: string;
  brand: string | null;
  color: string | null;
  count: number;
}

export interface VisitMetrics {
  id: string;
  date: string;
  status: 'DRAFT' | 'ISSUED';
  documents: DocType[];
  lastIssueId: string | null;
  boib: { pct: number | null; bleeding: number; examined: number } | null;
  psr: { max: number | null; star: boolean; sextants: Record<SextantId, PsrCode | null> } | null;
  perio: PerioSummary | null;
  brushes: BrushUse[] | null;
  teeth: { present: number; missing: number; implants: number; crowns: number } | null;
}

export interface CatalogRef {
  label: string;
  brand: string | null;
  color: string;
}

export function visitMetrics(
  visit: { id: string; date: string; status: 'DRAFT' | 'ISSUED'; lastIssueId: string | null },
  documents: Array<{ type: DocType; content: unknown }>,
  catalog: (id: string) => CatalogRef | null,
): VisitMetrics {
  const doc = (t: DocType) => documents.find((d) => d.type === t);
  const mapDoc = doc('BRUSH_MAP');
  const map = mapDoc ? brushMapSchema.safeParse(mapDoc.content) : null;
  const psrDoc = doc('PSR');
  const psr = psrDoc ? psrSchema.safeParse(psrDoc.content) : null;
  const perioDoc = doc('PERIO_CHART');
  const perio = perioDoc ? perioSchema.safeParse(perioDoc.content) : null;

  let teeth: VisitMetrics['teeth'] = null;
  if (map?.success) {
    const states = Object.values(map.data.teeth).map((t) => t.state);
    teeth = {
      present: states.filter((s) => s !== 'MISSING' && s !== 'PONTIC').length,
      missing: states.filter((s) => s === 'MISSING' || s === 'PONTIC').length,
      implants: states.filter((s) => s === 'IMPLANT').length,
      crowns: states.filter((s) => s === 'CROWN').length,
    };
  }

  return {
    ...visit,
    documents: documents.map((d) => d.type),
    boib: map?.success ? computeBoib(map.data) : null,
    psr: psr?.success
      ? (() => {
          const s = summarizePsr(psr.data);
          if (!s.filled) return null;
          return {
            max: s.maxCode,
            star: s.asterisk,
            sextants: Object.fromEntries(SEXTANTS.map(({ id }) => [id, psr.data.sextants[id].code])) as Record<SextantId, PsrCode | null>,
          };
        })()
      : null,
    perio: perio?.success ? summarizePerio(perio.data) : null,
    brushes: map?.success
      ? summarizeSizes(map.data).map((u) => {
          const c = u.catalogId ? catalog(u.catalogId) : null;
          return { ref: u.ref, label: c?.label ?? u.freeText ?? '—', brand: c?.brand ?? null, color: c?.color ?? u.color ?? null, count: u.count };
        })
      : null,
    teeth,
  };
}

/** Разница с предыдущим значением ряда (по визитам от старых к новым), null — сравнивать не с чем. */
export function delta(values: Array<number | null>): number | null {
  const real = values.filter((v): v is number => v !== null);
  if (real.length < 2) return null;
  return Math.round((real[real.length - 1]! - real[real.length - 2]!) * 10) / 10;
}

/** Набор ёршиков: что добавилось и что ушло по сравнению с прошлым визитом с картой. */
export function brushChanges(previous: BrushUse[] | null, current: BrushUse[] | null) {
  if (!previous || !current) return { added: [] as BrushUse[], removed: [] as BrushUse[] };
  const prev = new Set(previous.map((b) => b.ref));
  const cur = new Set(current.map((b) => b.ref));
  return { added: current.filter((b) => !prev.has(b.ref)), removed: previous.filter((b) => !cur.has(b.ref)) };
}
