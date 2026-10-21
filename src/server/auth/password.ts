import { hash, verify } from '@node-rs/argon2';

// argon2id, параметры по рекомендации OWASP
const options = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, options);
}

export async function verifyPassword(hashed: string, password: string): Promise<boolean> {
  try {
    return await verify(hashed, password);
  } catch {
    return false;
  }
}

export const PASSWORD_MIN = 10;
