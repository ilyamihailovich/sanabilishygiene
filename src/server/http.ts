import { NextResponse, type NextRequest } from 'next/server';
import { ZodError, type ZodType } from 'zod';
import { getSession, type CurrentSession } from './auth/session';
import { env } from './env';
import { can, type Permission } from './rbac';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export const notFound = (message = 'Не найдено') => new HttpError(404, 'not_found', message);
export const forbidden = (message = 'Недостаточно прав') => new HttpError(403, 'forbidden', message);
export const conflict = (message: string) => new HttpError(409, 'conflict', message);
export const badRequest = (message: string, fields?: Record<string, string>) =>
  new HttpError(400, 'bad_request', message, fields);

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: { code: error.code, message: error.message, fields: error.fields } }, { status: error.status });
  }
  if (error instanceof ZodError) {
    const fields = Object.fromEntries(error.issues.map((i) => [i.path.join('.'), i.message]));
    return NextResponse.json({ error: { code: 'validation', message: 'Проверьте введённые данные', fields } }, { status: 400 });
  }
  console.error(error);
  return NextResponse.json({ error: { code: 'internal', message: 'Внутренняя ошибка' } }, { status: 500 });
}

/** Мутации принимаются только со своего origin (защита от CSRF вместе с SameSite cookie). */
function checkOrigin(req: NextRequest): void {
  if (req.method === 'GET' || req.method === 'HEAD') return;
  const origin = req.headers.get('origin');
  if (!origin) return;
  const allowed = new URL(env().APP_URL).origin;
  const self = req.nextUrl.origin;
  if (origin !== allowed && origin !== self) throw forbidden('Запрос с чужого адреса');
}

export function clientIp(req: NextRequest): string {
  return req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '0.0.0.0';
}

export async function readJson<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw badRequest('Ожидался JSON');
  }
  return schema.parse(body);
}

type Params = Record<string, string>;
type Ctx<P extends Params> = { params: Promise<P> };

interface StaffHandlerArgs<P extends Params> {
  req: NextRequest;
  params: P;
  session: CurrentSession;
}

/** Обработчик для сотрудников: сессия, права, origin, единый формат ошибок. */
export function staff<P extends Params = Params>(
  permission: Permission | null,
  handler: (args: StaffHandlerArgs<P>) => Promise<Response>,
) {
  return async (req: NextRequest, ctx: Ctx<P>): Promise<Response> => {
    try {
      checkOrigin(req);
      const session = await getSession();
      if (!session) throw new HttpError(401, 'unauthorized', 'Требуется вход');
      if (session.user.mustChangePassword && !req.nextUrl.pathname.startsWith('/api/v1/auth/')) {
        throw new HttpError(403, 'password_change', 'Задайте новый пароль');
      }
      if (permission && !can(session.user.role, permission)) throw forbidden();
      return await handler({ req, params: await ctx.params, session });
    } catch (error) {
      return errorResponse(error);
    }
  };
}

/** Публичный обработчик (вход, ссылка пациента). */
export function publicRoute<P extends Params = Params>(handler: (args: { req: NextRequest; params: P }) => Promise<Response>) {
  return async (req: NextRequest, ctx: Ctx<P>): Promise<Response> => {
    try {
      checkOrigin(req);
      return await handler({ req, params: await ctx.params });
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export const ok = (data: unknown = { ok: true }, init?: ResponseInit) => NextResponse.json(data, init);
