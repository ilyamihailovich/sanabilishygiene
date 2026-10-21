import { Prisma, type Template } from '@/generated/prisma/client';
import type { TemplateKind } from '@/generated/prisma/enums';
import { lintPatientText, type StyleIssue } from '@/content/styleRules';
import { filledDocumentSchema, templateStructureSchema, type TemplateItem, type TemplateStructure } from '@/schemas/template';
import { audit } from '../audit';
import type { CurrentSession } from '../auth/session';
import { db } from '../db';
import { badRequest, forbidden, notFound } from '../http';
import { can } from '../rbac';
import { itemTexts } from '@/domain/templateItems';

export function canEditTemplate(session: CurrentSession, t: Pick<Template, 'ownerId'>): boolean {
  if (t.ownerId === null) return can(session.user.role, 'template.library');
  return t.ownerId === session.user.id && can(session.user.role, 'template.personal');
}

export function canUseTemplate(session: CurrentSession, t: Pick<Template, 'ownerId'>): boolean {
  return t.ownerId === null || t.ownerId === session.user.id;
}

export async function listTemplates(session: CurrentSession, kind?: TemplateKind) {
  return db().template.findMany({
    where: { ...(kind ? { kind } : {}), OR: [{ ownerId: null }, { ownerId: session.user.id }] },
    orderBy: [{ status: 'asc' }, { sortOrder: 'asc' }, { title: 'asc' }],
    include: { versions: { orderBy: { version: 'desc' }, take: 1, select: { version: true, createdAt: true } } },
  });
}

export async function getEditableTemplate(session: CurrentSession, id: string) {
  const t = await db().template.findUnique({
    where: { id },
    include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
  });
  if (!t || !canUseTemplate(session, t)) throw notFound('Шаблон не найден');
  return t;
}

export function currentStructure(t: { draft: unknown; versions: Array<{ structure: unknown }> }): TemplateStructure {
  const raw = t.draft ?? t.versions[0]?.structure ?? { schema: 1, sections: [] };
  return templateStructureSchema.parse(raw);
}

export async function createTemplate(
  session: CurrentSession,
  input: { kind: TemplateKind; title: string; library: boolean; structure?: TemplateStructure; copiedFromId?: string },
) {
  if (input.library && !can(session.user.role, 'template.library')) throw forbidden();
  if (!input.library && !can(session.user.role, 'template.personal')) throw forbidden();
  const structure = input.structure ?? { schema: 1 as const, sections: [] };
  const template = await db().template.create({
    data: {
      kind: input.kind,
      title: input.title,
      ownerId: input.library ? null : session.user.id,
      copiedFromId: input.copiedFromId ?? null,
      publishedVersion: 1,
      versions: { create: { version: 1, structure: structure as Prisma.InputJsonValue, createdById: session.user.id } },
    },
  });
  await audit({ userId: session.user.id, action: 'template.create', entityType: 'template', entityId: template.id });
  return template;
}

export async function saveDraft(session: CurrentSession, id: string, structure: TemplateStructure, title?: string) {
  const t = await getEditableTemplate(session, id);
  if (!canEditTemplate(session, t)) throw forbidden();
  await db().template.update({
    where: { id },
    data: { draft: structure as Prisma.InputJsonValue, ...(title ? { title } : {}) },
  });
}

export function lintStructure(structure: TemplateStructure): Array<{ itemId: string; issues: StyleIssue[] }> {
  return structure.sections.flatMap((s) =>
    s.items
      .map((item) => ({
        itemId: item.id,
        issues: [s.title, ...itemTexts({ ...item, enabled: true, selected: [], value: '' } as never)].flatMap(lintPatientText),
      }))
      .filter((x) => x.issues.length),
  );
}

/** Новая неизменяемая версия; выданные документы ссылаются на свою версию и не меняются. */
export async function publish(session: CurrentSession, id: string) {
  const t = await getEditableTemplate(session, id);
  if (!canEditTemplate(session, t)) throw forbidden();
  if (!t.draft) throw badRequest('Нет изменений для публикации');
  const structure = templateStructureSchema.parse(t.draft);
  const version = (t.versions[0]?.version ?? 0) + 1;
  await db().$transaction([
    db().templateVersion.create({
      data: { templateId: id, version, structure: structure as Prisma.InputJsonValue, createdById: session.user.id },
    }),
    db().template.update({ where: { id }, data: { draft: Prisma.DbNull, publishedVersion: version } }),
  ]);
  const lint = lintStructure(structure);
  await audit({
    userId: session.user.id,
    action: 'template.publish',
    entityType: 'template',
    entityId: id,
    meta: { version, lintWarnings: lint.reduce((n, x) => n + x.issues.length, 0) },
  });
  return { version, lint };
}

export async function setArchived(session: CurrentSession, id: string, archived: boolean) {
  const t = await getEditableTemplate(session, id);
  if (!canEditTemplate(session, t)) throw forbidden();
  await db().template.update({ where: { id }, data: { status: archived ? 'ARCHIVED' : 'ACTIVE' } });
  await audit({ userId: session.user.id, action: 'template.archive', entityType: 'template', entityId: id, meta: { archived } });
}

export async function copyTemplate(session: CurrentSession, id: string, library: boolean) {
  const t = await getEditableTemplate(session, id);
  return createTemplate(session, {
    kind: t.kind,
    title: `${t.title} (копия)`,
    library,
    structure: currentStructure(t),
    copiedFromId: t.id,
  });
}

/** Личный шаблон из заполненного документа: только включённые пункты, без значений. */
export async function templateFromDocument(session: CurrentSession, documentId: string, title: string) {
  const doc = await db().document.findUnique({ where: { id: documentId } });
  if (!doc || (doc.type !== 'HYGIENE_PLAN' && doc.type !== 'AFTERCARE')) throw notFound('Документ не найден');
  const filled = filledDocumentSchema.parse(doc.content);
  const structure: TemplateStructure = {
    schema: 1,
    sections: filled.sections
      .filter((s) => s.enabled)
      .map((s) => ({
        id: s.id,
        title: s.title,
        items: s.items
          .filter((i) => i.enabled)
          .map(({ enabled: _e, selected: _s, value: _v, ...item }) => item as TemplateItem),
      })),
  };
  return createTemplate(session, { kind: doc.type, title, library: false, structure });
}
