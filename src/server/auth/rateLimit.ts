import { keyedHash } from '../crypto';
import { db } from '../db';

const WINDOW_MS = 15 * 60 * 1000;
export const MAX_FAILS_PER_EMAIL = 5;
export const MAX_FAILS_PER_IP = 20;

export async function isLoginBlocked(email: string, ip: string): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MS);
  const [byEmail, byIp] = await Promise.all([
    db().loginAttempt.count({ where: { emailHash: keyedHash(email), success: false, createdAt: { gte: since } } }),
    db().loginAttempt.count({ where: { ipHash: keyedHash(ip), success: false, createdAt: { gte: since } } }),
  ]);
  return byEmail >= MAX_FAILS_PER_EMAIL || byIp >= MAX_FAILS_PER_IP;
}

export async function recordLoginAttempt(email: string, ip: string, success: boolean): Promise<void> {
  await db().loginAttempt.create({ data: { emailHash: keyedHash(email), ipHash: keyedHash(ip), success } });
  if (success) {
    await db().loginAttempt.deleteMany({ where: { emailHash: keyedHash(email), success: false } });
  }
}
