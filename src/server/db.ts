import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { env } from './env';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function create() {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: env().DATABASE_URL }) });
}

export function db(): PrismaClient {
  globalForPrisma.prisma ??= create();
  return globalForPrisma.prisma;
}
