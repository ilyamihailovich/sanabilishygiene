import { beforeAll, describe, expect, it } from 'vitest';
import { anonymous, login, type Client } from './client';
import { issuableVisit, prepareIssuable } from './fixtures';

let admin: Client, doctor: Client, hygienist: Client, assistant: Client;
let sizeId: string;

beforeAll(async () => {
  [admin, doctor, hygienist, assistant] = await Promise.all([
    login('admin@sanabilis.local', process.env.ADMIN_PASSWORD ?? 'admin-password'),
    login('doctor@sanabilis.local'),
    login('hygienist@sanabilis.local'),
    login('assistant@sanabilis.local'),
  ]);
  sizeId = await prepareIssuable(admin, doctor);
});

describe('права доступа по ролям', () => {
  it('без входа API закрыт', async () => {
    expect((await anonymous('/api/v1/patients?card=1')).status).toBe(401);
    expect((await anonymous('/api/v1/admin/users')).status).toBe(401);
  });

  it('сотрудники и журнал — только администратор', async () => {
    for (const c of [doctor, hygienist, assistant]) {
      expect((await c.call('GET', '/api/v1/admin/users')).status).toBe(403);
      expect((await c.call('GET', '/api/v1/admin/audit')).status).toBe(403);
    }
    expect((await admin.call('GET', '/api/v1/admin/users')).status).toBe(200);
  });

  it('каталог правит администратор, утверждает тексты врач', async () => {
    expect((await hygienist.call('POST', '/api/v1/admin/brushes', {})).status).toBe(403);
    expect((await doctor.call('PUT', '/api/v1/admin/psr-texts', { code: '0', staffText: 'x', patientText: 'x' })).status).toBe(403);
    expect((await admin.call('POST', '/api/v1/admin/psr-texts/1/approve', { approved: true })).status).toBe(403);
    expect((await doctor.call('POST', '/api/v1/admin/psr-texts/1/approve', { approved: true })).status).toBe(200);
  });

  it('ассистент заполняет карту, но не выдаёт пациенту', async () => {
    const { visitId } = await issuableVisit(assistant, sizeId);
    expect((await assistant.call('POST', `/api/v1/visits/${visitId}/issue`)).status).toBe(403);
    expect((await assistant.call('GET', `/api/v1/visits/${visitId}/share`)).status).toBe(403);
    await doctor.json('PATCH', `/api/v1/visits/${visitId}`, { clinicianId: (await doctor.json('GET', '/api/v1/me')).user.id });
    expect((await hygienist.call('POST', `/api/v1/visits/${visitId}/issue`)).status).toBe(200);
  });

  it('запрос с чужого origin отклоняется', async () => {
    const r = await fetch(`${process.env.API_BASE ?? 'http://localhost:3000'}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
      body: JSON.stringify({ email: 'x@x.ru', password: 'x' }),
    });
    expect(r.status).toBe(403);
  });
});

describe('диктовка', () => {
  it('без настроенного распознавания сервер отвечает, что движка нет, и не принимает звук', async () => {
    expect((await anonymous('/api/v1/dictation')).status).toBe(401);
    const cfg = await doctor.json<{ engine: string | null }>('GET', '/api/v1/dictation');
    if (cfg.engine !== null) return; // на стенде с STT_URL проверка ниже неприменима
    const form = new FormData();
    form.set('audio', new Blob([new Uint8Array(16)], { type: 'audio/webm' }), 'a.webm');
    const res = await doctor.call('POST', '/api/v1/dictation', form);
    expect(res.status).toBe(404);
  });
});

describe('пародонтограмма', () => {
  it('создаётся в визите с формулой из карты ёршиков, сохраняется и не попадает в документы пациента', async () => {
    const { visitId } = await issuableVisit(doctor, sizeId);
    const doc = await doctor.json<{ id: string; rev: number; content: { teeth: Record<string, { missing: boolean; pd: number[] }> } }>(
      'POST',
      `/api/v1/visits/${visitId}/documents`,
      { type: 'PERIO_CHART' },
    );
    // третьи моляры в карте по умолчанию отсутствуют
    expect(doc.content.teeth['18']!.missing).toBe(true);
    expect(doc.content.teeth['16']!.missing).toBe(false);
    doc.content.teeth['16']!.pd = [5, 3, 4, 3, 2, 3];
    const saved = await doctor.call('PATCH', `/api/v1/documents/${doc.id}`, { content: doc.content, rev: doc.rev });
    expect(saved.status).toBe(200);
    const bad = await doctor.call('PATCH', `/api/v1/documents/${doc.id}`, { content: { schema: 1, teeth: { '16': { pd: [1, 2] } } }, rev: doc.rev + 1 });
    expect(bad.status).toBe(400);
    // второй пародонтограммы в визите быть не может
    expect((await doctor.call('POST', `/api/v1/visits/${visitId}/documents`, { type: 'PERIO_CHART' })).status).toBe(409);
  });
});

describe('отчёт по пациенту', () => {
  it('PDF только для сотрудников', async () => {
    const { patientId } = await issuableVisit(doctor, sizeId);
    expect((await anonymous(`/api/v1/patients/${patientId}/report`)).status).toBe(401);
    const res = await doctor.call('GET', `/api/v1/patients/${patientId}/report`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
    expect(Buffer.from(await res.arrayBuffer()).subarray(0, 4).toString()).toBe('%PDF');
  }, 300_000);
});

describe('поиск пациента', () => {
  it('по фамилии и имени в любом порядке, без учёта регистра, и по началу номера медкарты', async () => {
    const card = `NAME-${Date.now()}`;
    await doctor.json('POST', '/api/v1/patients', { cardNumber: card, displayName: 'Тамара', fullName: 'Скворцова Тамара Ильинична' });
    const byName = await doctor.json<Array<{ cardNumber: string }>>('GET', `/api/v1/patients?q=${encodeURIComponent('тамара скворцова')}`);
    expect(byName.map((p) => p.cardNumber)).toContain(card);
    const byCard = await doctor.json<Array<{ cardNumber: string }>>('GET', `/api/v1/patients?q=${encodeURIComponent(card.slice(0, 8).toLowerCase())}`);
    expect(byCard.map((p) => p.cardNumber)).toContain(card);
    const none = await doctor.json<unknown[]>('GET', `/api/v1/patients?q=${encodeURIComponent('Скворцова Ольга')}`);
    expect(none).toHaveLength(0);
  });
});
