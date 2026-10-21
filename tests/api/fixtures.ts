import type { Client } from './client';

/** Проверенная позиция каталога и утверждённые тексты PSR для выдачи в тестах. */
export async function prepareIssuable(admin: Client, doctor: Client) {
  const list = await admin.json<Array<{ id: string; label: string; brand: string }>>('GET', '/api/v1/admin/brushes');
  let size = list.find((x) => x.brand === 'Тест' && x.label === 'Тест 1');
  if (!size) {
    await admin.json('POST', '/api/v1/admin/brushes', { brand: 'Тест', line: 'тест', label: 'Тест 1', passageMm: 0.7, colorHex: '#123456', verified: true });
    size = (await admin.json<Array<{ id: string; label: string; brand: string }>>('GET', '/api/v1/admin/brushes')).find((x) => x.brand === 'Тест')!;
  }
  for (const code of ['1']) {
    await admin.json('PUT', '/api/v1/admin/psr-texts', { code, staffText: 'Тест', patientText: `Тестовый текст, код ${code}.` });
    await doctor.json('POST', `/api/v1/admin/psr-texts/${code}/approve`, { approved: true });
  }
  return size.id;
}

/** Визит с картой ёршиков и скринингом, готовый к выдаче. */
export async function issuableVisit(doctor: Client, sizeId: string) {
  const card = `TEST-${Date.now()}-${Math.round(Math.random() * 1e4)}`;
  const patient = await doctor.json<{ id: string }>('POST', '/api/v1/patients', { cardNumber: card, displayName: 'Тест' });
  const visit = await doctor.json<{ id: string }>('POST', `/api/v1/patients/${patient.id}/visits`, { copyBrushMap: false });
  const map = await doctor.json<{ id: string; rev: number; content: any }>('POST', `/api/v1/visits/${visit.id}/documents`, { type: 'BRUSH_MAP' });
  map.content.elements['16-15'] = { size: { catalogId: sizeId }, bleeding: true };
  map.content.elements['15-14'] = { size: { catalogId: sizeId } };
  await doctor.json('PATCH', `/api/v1/documents/${map.id}`, { content: map.content, rev: map.rev });
  const psr = await doctor.json<{ id: string; rev: number; content: any }>('POST', `/api/v1/visits/${visit.id}/documents`, { type: 'PSR' });
  psr.content.sextants.S1 = { code: 1, asterisk: false };
  await doctor.json('PATCH', `/api/v1/documents/${psr.id}`, { content: psr.content, rev: psr.rev });
  return { patientId: patient.id, visitId: visit.id, card, mapId: map.id };
}
