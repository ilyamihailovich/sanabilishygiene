import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from './env';

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Хеш с секретом приложения: для email и IP в журнале попыток входа. */
export function keyedHash(value: string): string {
  return createHmac('sha256', env().APP_SECRET).update(value).digest('hex');
}

function key(): Buffer {
  return createHash('sha256').update(`enc:${env().APP_SECRET}`).digest();
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64url')).join('.');
}

export function decrypt(payload: string): string {
  const [iv, tag, data] = payload.split('.').map((p) => Buffer.from(p, 'base64url'));
  if (!iv || !tag || !data) throw new Error('Повреждённые данные');
  const decipher = createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

/** Короткоживущая подпись для внутренних маршрутов печати и рендера. */
export function signInternal(subject: string, ttlSeconds = 120): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const mac = createHmac('sha256', env().APP_SECRET).update(`${subject}.${exp}`).digest('base64url');
  return `${exp}.${mac}`;
}

export function verifyInternal(subject: string, signature: string | null | undefined): boolean {
  if (!signature) return false;
  const [expRaw, mac] = signature.split('.');
  const exp = Number(expRaw);
  if (!mac || !Number.isFinite(exp) || exp < Date.now() / 1000) return false;
  const expected = createHmac('sha256', env().APP_SECRET).update(`${subject}.${exp}`).digest('base64url');
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
