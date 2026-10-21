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
