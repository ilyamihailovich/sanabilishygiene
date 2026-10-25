import QRCode from 'qrcode';
import { firstNameOf } from '@/domain/patient';

/** Подмена API: прототип работает без сервера, изменения живут до перезагрузки страницы. */
export interface MockDocs {
  create: (visitId: string, body: { type: string; templateId: string | null; start?: { from: 'empty' | 'previous'; teeth?: Record<string, unknown> } }) => { id: string };
  remove: (id: string) => void;
}

export function installMockApi(patientUrl: string, patients: Array<{ id: string; cardNumber: string; displayName: string | null; fullName?: string | null }>, docsApi: MockDocs) {
  const revs = new Map<string, number>();
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!url.includes('/api/v1/')) return realFetch(input, init);
    const method = (init?.method ?? 'GET').toUpperCase();
    const path = url.slice(url.indexOf('/api/v1/'));
    const createDoc = /^\/api\/v1\/visits\/([^/]+)\/documents$/.exec(path);
    if (createDoc && method === 'POST') return json(docsApi.create(createDoc[1]!, JSON.parse(String(init?.body ?? '{}'))), 201);
    const doc = /^\/api\/v1\/documents\/([^/]+)$/.exec(path);
    if (doc && method === 'DELETE') {
      docsApi.remove(doc[1]!);
      return json({ ok: true });
    }
    if (doc && method === 'PATCH') {
      const next = (revs.get(doc[1]!) ?? 1) + 1;
      revs.set(doc[1]!, next);
      return json({ rev: next });
    }
    if (path.endsWith('/share')) {
      const qr = await QRCode.toString(patientUrl, { type: 'svg', margin: 0, color: { dark: '#1d1d1f', light: '#ffffff00' } });
      return json({ url: patientUrl, qr });
    }
    if (path.endsWith('/issue')) return json({ issueId: 'demo', number: 2, url: patientUrl });
    if (path.startsWith('/api/v1/library-items')) return json([]);
    if (path.startsWith('/api/v1/patients?')) {
      const params = new URLSearchParams(path.split('?')[1]);
      const q = (params.get('q') ?? params.get('card') ?? '').toLowerCase().trim();
      const words = q.split(/\s+/).filter(Boolean);
      // как на сервере: начало номера медкарты или все слова в ФИО и имени
      return json(
        patients.filter(
          (p) => p.cardNumber.toLowerCase().startsWith(q) || (words.length > 0 && words.every((w) => `${p.fullName ?? ''} ${p.displayName ?? ''}`.toLowerCase().includes(w))),
        ),
      );
    }
    if (path === '/api/v1/patients' && method === 'POST') {
      // новый пациент живёт до перезагрузки прототипа; имя для обращения — из ФИО, как на сервере
      const body = JSON.parse(String(init?.body ?? '{}')) as { cardNumber?: string; fullName?: string };
      const p = { id: `p-${Math.random().toString(36).slice(2, 8)}`, cardNumber: (body.cardNumber ?? '').trim().toUpperCase(), fullName: body.fullName?.trim() || null, displayName: firstNameOf(body.fullName) };
      patients.push(p);
      return json(p, 201);
    }
    const newVisit = /^\/api\/v1\/patients\/([^/]+)\/visits$/.exec(path);
    if (newVisit && method === 'POST') return json({ id: `v-new-${newVisit[1]}` });
    if (path === '/api/v1/admin/brushes' && method === 'POST') return json({ id: `b-${Math.random().toString(36).slice(2, 10)}` }, 201);
    const copy = /^\/api\/v1\/templates\/([^/]+)\/copy$/.exec(path);
    if (copy) return json({ id: copy[1] });
    if (path.endsWith('/draft')) return json({ lint: [] });
    if (path.endsWith('/publish')) return json({ version: 2 });
    if (path.startsWith('/api/v1/me')) return json({ ok: true });
    // в прототипе нет сервера распознавания: диктовка через браузер или пример
    if (path.startsWith('/api/v1/dictation')) return json({ engine: null, private: false });
    return json({ ok: true });
  };
}
