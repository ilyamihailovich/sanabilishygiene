import { ok, staff } from '@/server/http';

/** Профиль и продление сессии (вызывается при активности пользователя). */
export const GET = staff(null, async ({ session }) => ok({ user: session.user, idleTimeoutMin: session.idleTimeoutMin }));
