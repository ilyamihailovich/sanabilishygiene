import type { Document } from '@/generated/prisma/client';
import { listElements, usedCatalogIds } from '@/domain/brushMap';
import { summarizePsr } from '@/domain/psr';
import { hasTodo } from '@/content/styleRules';
import { brushMapSchema } from '@/schemas/brushMap';
import { psrSchema } from '@/schemas/psr';
import { filledDocumentSchema } from '@/schemas/template';
import { itemProblems } from '@/domain/templateItems';
import { db } from '../db';

export interface Blocker {
  documentId: string | null;
  message: string;
}

const docTitle: Record<Document['type'], string> = {
  BRUSH_MAP: 'Карта ёршиков',
  PSR: 'Скрининг',
  PERIO_CHART: 'Пародонтограмма',
  HYGIENE_PLAN: 'Схема гигиены',
  AFTERCARE: 'Памятка',
};

export async function visitBlockers(visitId: string): Promise<Blocker[]> {
  const visit = await db().visit.findUnique({ where: { id: visitId }, include: { documents: true } });
  if (!visit) return [{ documentId: null, message: 'Визит не найден' }];
  const blockers: Blocker[] = [];
  if (!visit.documents.length) blockers.push({ documentId: null, message: 'В визите нет документов' });
  if (!visit.clinicianId) blockers.push({ documentId: null, message: 'Не указан врач' });

  for (const doc of visit.documents) {
    const title = docTitle[doc.type];
    if (doc.type === 'BRUSH_MAP') {
      const content = brushMapSchema.parse(doc.content);
      const ids = usedCatalogIds(content);
      if (ids.length) {
        const sizes = await db().brushSize.findMany({ where: { id: { in: ids } } });
        const ok = new Set(sizes.filter((s) => s.verified && !s.archived).map((s) => s.id));
        const bad = listElements(content).filter(
          (e) => e.active && e.data.size && 'catalogId' in e.data.size && !ok.has(e.data.size.catalogId),
        );
        if (bad.length) {
          blockers.push({
            documentId: doc.id,
            message: `${title}: размеры не проверены в каталоге (${bad.map((e) => e.label).join(', ')})`,
          });
        }
      }
      if (!listElements(content).some((e) => e.active && (e.data.size || e.data.alternative))) {
        blockers.push({ documentId: doc.id, message: `${title}: не назначен ни один размер` });
      }
    }
    if (doc.type === 'PSR') {
      const summary = summarizePsr(psrSchema.parse(doc.content));
      if (summary.filled === 0) {
        blockers.push({ documentId: doc.id, message: `${title}: не заполнен` });
      } else if (summary.maxCode !== null) {
        const codes = [String(summary.maxCode), ...(summary.asterisk ? ['*'] : [])];
        const texts = await db().psrText.findMany({ where: { code: { in: codes } } });
        for (const code of codes) {
          const t = texts.find((x) => x.code === code);
          if (!t || !t.approved || hasTodo(t.patientText)) {
            blockers.push({ documentId: doc.id, message: `${title}: текст для кода ${code} не утверждён врачом` });
          }
        }
      }
    }
    if (doc.type === 'HYGIENE_PLAN' || doc.type === 'AFTERCARE') {
      const content = filledDocumentSchema.parse(doc.content);
      const problems = content.sections
        .filter((s) => s.enabled)
        .flatMap((s) => s.items.map((i) => ({ section: s.title, problem: itemProblems(i) })))
        .filter((p) => p.problem);
      if (problems.length) {
        blockers.push({
          documentId: doc.id,
          message: `${content.title}: ${problems.length} ${problems.length === 1 ? 'пункт требует' : 'пунктов требуют'} заполнения (${[
            ...new Set(problems.map((p) => p.section)),
          ].join(', ')})`,
        });
      }
    }
  }
  return blockers;
}
