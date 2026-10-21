import { z } from 'zod';
import { audit } from '@/server/audit';
import { db } from '@/server/db';
import { ok, readJson, staff } from '@/server/http';

export const GET = staff(null, async () => ok(await db().psrText.findMany({ orderBy: { code: 'asc' } })));

const schema = z.object({
  code: z.enum(['0', '1', '2', '3', '4', 'X', '*']),
  staffText: z.string().trim().max(2000),
  patientText: z.string().trim().max(2000),
});

/** Правка текста снимает утверждение: новый текст снова утверждает врач. */
export const PUT = staff('texts.edit', async ({ req, session }) => {
  const input = await readJson(req, schema);
  const row = await db().psrText.upsert({
    where: { code: input.code },
    create: { ...input, updatedById: session.user.id },
    update: { staffText: input.staffText, patientText: input.patientText, approved: false, approvedById: null, updatedById: session.user.id },
  });
  await audit({ userId: session.user.id, action: 'texts.update', entityType: 'psr_text', entityId: input.code });
  return ok(row);
});
