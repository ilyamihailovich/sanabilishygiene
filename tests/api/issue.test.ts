import { beforeAll, describe, expect, it } from 'vitest';
import { anonymous, login, type Client } from './client';
import { issuableVisit, prepareIssuable } from './fixtures';

let admin: Client, doctor: Client;
let sizeId: string;
let doctorId: string;

beforeAll(async () => {
  admin = await login('admin@sanabilis.local', process.env.ADMIN_PASSWORD ?? 'admin-password');
  doctor = await login('doctor@sanabilis.local');
  sizeId = await prepareIssuable(admin, doctor);
  doctorId = (await doctor.json('GET', '/api/v1/me')).user.id;
});

const pathOf = (url: string) => new URL(url).pathname;

describe('выдача пациенту и ссылка', () => {
  it('без врача и с непроверенным размером выдача заблокирована', async () => {
    const v = await issuableVisit(doctor, sizeId);
    await doctor.json('PATCH', `/api/v1/visits/${v.visitId}`, { clinicianId: null });
    const r = await doctor.call('POST', `/api/v1/visits/${v.visitId}/issue`);
    expect(r.status).toBe(422);
    const unverified = (await admin.json<Array<{ id: string; verified: boolean }>>('GET', '/api/v1/admin/brushes')).find((x) => !x.verified);
    if (unverified) {
      const map = await doctor.json<{ documents: Array<{ id: string; type: string; rev: number; content: any }> }>('GET', `/api/v1/visits/${v.visitId}`);
      const doc = map.documents.find((d) => d.type === 'BRUSH_MAP')!;
      doc.content.elements['14-13'] = { size: { catalogId: unverified.id } };
      await doctor.json('PATCH', `/api/v1/documents/${doc.id}`, { content: doc.content, rev: doc.rev });
      await doctor.json('PATCH', `/api/v1/visits/${v.visitId}`, { clinicianId: doctorId });
      const ready = await doctor.json<{ blockers: Array<{ message: string }> }>('GET', `/api/v1/visits/${v.visitId}/readiness`);
      expect(ready.blockers.some((b) => b.message.includes('не проверены'))).toBe(true);
    }
  });

  it('доступ по токену, noindex, без номера медкарты; отзыв и новая ссылка', async () => {
    const v = await issuableVisit(doctor, sizeId);
    await doctor.json('PATCH', `/api/v1/visits/${v.visitId}`, { clinicianId: doctorId });
    const { url } = await doctor.json<{ url: string }>('POST', `/api/v1/visits/${v.visitId}/issue`);
    const page = await anonymous(pathOf(url));
    expect(page.status).toBe(200);
    expect(page.headers.get('x-robots-tag')).toContain('noindex');
    expect(page.headers.get('cache-control')).toContain('no-store');
    const html = await page.text();
    expect(html).not.toContain(v.card);
    expect(html).toContain('noindex');

    expect((await anonymous('/p/abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG')).status).toBe(404);

    const rotated = await doctor.json<{ url: string }>('POST', `/api/v1/visits/${v.visitId}/share/rotate`);
    expect((await anonymous(pathOf(url))).status).toBe(404);
    expect((await anonymous(pathOf(rotated.url))).status).toBe(200);

    await doctor.json('POST', `/api/v1/visits/${v.visitId}/share/revoke`);
    expect((await anonymous(pathOf(rotated.url))).status).toBe(404);
  });

  it('изменение каталога после выдачи не меняет выданный документ', async () => {
    const v = await issuableVisit(doctor, sizeId);
    await doctor.json('PATCH', `/api/v1/visits/${v.visitId}`, { clinicianId: doctorId });
    const { url } = await doctor.json<{ url: string }>('POST', `/api/v1/visits/${v.visitId}/issue`);
    await admin.json('PATCH', `/api/v1/admin/brushes/${sizeId}`, { label: 'Тест 1 изменён' });
    const html = await (await anonymous(pathOf(url))).text();
    expect(html).toContain('Тест 1');
    expect(html).not.toContain('Тест 1 изменён');
    await admin.json('PATCH', `/api/v1/admin/brushes/${sizeId}`, { label: 'Тест 1' });
  });

  it('PDF: A4, имя файла с датой', async () => {
    const v = await issuableVisit(doctor, sizeId);
    await doctor.json('PATCH', `/api/v1/visits/${v.visitId}`, { clinicianId: doctorId });
    const { issueId } = await doctor.json<{ issueId: string }>('POST', `/api/v1/visits/${v.visitId}/issue`);
    const r = await doctor.call('GET', `/api/v1/issues/${issueId}/pdf`);
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toBe('application/pdf');
    expect(decodeURIComponent(r.headers.get('content-disposition') ?? '')).toMatch(/SANABILIS_Гигиена_\d{2}-\d{2}-\d{4}\.pdf/);
    const bytes = Buffer.from(await r.arrayBuffer());
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
    expect(bytes.toString('latin1')).toMatch(/\/MediaBox \[0 0 59[45]\.\d+ 84[12]\.\d+\]/);
  });
});
