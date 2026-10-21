import type { DocumentType } from '@/generated/prisma/enums';
import type { Prisma } from '@/generated/prisma/client';
import { computeBoib, emptyBrushMap } from '@/domain/brushMap';
import { emptyPsr, summarizePsr } from '@/domain/psr';
import { brushMapSchema, type BrushMapContent } from '@/schemas/brushMap';
import { psrSchema } from '@/schemas/psr';
import { filledDocumentSchema, templateStructureSchema, type FilledDocument, type TemplateStructure } from '@/schemas/template';
import { audit } from '../audit';
import { db } from '../db';
import { HttpError, badRequest, conflict, notFound } from '../http';

export function parseContent(type: DocumentType, raw: unknown) {
  switch (type) {
    case 'BRUSH_MAP':
      return brushMapSchema.parse(raw);
    case 'PSR':
      return psrSchema.parse(raw);
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

export function fillFromTemplate(templateId: string, version: number, title: string, structure: TemplateStructure): FilledDocument {
  return {
    schema: 1,
    templateId,
    templateVersion: version,
    title,
    sections: structure.sections.map((section) => ({
      ...section,
      enabled: true,
      items: section.items.map((item) => ({ ...item, enabled: true, selected: [], value: '' })),
    })),
  };
}

/** Новая карта на основе прошлой: формула и размеры сохраняются, отметки осмотра сбрасываются. */
export function carryOverBrushMap(previous: BrushMapContent): BrushMapContent {
  const elements = Object.fromEntries(
    Object.entries(previous.elements).map(([key, data]) => [key, { ...data, bleeding: null, pain: false }]),
  );
  return { ...previous, elements };
}

const SINGLE: DocumentType[] = ['BRUSH_MAP', 'PSR', 'HYGIENE_PLAN'];

export async function createDocument(visitId: string, type: DocumentType, templateId: string | null, userId: string) {
  const visit = await db().visit.findUnique({ where: { id: visitId }, include: { documents: true } });
  if (!visit) throw notFound('Визит не найден');
  if (SINGLE.includes(type) && visit.documents.some((d) => d.type === type)) throw conflict('Такой документ уже есть в визите');

  let content: unknown;
  let templateVersionId: string | null = null;
  if (type === 'BRUSH_MAP') content = emptyBrushMap();
  else if (type === 'PSR') content = emptyPsr();
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
