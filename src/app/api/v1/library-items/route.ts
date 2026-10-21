import { z } from 'zod';
import type { Prisma } from '@/generated/prisma/client';
import { templateItemSchema } from '@/schemas/template';
import { db } from '@/server/db';
import { forbidden, ok, readJson, staff } from '@/server/http';
import { can } from '@/server/rbac';

export const GET = staff(null, async ({ session }) =>
  ok(
    await db().libraryItem.findMany({
      where: { archived: false, OR: [{ ownerId: null }, { ownerId: session.user.id }] },
      orderBy: [{ kind: 'asc' }, { title: 'asc' }],
    }),
  ),
);

const schema = z.object({ title: z.string().trim().min(1).max(200), item: templateItemSchema, library: z.boolean().default(false) });

export const POST = staff(null, async ({ req, session }) => {
  const { title, item, library } = await readJson(req, schema);
  if (library ? !can(session.user.role, 'template.library') : !can(session.user.role, 'template.personal')) throw forbidden();
  const created = await db().libraryItem.create({
    data: {
      title,
      kind: item.type,
      category: item.type === 'product' ? item.category : null,
      payload: item as Prisma.InputJsonValue,
      ownerId: library ? null : session.user.id,
    },
  });
  return ok(created, { status: 201 });
});
