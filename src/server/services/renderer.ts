import type { VisitIssue } from '@/generated/prisma/client';
import type { IssueSnapshot } from '@/schemas/snapshot';
import { signInternal } from '../crypto';
import { db } from '../db';
import { env } from '../env';
import { HttpError } from '../http';
import { readData, writeData } from '../storage';

export const RENDER_VIEWS = ['upper', 'lower', 'front'] as const;
export type RenderView = (typeof RENDER_VIEWS)[number];

const internalUrl = (path: string, subject: string) =>
  `${env().INTERNAL_APP_URL ?? env().APP_URL}${path}?sig=${encodeURIComponent(signInternal(subject, 180))}`;

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
      60_000,
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

async function renderPdf(issueId: string): Promise<Buffer> {
  let res: Response;
  try {
    res = await callRenderer('/pdf', { url: internalUrl(`/print/${issueId}`, `print:${issueId}`) }, 90_000);
  } catch (e) {
    console.error(e);
    throw new HttpError(503, 'renderer_unavailable', 'Сервис PDF недоступен. Повторите через минуту.');
  }
  const pdf = Buffer.from(await res.arrayBuffer());
  const rel = `issues/${issueId}/document.pdf`;
  await writeData(rel, pdf);
  await db().visitIssue.update({ where: { id: issueId }, data: { pdfPath: rel } });
  return pdf;
}

export async function prepareIssueFiles(issueId: string): Promise<void> {
  const issue = await db().visitIssue.findUniqueOrThrow({ where: { id: issueId } });
  await renderViews(issue);
  await renderPdf(issueId);
}

export async function getIssuePdf(issueId: string): Promise<Buffer> {
  const issue = await db().visitIssue.findUniqueOrThrow({ where: { id: issueId } });
  if (issue.pdfPath) {
    const cached = await readData(issue.pdfPath);
    if (cached) return cached;
  }
  if (!issue.renders) await renderViews(issue);
  return renderPdf(issueId);
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
