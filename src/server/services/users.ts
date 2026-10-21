import { z } from 'zod';
import { randomToken } from '../crypto';

export const userSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  displayName: z.string().trim().min(1).max(120),
  title: z.string().trim().max(120).nullable().default(null),
  role: z.enum(['ADMIN', 'DOCTOR', 'HYGIENIST', 'ASSISTANT']),
});

/** Временный пароль: сотрудник обязан сменить его при первом входе. */
export const tempPassword = () => randomToken(9);

export const userSelect = { id: true, email: true, displayName: true, title: true, role: true, isActive: true, createdAt: true } as const;
