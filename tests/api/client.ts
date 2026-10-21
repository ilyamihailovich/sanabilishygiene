export const BASE = process.env.API_BASE ?? 'http://localhost:3000';

export interface Client {
  call: (method: string, url: string, body?: unknown) => Promise<Response>;
  json: <T = any>(method: string, url: string, body?: unknown) => Promise<T>;
}

/** HTTP-клиент с cookie сессии. */
export async function login(email: string, password = 'demo-password'): Promise<Client> {
  let cookie = '';
  const call = async (method: string, url: string, body?: unknown) => {
    const res = await fetch(`${BASE}${url}`, {
      method,
      headers: { 'content-type': 'application/json', origin: BASE, ...(cookie ? { cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual',
    });
    const set = res.headers.get('set-cookie');
    if (set?.startsWith('sid=')) cookie = set.split(';')[0]!;
    return res;
  };
  const res = await call('POST', '/api/v1/auth/login', { email, password });
  if (!res.ok) throw new Error(`Вход ${email}: ${res.status}`);
  const json = async <T,>(method: string, url: string, body?: unknown) => {
    const r = await call(method, url, body);
    if (!r.ok) throw new Error(`${method} ${url}: ${r.status} ${await r.text()}`);
    return (await r.json()) as T;
  };
  return { call, json };
}

export const anonymous = (url: string, init?: RequestInit) => fetch(`${BASE}${url}`, { redirect: 'manual', ...init });
