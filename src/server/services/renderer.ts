import type { VisitIssue } from '@/generated/prisma/client';
import type { IssueSnapshot } from '@/schemas/snapshot';
import { signInternal } from '../crypto';
import { db } from '../db';
import { env } from '../env';
import { HttpError } from '../http';
import { readData, writeData } from '../storage';

// В PDF идут только окклюзионные ракурсы: каждый лишний ракурс — десятки секунд программной отрисовки
export const RENDER_VIEWS = ['upper', 'lower'] as const;
export type RenderView = (typeof RENDER_VIEWS)[number];

/** staff — PDF для врача (с ФИО), public — PDF по ссылке пациента (только имя). */
export type PdfVariant = 'staff' | 'public';

const internalUrl = (path: string, subject: string, query = '') =>
  `${env().INTERNAL_APP_URL ?? env().APP_URL}${path}?sig=${encodeURIComponent(signInternal(subject, 600))}${query}`;

const pdfPath = (issueId: string, variant: PdfVariant) => `issues/${issueId}/${variant === 'staff' ? 'document' : 'document-public'}.pdf`;

async function callRenderer(path: string, body: unknown, timeoutMs: number): Promise<Response> {
  const res = await fetch(`${env().RENDERER_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`renderer ${path}: ${res.status} ${await res.text()}`);
  return res;
}

/** Рендер ракурсов 3D-сцены в PNG. При ошибке PDF использует векторную схему. */
async function renderViews(issue: VisitIssue): Promise<void> {
  const snapshot = issue.snapshot as unknown as IssueSnapshot;
  if (!snapshot.brushMap) return;
  try {
    const res = await callRenderer(
      '/renders',
      { url: internalUrl(`/render/${issue.id}`, `render:${issue.id}`), views: RENDER_VIEWS },
      300_000,
    );
    const { images } = (await res.json()) as { images: Partial<Record<RenderView, string>> };
    const saved: Partial<Record<RenderView, string>> = {};
    for (const view of RENDER_VIEWS) {
      const b64 = images[view];
      if (!b64) continue;
      const rel = `issues/${issue.id}/${view}.png`;
      await writeData(rel, Buffer.from(b64, 'base64'));
      saved[view] = rel;
    }
    if (Object.keys(saved).length) await db().visitIssue.update({ where: { id: issue.id }, data: { renders: saved } });
  } catch (e) {
    console.error('render views failed, vector scheme will be used', e);
  }
}

async function renderPdf(issueId: string, variant: PdfVariant): Promise<Buffer> {
  let res: Response;
  try {
    const issue = await db().visitIssue.findUniqueOrThrow({ where: { id: issueId } });
    const c = (issue.snapshot as unknown as IssueSnapshot).clinic;
    const footer = `${c.name} · ${c.address} · ${c.phone} · ${c.site}`;
    const url = internalUrl(`/print/${issueId}`, `print:${issueId}:${variant}`, variant === 'public' ? '&variant=public' : '');
    res = await callRenderer('/pdf', { url, footer }, 300_000);
  } catch (e) {
    console.error(e);
    throw new HttpError(503, 'renderer_unavailable', 'Сервис PDF недоступен. Повторите через минуту.');
  }
  const pdf = Buffer.from(await res.arrayBuffer());
  const rel = pdfPath(issueId, variant);
  await writeData(rel, pdf);
  if (variant === 'staff') await db().visitIssue.update({ where: { id: issueId }, data: { pdfPath: rel } });
  return pdf;
}

// Одна генерация на выдачу и вариант: фоновая подготовка и запрос PDF ждут общий результат.
// Ракурсы 3D общие для обоих вариантов и рендерятся один раз.
const inflight = new Map<string, Promise<Buffer>>();
const rendering = new Map<string, Promise<void>>();

function ensureRenders(issueId: string): Promise<void> {
  const existing = rendering.get(issueId);
  if (existing) return existing;
  const job = (async () => {
    const issue = await db().visitIssue.findUniqueOrThrow({ where: { id: issueId } });
    if (!issue.renders) await renderViews(issue);
  })().finally(() => rendering.delete(issueId));
  rendering.set(issueId, job);
  return job;
}

function generate(issueId: string, variant: PdfVariant): Promise<Buffer> {
  const key = `${issueId}:${variant}`;
  const existing = inflight.get(key);
  if (existing) return existing;
  const job = (async () => {
    await ensureRenders(issueId);
    return renderPdf(issueId, variant);
  })().finally(() => inflight.delete(key));
  inflight.set(key, job);
  return job;
}

/** Фоновая подготовка при выдаче: ракурсы и PDF врача. PDF по ссылке собирается при первом запросе из готовых ракурсов. */
export async function prepareIssueFiles(issueId: string): Promise<void> {
  await generate(issueId, 'staff');
}

export async function getIssuePdf(issueId: string, variant: PdfVariant): Promise<Buffer> {
  const cached = await readData(pdfPath(issueId, variant));
  if (cached) return cached;
  return generate(issueId, variant);
}

export function pdfFileName(snapshot: IssueSnapshot): string {
  const [y, m, d] = snapshot.visitDate.split('-');
  return `SANABILIS_Гигиена_${d}-${m}-${y}.pdf`;
}

export function pdfResponse(pdf: Buffer, issue: VisitIssue, inline: boolean): Response {
  const name = pdfFileName(issue.snapshot as unknown as IssueSnapshot);
  const disposition = `${inline ? 'inline' : 'attachment'}; filename="SANABILIS_Hygiene.pdf"; filename*=UTF-8''${encodeURIComponent(name)}`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': disposition,
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

/** PDF-отчёт по пациенту: печатная вёрстка с показателями по визитам. Не кешируется — данные меняются с каждым визитом. */
export async function patientReportPdf(patientId: string): Promise<Buffer> {
  const { getSettings } = await import('../settings');
  const c = (await getSettings()).clinic;
  const footer = `${c.name} · ${c.address} · ${c.phone} · ${c.site}`;
  try {
    const res = await callRenderer('/pdf', { url: internalUrl(`/print/patient/${patientId}`, `patient-report:${patientId}`), footer }, 300_000);
    return Buffer.from(await res.arrayBuffer());
  } catch (e) {
    console.error(e);
    throw new HttpError(503, 'renderer_unavailable', 'Сервис PDF недоступен. Повторите через минуту.');
  }
}
