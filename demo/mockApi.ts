import QRCode from 'qrcode';

/** Подмена API: прототип работает без сервера, изменения живут до перезагрузки страницы. */
export function installMockApi(patientUrl: string) {
  const revs = new Map<string, number>();
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!url.includes('/api/v1/')) return realFetch(input, init);
    const method = (init?.method ?? 'GET').toUpperCase();
    const path = url.slice(url.indexOf('/api/v1/'));
    const doc = /^\/api\/v1\/documents\/([^/]+)$/.exec(path);
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
    if (path.startsWith('/api/v1/me')) return json({ ok: true });
    return json({ ok: true });
  };
}
