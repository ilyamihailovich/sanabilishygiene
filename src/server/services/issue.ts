import type { Prisma } from '@/generated/prisma/client';
import { computeBoib, listElements, usedCatalogIds } from '@/domain/brushMap';
import { summarizePsr } from '@/domain/psr';
import { hasTodo } from '@/content/styleRules';
import { brushMapSchema } from '@/schemas/brushMap';
import { psrSchema } from '@/schemas/psr';
import type { IssueSnapshot, SnapshotSize } from '@/schemas/snapshot';
import { filledDocumentSchema, type FilledDocument } from '@/schemas/template';
import { audit } from '../audit';
import { decrypt, encrypt, randomToken, sha256 } from '../crypto';
import { db } from '../db';
import { env } from '../env';
import { HttpError, notFound } from '../http';
import { getSettings } from '../settings';
import { visitBlockers } from './readiness';

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Документ для пациента: только включённые разделы и пункты. */
function trimDocument(doc: FilledDocument): FilledDocument {
  return {
    ...doc,
    sections: doc.sections
      .filter((s) => s.enabled)
      .map((s) => ({ ...s, items: s.items.filter((i) => i.enabled) }))
      .filter((s) => s.items.length > 0),
  };
}

export async function buildSnapshot(visitId: string, issueNumber: number): Promise<IssueSnapshot> {
  const visit = await db().visit.findUniqueOrThrow({ where: { id: visitId }, include: { patient: true, documents: true } });
  const settings = await getSettings();
  const clinician = visit.clinicianId ? await db().user.findUnique({ where: { id: visit.clinicianId } }) : null;

  let brushMap: IssueSnapshot['brushMap'] = null;
  const mapDoc = visit.documents.find((d) => d.type === 'BRUSH_MAP');
  if (mapDoc) {
    const content = brushMapSchema.parse(mapDoc.content);
    const ids = usedCatalogIds(content);
    const rows = await db().brushSize.findMany({ where: { id: { in: ids } }, include: { brand: true } });
    const sizes: Record<string, SnapshotSize> = Object.fromEntries(
      rows.map((r) => [
        r.id,
        { id: r.id, label: r.label, brand: r.brand.name, line: r.line, isoSize: r.isoSize, passageMm: r.passageMm.toString(), colorHex: r.colorHex },
      ]),
    );
    const boib = computeBoib(content);
    const prev = await db().document.findFirst({
      where: { type: 'BRUSH_MAP', boibPct: { not: null }, visit: { patientId: visit.patientId, date: { lt: visit.date } } },
      orderBy: { visit: { date: 'desc' } },
      include: { visit: true },
    });
    const grade =
      boib.pct === null
        ? null
        : await db().boibGrade.findFirst({ where: { approved: true, minPct: { lte: boib.pct }, maxPct: { gte: boib.pct } } });
    brushMap = {
      content,
      sizes,
      boib,
      previousBoib:
        prev && prev.boibPct !== null
          ? { pct: prev.boibPct, bleeding: prev.boibBleeding ?? 0, examined: prev.boibExamined ?? 0, date: iso(prev.visit.date) }
          : null,
      boibText: grade && !hasTodo(grade.patientText) ? grade.patientText : null,
    };
  }

  let psr: IssueSnapshot['psr'] = null;
  const psrDoc = visit.documents.find((d) => d.type === 'PSR');
  if (psrDoc) {
    const content = psrSchema.parse(psrDoc.content);
    const summary = summarizePsr(content);
    const texts = await db().psrText.findMany({ where: { approved: true } });
    const text = (code: string) => texts.find((t) => t.code === code)?.patientText ?? null;
    psr = {
      content,
      summary,
      patientText: summary.maxCode === null ? null : text(String(summary.maxCode)),
      asteriskText: summary.asterisk ? text('*') : null,
    };
  }

  const plan = visit.documents.find((d) => d.type === 'HYGIENE_PLAN');
  const steps = settings.brushSteps.filter((s) => s.trim());
  return {
    schema: 1,
    issueNumber,
    issuedAt: new Date().toISOString(),
    visitDate: iso(visit.date),
    nextVisit: { date: visit.nextVisitDate ? iso(visit.nextVisitDate) : null, months: visit.nextVisitMonths },
    patientName: visit.patient.displayName,
    patientFullName: visit.patient.fullName,
    clinician: clinician ? { name: clinician.displayName, title: clinician.title } : null,
    clinic: settings.clinic,
    brushSteps: steps.length && !steps.some(hasTodo) ? steps : null,
    brushMap,
    psr,
    hygienePlan: plan ? trimDocument(filledDocumentSchema.parse(plan.content)) : null,
    aftercare: visit.documents
      .filter((d) => d.type === 'AFTERCARE')
      .map((d) => trimDocument(filledDocumentSchema.parse(d.content))),
  };
}

export const patientUrl = (token: string) => `${env().APP_URL}/p/${token}`;

async function createLink(visitId: string, userId: string): Promise<string> {
  const token = randomToken();
  await db().shareLink.create({
    data: { visitId, tokenHash: sha256(token), tokenCipher: encrypt(token), createdById: userId },
  });
  return token;
}

export async function activeLinkToken(visitId: string): Promise<string | null> {
  const link = await db().shareLink.findFirst({ where: { visitId, revokedAt: null }, orderBy: { createdAt: 'desc' } });
  return link ? decrypt(link.tokenCipher) : null;
}

export async function issueVisit(visitId: string, userId: string) {
  const blockers = await visitBlockers(visitId);
  if (blockers.length) throw new HttpError(422, 'not_ready', blockers.map((b) => b.message).join('; '));
  const last = await db().visitIssue.findFirst({ where: { visitId }, orderBy: { number: 'desc' } });
  const number = (last?.number ?? 0) + 1;
  const snapshot = await buildSnapshot(visitId, number);
  const issue = await db().visitIssue.create({
    data: { visitId, number, snapshot: snapshot as unknown as Prisma.InputJsonValue, issuedById: userId },
  });
  await db().visit.update({ where: { id: visitId }, data: { status: 'ISSUED' } });
  const token = (await activeLinkToken(visitId)) ?? (await createLink(visitId, userId));
  await audit({ userId, action: 'issue.create', entityType: 'visit', entityId: visitId, meta: { issue: number } });
  return { issue, url: patientUrl(token) };
}

export async function revokeLinks(visitId: string, userId: string) {
  await db().shareLink.updateMany({ where: { visitId, revokedAt: null }, data: { revokedAt: new Date(), revokedById: userId } });
  await audit({ userId, action: 'link.revoke', entityType: 'visit', entityId: visitId });
}

export async function rotateLink(visitId: string, userId: string): Promise<string> {
  const issued = await db().visitIssue.count({ where: { visitId } });
  if (!issued) throw notFound('Визит ещё не выдан');
  await db().shareLink.updateMany({ where: { visitId, revokedAt: null }, data: { revokedAt: new Date(), revokedById: userId } });
  const token = await createLink(visitId, userId);
  await audit({ userId, action: 'link.rotate', entityType: 'visit', entityId: visitId });
  return patientUrl(token);
}

/** Последняя выдача по токену ссылки; null для неизвестной или отозванной ссылки. */
export async function issueByToken(token: string) {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const link = await db().shareLink.findUnique({ where: { tokenHash: sha256(token) } });
  if (!link || link.revokedAt) return null;
  const issue = await db().visitIssue.findFirst({ where: { visitId: link.visitId }, orderBy: { number: 'desc' } });
  return issue ? { issue, link } : null;
}

export function snapshotOf(issue: { snapshot: unknown }): IssueSnapshot {
  return issue.snapshot as IssueSnapshot;
}

/** Снимок для всего, что доступно по ссылке пациента: без ФИО, только имя для обращения. */
export function publicSnapshotOf(issue: { snapshot: unknown }): IssueSnapshot {
  const { patientFullName: _hidden, ...rest } = snapshotOf(issue);
  return rest;
}

export function highlightKeys(snapshot: IssueSnapshot, sizeRef: string): string[] {
  if (!snapshot.brushMap) return [];
  return listElements(snapshot.brushMap.content)
    .filter((e) => {
      const s = e.data.size;
      if (!e.active || !s) return false;
      return 'catalogId' in s ? `c:${s.catalogId}` === sizeRef : `f:${s.freeText.toLowerCase()}` === sizeRef;
    })
    .map((e) => e.key);
}
