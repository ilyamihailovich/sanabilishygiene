import { cookies } from 'next/headers';
import { cache } from 'react';
import type { User } from '@/generated/prisma/client';
import { randomToken, sha256 } from '../crypto';
import { db } from '../db';
import { env } from '../env';
import { getSettings } from '../settings';

export const SESSION_COOKIE = 'sid';
const ABSOLUTE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TOUCH_INTERVAL_MS = 60 * 1000;

export type SessionUser = Pick<User, 'id' | 'email' | 'displayName' | 'title' | 'role' | 'mustChangePassword' | 'prefs'>;

export interface CurrentSession {
  sessionId: string;
  user: SessionUser;
  idleTimeoutMin: number;
}

export async function createSession(userId: string, userAgent: string | null): Promise<string> {
  const token = randomToken();
  await db().session.create({
    data: {
      id: sha256(token),
      userId,
      userAgent: userAgent?.slice(0, 300) ?? null,
      expiresAt: new Date(Date.now() + ABSOLUTE_TTL_MS),
    },
  });
  return token;
}

export async function setSessionCookie(token: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env().COOKIE_SECURE,
    sameSite: 'lax',
    path: '/',
    maxAge: ABSOLUTE_TTL_MS / 1000,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Сессия по токену: проверка абсолютного срока, блокировки сотрудника и бездействия. */
export async function validateSessionToken(token: string): Promise<CurrentSession | null> {
  const id = sha256(token);
  const session = await db().session.findUnique({
    where: { id },
    include: {
      user: {
        select: { id: true, email: true, displayName: true, title: true, role: true, mustChangePassword: true, prefs: true, isActive: true },
      },
    },
  });
  if (!session) return null;
  const { idleTimeoutMin } = await getSettings();
  const now = Date.now();
  const idle = now - session.lastActiveAt.getTime() > idleTimeoutMin * 60 * 1000;
  if (session.expiresAt.getTime() < now || idle || !session.user.isActive) {
    await db().session.delete({ where: { id } }).catch(() => undefined);
    return null;
  }
  if (now - session.lastActiveAt.getTime() > TOUCH_INTERVAL_MS) {
    await db().session.update({ where: { id }, data: { lastActiveAt: new Date(now) } });
  }
  const { isActive: _active, ...user } = session.user;
  return { sessionId: id, user, idleTimeoutMin };
}

/** Текущая сессия запроса (кешируется в пределах рендера). */
export const getSession = cache(async (): Promise<CurrentSession | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? validateSessionToken(token) : null;
});

export async function destroySession(sessionId: string): Promise<void> {
  await db().session.deleteMany({ where: { id: sessionId } });
}

export async function destroyUserSessions(userId: string, exceptSessionId?: string): Promise<void> {
  await db().session.deleteMany({
    where: { userId, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
  });
}
