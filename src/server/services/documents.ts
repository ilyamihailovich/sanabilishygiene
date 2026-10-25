import type { DocumentType } from '@/generated/prisma/enums';
import type { Prisma } from '@/generated/prisma/client';
import { computeBoib, emptyBrushMap } from '@/domain/brushMap';
import { carryOverBrushMap, fillFromTemplate } from '@/domain/documents';
import { emptyPsr, summarizePsr } from '@/domain/psr';
import { brushMapSchema, type BrushMapContent } from '@/schemas/brushMap';
import { psrSchema } from '@/schemas/psr';
import { perioSchema } from '@/schemas/perio';
import { emptyPerio } from '@/domain/perio';
import { filledDocumentSchema, templateStructureSchema } from '@/schemas/template';
import { audit } from '../audit';
import { db } from '../db';
import { HttpError, badRequest, conflict, notFound } from '../http';

export function parseContent(type: DocumentType, raw: unknown) {
  switch (type) {
    case 'BRUSH_MAP':
      return brushMapSchema.parse(raw);
    case 'PSR':
      return psrSchema.parse(raw);
    case 'PERIO_CHART':
      return perioSchema.parse(raw);
    case 'HYGIENE_PLAN':
    case 'AFTERCARE':
      return filledDocumentSchema.parse(raw);
  }
}

function metrics(type: DocumentType, content: unknown) {
  if (type === 'BRUSH_MAP') {
    const b = computeBoib(content as BrushMapContent);
    return { boibPct: b.pct, boibBleeding: b.bleeding, boibExamined: b.examined };
  }
  if (type === 'PSR') {
    const s = summarizePsr(psrSchema.parse(content));
    return { psrMaxCode: s.maxCode, psrAsterisk: s.maxCode === null ? null : s.asterisk };
  }
  return {};
}

export { carryOverBrushMap, fillFromTemplate } from '@/domain/documents';

const SINGLE: DocumentType[] = ['BRUSH_MAP', 'PSR', 'PERIO_CHART', 'HYGIENE_PLAN'];

/** Как начать карту ёршиков: чистая карта с формулой, отмеченной перед осмотром, или перенос с прошлого визита. */
export interface MapStart {
  from: 'empty' | 'previous';
  teeth?: BrushMapContent['teeth'];
}

export async function createDocument(visitId: string, type: DocumentType, templateId: string | null, userId: string, start?: MapStart) {
  const visit = await db().visit.findUnique({ where: { id: visitId }, include: { documents: true } });
  if (!visit) throw notFound('Визит не найден');
  if (SINGLE.includes(type) && visit.documents.some((d) => d.type === type)) throw conflict('Такой документ уже есть в визите');

  let content: unknown;
  let templateVersionId: string | null = null;
  if (type === 'BRUSH_MAP') {
    const previous =
      start?.from === 'previous'
        ? await db().document.findFirst({
            where: { type: 'BRUSH_MAP', visit: { patientId: visit.patientId, id: { not: visit.id }, date: { lte: visit.date } } },
            orderBy: { visit: { date: 'desc' } },
          })
        : null;
    if (start?.from === 'previous' && !previous) throw notFound('Прошлой карты ёршиков нет');
    content = previous
      ? carryOverBrushMap(brushMapSchema.parse(previous.content))
      : brushMapSchema.parse({ ...emptyBrushMap(), teeth: { ...emptyBrushMap().teeth, ...start?.teeth } });
  }
  else if (type === 'PSR') content = emptyPsr();
  else if (type === 'PERIO_CHART') {
    // формула из карты ёршиков этого визита: отсутствующие зубы и имплантаты не нужно отмечать второй раз
    const map = visit.documents.find((d) => d.type === 'BRUSH_MAP');
    const teeth = map ? brushMapSchema.parse(map.content).teeth : {};
    const pick = (state: string) => Object.entries(teeth).filter(([, v]) => v.state === state).map(([k]) => Number(k));
    content = emptyPerio({ missing: [...pick('MISSING'), ...pick('PONTIC')], implants: pick('IMPLANT') });
  }
  else {
    if (!templateId) throw badRequest('Выберите шаблон');
    const template = await db().template.findUnique({
      where: { id: templateId },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });
    const version = template?.versions[0];
    if (!template || !version || template.status !== 'ACTIVE') throw notFound('Шаблон не найден');
    if ((type === 'HYGIENE_PLAN') !== (template.kind === 'HYGIENE_PLAN')) throw badRequest('Шаблон другого типа');
    content = fillFromTemplate(template.id, version.version, template.title, templateStructureSchema.parse(version.structure));
    templateVersionId = version.id;
  }

  const doc = await db().document.create({
    data: {
      visitId,
      type,
      templateVersionId,
      content: content as Prisma.InputJsonValue,
      authorId: userId,
      ...metrics(type, content),
    },
  });
  await audit({ userId, action: 'document.create', entityType: 'document', entityId: doc.id, meta: { type, visitId } });
  return doc;
}

export async function saveDocument(id: string, rawContent: unknown, rev: number, userId: string) {
  const doc = await db().document.findUnique({ where: { id } });
  if (!doc) throw notFound('Документ не найден');
  const content = parseContent(doc.type, rawContent);
  const updated = await db().document.updateMany({
    where: { id, rev },
    data: { content: content as Prisma.InputJsonValue, rev: { increment: 1 }, ...metrics(doc.type, content) },
  });
  if (updated.count === 0) {
    const current = await db().document.findUniqueOrThrow({ where: { id } });
    throw new HttpError(409, 'stale', 'Документ изменён на другом устройстве', { rev: String(current.rev) });
  }
  await db().visit.update({ where: { id: doc.visitId }, data: { updatedAt: new Date() } });
  await audit({ userId, action: 'document.update', entityType: 'document', entityId: id });
  return { rev: rev + 1 };
}

export async function deleteDocument(id: string, userId: string) {
  const doc = await db().document.findUnique({ where: { id } });
  if (!doc) throw notFound('Документ не найден');
  await db().document.delete({ where: { id } });
  await audit({ userId, action: 'document.delete', entityType: 'document', entityId: id, meta: { type: doc.type } });
}
